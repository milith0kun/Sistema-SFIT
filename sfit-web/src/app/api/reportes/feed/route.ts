import { NextRequest } from "next/server";
import { Types, isValidObjectId, type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { ReportApoyo } from "@/models/ReportApoyo";
import { User } from "@/models/User";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";

/**
 * GET /api/reportes/feed
 * Feed público de reportes ciudadanos validados, estilo red social.
 *
 * Query params:
 *   - region: 'all' | 'province' | 'municipality' (default: 'municipality').
 *     En el modelo post-cleanup donde el sistema opera sobre una sola
 *     municipalidad institucional, los 3 valores devuelven el mismo
 *     resultado en la práctica. Se mantiene el param por compat.
 *   - category: string opcional (filtra por categoría exacta).
 *   - order: 'recent' | 'supported' (default: 'recent').
 *   - mine: 'true' | 'false' (default: 'false'). Si true, ignora el filtro
 *     de visibilidad pública y devuelve TODOS los reportes del ciudadano
 *     autenticado (cualquier status). Sirve para la vista "Solo míos".
 *   - page, limit: paginación (limit máx 50).
 *
 * Solo retorna reportes con status='validado', excepto cuando son propios.
 * Anonimiza al ciudadano (solo primer nombre + inicial).
 * Incluye conteo de apoyos y si el usuario actual los apoyó.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("reportes", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    const url = new URL(request.url);
    const region = (url.searchParams.get("region") ?? "municipality") as "all" | "province" | "municipality";
    const category = url.searchParams.get("category") ?? undefined;
    const order = (url.searchParams.get("order") ?? "recent") as "recent" | "supported";
    const mine = url.searchParams.get("mine") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

    // Resolver tenant del usuario autenticado (los ciudadanos suelen no traerlo en el JWT).
    let userMunicipalityId: string | null = auth.session.municipalityId ?? null;
    let userProvinceId: string | null = auth.session.provinceId ?? null;

    if (region !== "all" && (!userMunicipalityId || !userProvinceId)) {
      const me = await User.findById(auth.session.userId).select("municipalityId provinceId").lean();
      userMunicipalityId = userMunicipalityId ?? (me?.municipalityId ? String(me.municipalityId) : null);
      userProvinceId = userProvinceId ?? (me?.provinceId ? String(me.provinceId) : null);
    }

    // Filtro base por categoría y región (se aplica tanto a reportes
    // validados como a reportes propios pendientes).
    const baseFilter: Record<string, unknown> = {};
    if (category) baseFilter.category = category;

    if (region === "municipality") {
      if (!userMunicipalityId || !isValidObjectId(userMunicipalityId)) {
        return apiResponse({ items: [], total: 0, hasMore: false });
      }
      // Aggregate $match no autocasta strings → ObjectId como find() lo hace.
      // Hay que convertir explícitamente para que el filtro encuentre docs.
      baseFilter.municipalityId = new Types.ObjectId(userMunicipalityId);
    } else if (region === "province") {
      if (!userProvinceId || !isValidObjectId(userProvinceId)) {
        return apiResponse({ items: [], total: 0, hasMore: false });
      }
      // Provincia: cubre todos los reportes cuyas municipalidades pertenezcan a esa provincia
      const Municipality = (await import("@/models/Municipality")).Municipality;
      const munIds = await Municipality.find({ provinceId: userProvinceId }).select("_id").lean();
      baseFilter.municipalityId = { $in: munIds.map((m) => m._id) };
    }

    // Filtro de visibilidad estilo red social:
    // - mine=true → todos los reportes del propio ciudadano sin importar status.
    // - mine=false → reportes con status='validado' (visibles a todos) +
    //   reportes propios con status pendiente/en_revisión (UX estilo
    //   Instagram: "tu publicación está en revisión").
    const myCitizenId = new Types.ObjectId(auth.session.userId);
    const filter: Record<string, unknown> = mine
      ? { ...baseFilter, citizenId: myCitizenId }
      : {
          ...baseFilter,
          $or: [
            { status: "validado" },
            {
              citizenId: myCitizenId,
              status: { $in: ["pendiente", "en_revision"] },
            },
          ],
        };

    // Pipeline con conteo de apoyos
    const skip = (page - 1) * limit;
    const sortStage: PipelineStage = order === "supported"
      ? { $sort: { apoyosCount: -1, createdAt: -1 } }
      : { $sort: { createdAt: -1 } };

    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: "reportapoyos",
          localField: "_id",
          foreignField: "reportId",
          as: "apoyos",
        },
      },
      {
        $addFields: {
          apoyosCount: { $size: "$apoyos" },
        },
      },
      sortStage,
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "vehicles",
          localField: "vehicleId",
          foreignField: "_id",
          as: "vehicle",
        },
      },
      { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "citizenId",
          foreignField: "_id",
          as: "citizen",
        },
      },
      { $unwind: { path: "$citizen", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "municipalities",
          localField: "municipalityId",
          foreignField: "_id",
          as: "municipality",
        },
      },
      { $unwind: { path: "$municipality", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "provinces",
          localField: "municipality.provinceId",
          foreignField: "_id",
          as: "province",
        },
      },
      { $unwind: { path: "$province", preserveNullAndEmptyArrays: true } },
    ];

    const [items, total] = await Promise.all([
      CitizenReport.aggregate(pipeline),
      CitizenReport.countDocuments(filter),
    ]);

    // Apoyos del usuario actual (qué reportes ha apoyado)
    const itemIds = items.map((r) => r._id);
    const myApoyos = await ReportApoyo.find({
      userId: auth.session.userId,
      reportId: { $in: itemIds },
    }).select("reportId").lean();
    const myApoyosSet = new Set(myApoyos.map((a) => String(a.reportId)));

    return apiResponse({
      items: items.map((r) => {
        const isMine = String(r.citizenId) === String(auth.session.userId);
        return {
          id: String(r._id),
          category: r.category,
          description: r.description,
          imageUrls: r.imageUrls ?? [],
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          createdAt: r.createdAt,
          status: r.status,
          isMine,
          vehicle: r.vehicle ? {
            plate: r.vehicle.plate,
            brand: r.vehicle.brand,
            model: r.vehicle.model,
          } : null,
          citizenName: anonymizeName(r.citizen?.name),
          municipalityName: r.municipality?.name ?? null,
          provinceName: r.province?.name ?? null,
          apoyosCount: r.apoyosCount ?? 0,
          apoyado: myApoyosSet.has(String(r._id)),
        };
      }),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    });
  } catch (error) {
    console.error("[reportes/feed GET]", error);
    return apiError("Error al cargar el feed", 500);
  }
}

function anonymizeName(name: string | undefined | null): string {
  if (!name) return "Ciudadano";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}
