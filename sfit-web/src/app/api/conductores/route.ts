import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, DRIVER_STATUS, USER_STATUS } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import {
  buildLicenseValidityFilter,
  type LicenseValidityState,
} from "@/lib/license-validity";

const CreateDriverSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId, "municipalityId inválido").optional(),
  companyId: z.string().refine(isValidObjectId, "companyId inválido"),
  email: z.string().email("Correo electrónico inválido"),
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  licenseNumber: z.string().min(4).max(30),
  licenseCategory: z.string().min(2).max(20),
  /** Fecha emisión licencia MTC. ISO. */
  licenseIssuedAt: z.coerce.date().optional(),
  /** Fecha vencimiento licencia MTC. ISO. */
  licenseExpiryDate: z.coerce.date().optional(),
  phone: z.string().max(30).optional(),
  // Defaults explícitos vía zod: el contrato del endpoint queda visible en
  // el schema y los handlers no necesitan re-aplicar `?? valor` por cada
  // campo. Coincide con los defaults del modelo Driver y con la
  // política de fatiga (estado inicial "apto", 8h descanso baseline).
  status: z.enum(["apto", "riesgo", "no_apto"]).default("apto"),
  continuousHours: z.number().min(0).max(24).default(0),
  restHours: z.number().min(0).max(24).default(8),
  reputationScore: z.number().min(0).max(100).default(100),
  photoUrl: z.string().url("Foto del conductor requerida"),
}).refine(
  (d) =>
    !d.licenseIssuedAt ||
    !d.licenseExpiryDate ||
    d.licenseExpiryDate.getTime() > d.licenseIssuedAt.getTime(),
  {
    message: "La fecha de vencimiento debe ser posterior a la fecha de emisión",
    path: ["licenseExpiryDate"],
  },
);

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("conductores", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
    const activeParam = url.searchParams.get("active");
    const search = url.searchParams.get("q");
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

    // Filtro por empresa (solo admins; operador ya tiene su companyId forzado abajo)
    const companyIdParam = url.searchParams.get("companyId");
    if (companyIdParam && auth.session.role !== ROLES.OPERADOR) {
      if (!isValidObjectId(companyIdParam)) return apiError("companyId inválido", 400);
      const scopeFilter = await scopedCompanyFilter(auth.session);
      const companyExists = await Company.findOne({ _id: companyIdParam, ...scopeFilter }).select("_id").lean();
      if (!companyExists) return apiForbidden();
      filter.companyId = companyIdParam;
    }

    // Operador: acotar al companyId del operador (Driver.companyId directo).
    // Sin empresa asignada → lista vacía (no es error de auth).
    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) {
        return apiResponse({ items: [], total: 0, page, limit, statusCounts: {} });
      }
      filter.companyId = companyId;
    }

    const scopeFilter: Record<string, unknown> = { ...filter };

    if (statusParam && Object.values(DRIVER_STATUS).includes(statusParam as never)) {
      filter.status = statusParam;
    }

    // Filtro de activos: default muestra solo activos (true), pasar
    // active=false para ver los eliminados/inactivos.
    if (activeParam === "false") filter.active = false;
    else filter.active = true;

    // Filtro de vigencia de licencia. valid | expiring_soon | expired | missing | all
    const validityParam = url.searchParams.get("validity") as
      | LicenseValidityState
      | "all"
      | null;
    if (
      validityParam &&
      ["valid", "expiring_soon", "expired", "missing", "all"].includes(validityParam)
    ) {
      Object.assign(filter, buildLicenseValidityFilter(validityParam));
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { dni: { $regex: search, $options: "i" } },
        { licenseNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Driver.find(filter)
        .populate("companyId", "razonSocial")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Driver.countDocuments(filter),
    ]);

    const counts = await Driver.aggregate([
      { $match: scopeFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []);

    const statusCounts = Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count]));

    return apiResponse({
      items: items.map((d) => ({
        id: String(d._id),
        municipalityId: String(d.municipalityId),
        companyId: d.companyId ? String((d.companyId as { _id?: unknown })._id ?? d.companyId) : undefined,
        companyName: (d.companyId as { razonSocial?: string } | null)?.razonSocial,
        name: d.name,
        dni: d.dni,
        licenseNumber: d.licenseNumber,
        licenseCategory: d.licenseCategory,
        licenseIssuedAt: d.licenseIssuedAt ?? null,
        licenseExpiryDate: d.licenseExpiryDate ?? null,
        phone: d.phone,
        photoUrl: d.photoUrl,
        status: d.status,
        continuousHours: d.continuousHours,
        restHours: d.restHours,
        reputationScore: d.reputationScore,
        active: d.active,
        verified: d.verified ?? false,
        verifiedAt: d.verifiedAt ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      total,
      page,
      limit,
      statusCounts,
    });
  } catch (error) {
    console.error("[conductores GET]", error);
    return apiError("Error al listar conductores", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("conductores", "create")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateDriverSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    // Resolver municipalityId según rol:
    //   - admin_municipal/fiscal: usa el del JWT.
    //   - super_admin/admin_regional/admin_provincial: viene del body y se
    //     valida con canAccessMunicipality (cubre scope geográfico).
    //   - operador: usa el del JWT (su muni de operación).
    let municipalityId = parsed.data.municipalityId;
    if (
      auth.session.role === ROLES.ADMIN_MUNICIPAL ||
      auth.session.role === ROLES.FISCAL ||
      auth.session.role === ROLES.OPERADOR
    ) {
      if (!auth.session.municipalityId) return apiForbidden();
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) return apiError("municipalityId requerido", 400);

    await connectDB();
    if (!(await canAccessMunicipality(auth.session, municipalityId))) return apiForbidden();

    // companyId:
    //   - operador: forzar a su empresa propia (ignora body) y validar muni.
    //   - admins (SA/AR/AP/AM): si viene en body, validar que pertenezca al
    //     scope geográfico vía scopedCompanyFilter.
    let effectiveCompanyId = parsed.data.companyId;
    if (auth.session.role === ROLES.OPERADOR) {
      const myCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!myCompanyId) return apiError("Sin empresa asignada", 400);
      const company = await Company.findById(myCompanyId)
        .select("municipalityId active")
        .lean<{ municipalityId?: unknown; active?: boolean } | null>();
      if (!company || String(company.municipalityId) !== String(auth.session.municipalityId)) {
        return apiForbidden();
      }
      // No se puede operar con empresa pendiente: cierra el flujo hasta que
      // el admin_municipal apruebe la empresa desde el centro de aprobaciones.
      if (!company.active) {
        return apiError(
          "Tu empresa está pendiente de aprobación. Contacta al administrador municipal.",
          403,
        );
      }
      effectiveCompanyId = myCompanyId;
    } else if (effectiveCompanyId) {
      const filter = await scopedCompanyFilter(auth.session);
      const match = await Company.findOne({ _id: effectiveCompanyId, ...filter })
        .select("_id active")
        .lean<{ _id: unknown; active?: boolean } | null>();
      if (!match) return apiForbidden();
      if (!match.active) {
        return apiError(
          "La empresa indicada está inactiva o pendiente de aprobación.",
          403,
        );
      }
    }

    const duplicateDni = await Driver.findOne({ municipalityId, dni: parsed.data.dni });
    if (duplicateDni) return apiError("Ya existe un conductor con ese DNI", 409);

    // Email único nacional — no puede haber dos cuentas con el mismo correo.
    const existingUser = await User.findOne({ email: parsed.data.email });
    if (existingUser) return apiError("Ya existe una cuenta con ese correo electrónico", 409);

    // Crear el perfil profesional del conductor
    const created = await Driver.create({
      municipalityId,
      companyId: effectiveCompanyId,
      name: parsed.data.name,
      dni: parsed.data.dni,
      licenseNumber: parsed.data.licenseNumber,
      licenseCategory: parsed.data.licenseCategory,
      licenseIssuedAt: parsed.data.licenseIssuedAt,
      licenseExpiryDate: parsed.data.licenseExpiryDate,
      phone: parsed.data.phone,
      photoUrl: parsed.data.photoUrl,
      status: parsed.data.status,
      continuousHours: parsed.data.continuousHours,
      restHours: parsed.data.restHours,
      reputationScore: parsed.data.reputationScore,
    });

    // Crear cuenta de usuario para que el conductor pueda iniciar sesión.
    // Contraseña temporal aleatoria — el conductor la cambiará en su primer login.
    const tempPassword = randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      provider: "credentials",
      municipalityId,
      companyId: effectiveCompanyId,
      dni: parsed.data.dni,
      phone: parsed.data.phone,
      role: ROLES.CONDUCTOR,
      status: USER_STATUS.ACTIVO,
      profileCompleted: true,
      mustChangePassword: true,
    });

    // Vincular el User al Driver para que `resolveDriverFromSession` funcione
    created.userId = user._id;
    await created.save();

    return apiResponse(
      {
        id: String(created._id),
        email: user.email,
        tempPassword,
        ...created.toObject(),
      },
      201,
    );
  } catch (error) {
    console.error("[conductores POST]", error);
    return apiError("Error al crear conductor", 500);
  }
}
