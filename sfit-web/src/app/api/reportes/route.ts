import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { SfitCoin } from "@/models/SfitCoin";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { awardCoins, getNivel } from "@/lib/coins/awardCoins";
import { verifyQrPayload, type QrPayload } from "@/lib/qr/hmac";
import { createNotificationForRoles } from "@/lib/notifications/create";

/**
 * Categorías válidas de reporte ciudadano (RF-14).
 * Estas etiquetas coinciden con las usadas en la app móvil y el dashboard.
 */
const REPORT_CATEGORIES = [
  "Exceso de velocidad",
  "Conductor agresivo",
  "Vehículo en mal estado",
  "Falta de mantenimiento",
  "Incumplimiento de ruta",
  "Cobro indebido",
  "Conducción peligrosa",
  "Contaminación ambiental",
  "Falta de señalización",
  "Otro",
] as const;

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId).optional(),
  category: z.enum(REPORT_CATEGORIES, {
    error: `Categoría inválida. Valores permitidos: ${REPORT_CATEGORIES.join(", ")}`,
  }),
  vehicleTypeKey: z.string().optional(),
  description: z.string()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(2000, "La descripción no puede superar los 2000 caracteres"),
  evidenceUrl: z.string().url().optional(),
  imageUrls: z.array(z.string().url()).max(5).optional(),
  fraudScore: z.number().min(0).max(100).optional(),
  // Validación geográfica capa 2 — opcionales; no rechazan el reporte si están ausentes
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // RF-12-04: QR anti-fraude — payload JSON del QR escaneado por el ciudadano
  qrToken: z.string().optional(),
  // Placa del vehículo si viene del scan de QR (permite crear sin vehicleId)
  vehiclePlate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) return apiError("municipalityId inválido", 400);
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (statusParam) filter.status = statusParam;

    const [items, total] = await Promise.all([
      CitizenReport.find(filter)
        .populate("vehicleId", "plate vehicleTypeKey brand model")
        .populate("citizenId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CitizenReport.countDocuments(filter),
    ]);

    // Stats globales (sin filtro de status) — los KPIs no se distorsionan al cambiar de tab
    const globalFilter: Record<string, unknown> = { ...filter };
    delete globalFilter.status;
    const counts = await CitizenReport.aggregate([
      { $match: Object.keys(globalFilter).length ? globalFilter : {} },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []);

    const statusCounts = Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count]));

    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        municipalityId: String(r.municipalityId),
        vehicle: r.vehicleId as unknown as Record<string, unknown> | null,
        citizen: r.citizenId as unknown as Record<string, unknown> | null,
        category: r.category,
        vehicleTypeKey: r.vehicleTypeKey,
        citizenReputationLevel: r.citizenReputationLevel,
        status: r.status,
        description: r.description,
        evidenceUrl: r.evidenceUrl,
        imageUrls: r.imageUrls ?? [],
        fraudScore: r.fraudScore,
        fraudLayers: r.fraudLayers,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      statusCounts,
    });
  } catch (error) {
    console.error("[reportes GET]", error);
    return apiError("Error al listar reportes", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.CIUDADANO,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    // Resolver vehículo por placa (ciudadano siempre envía vehiclePlate, no vehicleId)
    let vehicleId = parsed.data.vehicleId;
    let municipalityId = parsed.data.municipalityId;

    if (parsed.data.vehiclePlate) {
      const vehicle = await Vehicle.findOne({
        plate: parsed.data.vehiclePlate.toUpperCase(),
        active: true,
      }).select("_id municipalityId").lean();

      if (vehicle) {
        vehicleId = vehicleId ?? String(vehicle._id);
        if (!municipalityId) municipalityId = String(vehicle.municipalityId);
      }
    }

    // Asignar municipalityId según rol
    if (auth.session.role === ROLES.CIUDADANO) {
      // Ciudadano no tiene municipalityId en sesión — usa el del vehículo reportado
      if (!municipalityId) {
        return apiError("No se encontró el vehículo indicado o no está habilitado", 404);
      }
    } else if (auth.session.role !== ROLES.SUPER_ADMIN) {
      // Roles operativos: siempre usan su municipalidad de sesión
      if (!auth.session.municipalityId) return apiForbidden();
      municipalityId = auth.session.municipalityId;
    }

    if (!municipalityId) return apiError("municipalityId requerido", 400);

    // Capa 1: Verificar que el ciudadano no esté suspendido
    // (el campo status puede ser "suspendido" tras 3 rechazos consecutivos u otras causas)
    const citizenUser = await User.findById(auth.session.userId).select("status").lean();
    const capa1Passed = citizenUser?.status === "activo";
    if (!capa1Passed) {
      return apiError("Su cuenta está suspendida o inactiva y no puede enviar reportes", 403);
    }

    // Capa 3: Límite diario por ciudadano (max 5 reportes/día)
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const reportsToday = await CitizenReport.countDocuments({
      citizenId: auth.session.userId,
      createdAt: { $gte: startOfDay },
    });
    const DAILY_LIMIT = 5;
    const capa3Passed = reportsToday < DAILY_LIMIT;

    if (!capa3Passed) {
      return apiError(`Has alcanzado el límite de ${DAILY_LIMIT} reportes por día`, 429);
    }

    // RF-12-04: Capa 4 — Verificar HMAC del QR escaneado
    let qrVerified = false;
    let qrDetail = "QR no provisto";
    if (parsed.data.qrToken) {
      try {
        const rawPayload = JSON.parse(parsed.data.qrToken) as QrPayload;
        qrVerified = verifyQrPayload(rawPayload);
        qrDetail = qrVerified ? "HMAC verificado" : "HMAC inválido";
      } catch {
        qrDetail = "QR malformado";
      }
    }

    // RF-12-06: Capa 5 — Nivel de reputación del ciudadano basado en balance SFITCoins
    let citizenReputationLevel = 1;
    try {
      const lastCoinTx = await SfitCoin.findOne({ userId: auth.session.userId })
        .sort({ createdAt: -1 })
        .select("balance")
        .lean();
      const balance = lastCoinTx?.balance ?? 0;
      citizenReputationLevel = getNivel(balance).nivel;
    } catch {
      citizenReputationLevel = 1;
    }

    // Capa 2: contexto geográfico — coordenadas presentes y dentro del
    // bounding box del Perú (lat -18.5..-0.05, lng -81.4..-68.6). Detecta
    // GPS spoofeado o reportes desde fuera del país.
    const { latitude, longitude } = parsed.data;
    const hasCoords = latitude !== undefined && longitude !== undefined;
    const insidePeru =
      hasCoords &&
      latitude! >= -18.5 && latitude! <= -0.04 &&
      longitude! >= -81.4 && longitude! <= -68.6;
    const capa2Passed = insidePeru;
    const capa2Detail = !hasCoords
      ? "Sin coordenadas — no se puede validar"
      : insidePeru
        ? "Coordenadas dentro del territorio peruano"
        : "Coordenadas fuera de Perú — posible GPS spoofeado";

    // Capa 5: corroboración — ¿hay otros reportes recientes (24h) del
    // mismo vehículo y misma categoría? Si sí, eleva confiabilidad.
    let capa5Passed = false;
    let capa5Detail = "Sin reportes similares recientes";
    if (vehicleId) {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const similar = await CitizenReport.countDocuments({
        vehicleId,
        category: parsed.data.category,
        createdAt: { $gte: last24h },
        citizenId: { $ne: auth.session.userId }, // de otro ciudadano, no el mismo
      });
      if (similar > 0) {
        capa5Passed = true;
        capa5Detail = `${similar} reporte${similar > 1 ? "s" : ""} similar${similar > 1 ? "es" : ""} en 24h`;
      }
    }

    // FraudScore compuesto: base 60, reducido por capas superadas
    let fraudScore = parsed.data.fraudScore ?? 60;
    if (qrVerified) fraudScore = Math.max(0, fraudScore - 20);
    if (citizenReputationLevel >= 3) fraudScore = Math.max(0, fraudScore - 10);
    if (capa2Passed) fraudScore = Math.max(0, fraudScore - 5);
    if (capa5Passed) fraudScore = Math.max(0, fraudScore - 15); // corroboración pesa más

    const fraudLayers = [
      { layer: "Identidad", passed: capa1Passed, detail: "Usuario verificado y activo" },
      { layer: "Contexto", passed: capa2Passed, detail: capa2Detail },
      { layer: "Límite diario", passed: capa3Passed, detail: `${reportsToday + 1}/${DAILY_LIMIT} reportes hoy` },
      { layer: "QR válido", passed: qrVerified, detail: qrDetail },
      { layer: "Corroboración", passed: capa5Passed, detail: capa5Detail },
    ];

    const doc = await CitizenReport.create({
      municipalityId,
      vehicleId: vehicleId,
      citizenId: auth.session.userId,
      category: parsed.data.category,
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      description: parsed.data.description,
      evidenceUrl: parsed.data.evidenceUrl,
      imageUrls: parsed.data.imageUrls ?? [],
      qrVerified,
      citizenReputationLevel,
      fraudScore,
      fraudLayers,
      status: "pendiente",
      ...(hasCoords && { latitude, longitude }),
    });

    // Capa 2 anti-fraude — registrar en AuditLog si el reporte incluye coordenadas
    if (hasCoords) {
      void AuditLog.create({
        actorId: auth.session.userId,
        actorRole: auth.session.role,
        action: "reporte_con_coordenadas",
        resourceType: "CitizenReport",
        resourceId: String(doc._id),
        municipalityId: municipalityId as string,
        metadata: { latitude, longitude },
      }).catch((e) => console.error("[reportes POST] AuditLog coords error", e));
    }

    // RF-15: Otorgar 5 SFITCoins al ciudadano por enviar un reporte
    if (auth.session.role === ROLES.CIUDADANO) {
      void awardCoins(auth.session.userId, 5, "reporte_enviado", String(doc._id));
    }

    // RF-18: Notificar a fiscales y admin_municipal de la muni que entró un
    // reporte nuevo. Best-effort, no bloquea la respuesta.
    void createNotificationForRoles(
      [ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL],
      {
        title: "Nuevo reporte ciudadano",
        body: `Categoría: ${parsed.data.category}`,
        type: "info",
        category: "reporte",
        link: `/reportes/${String(doc._id)}`,
        metadata: {
          type: "reporte_nuevo",
          reportId: String(doc._id),
          category: parsed.data.category,
        },
        municipalityId: String(municipalityId),
      },
    ).catch(() => {});

    return apiResponse({ id: String(doc._id) }, 201);
  } catch (error) {
    console.error("[reportes POST]", error);
    return apiError("Error al crear reporte", 500);
  }
}
