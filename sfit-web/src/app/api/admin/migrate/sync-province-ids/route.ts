import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * POST /api/admin/migrate/sync-province-ids (super_admin)
 *
 * Llena el campo `provinceId` en usuarios que tienen `municipalityId`
 * pero no provinceId, derivándolo de la municipalidad. Idempotente:
 * sólo procesa los que faltan.
 *
 * Necesario porque hasta ahora register/admin POST guardaban únicamente
 * municipalityId; el listado para admin_provincial filtra por provinceId
 * y devolvía vacío. Después del hook pre-save los nuevos usuarios ya
 * quedan denormalizados; este endpoint cubre los datos viejos.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    // Mongo aggregation pipeline: para cada user con muni y sin province,
    // hacer $lookup a municipalities y setear el provinceId.
    const result = await User.aggregate([
      {
        $match: {
          municipalityId: { $exists: true, $ne: null },
          $or: [{ provinceId: { $exists: false } }, { provinceId: null }],
        },
      },
      {
        $lookup: {
          from: "municipalities",
          localField: "municipalityId",
          foreignField: "_id",
          as: "muni",
        },
      },
      { $unwind: { path: "$muni", preserveNullAndEmptyArrays: true } },
      { $match: { "muni.provinceId": { $exists: true, $ne: null } } },
      { $project: { _id: 1, provinceId: "$muni.provinceId" } },
    ]);

    if (result.length === 0) {
      return apiResponse({ migrated: 0, message: "Nada que migrar — todos los usuarios ya tienen provinceId" });
    }

    // Bulk update en una sola operación
    const bulkOps = result.map((doc: { _id: mongoose.Types.ObjectId; provinceId: mongoose.Types.ObjectId }) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { provinceId: doc.provinceId } },
      },
    }));

    // bypassea los hooks pre-update porque ya estamos seteando provinceId
    // explícitamente (no estamos modificando municipalityId).
    await User.bulkWrite(bulkOps);

    // Verificación: contar cuántos quedan aún sin provinceId pero con muni
    const remaining = await User.countDocuments({
      municipalityId: { $exists: true, $ne: null },
      $or: [{ provinceId: { $exists: false } }, { provinceId: null }],
    });

    // Verificación adicional: cuántas munis sin provinceId tienen usuarios huérfanos
    const orphanMunis = await User.distinct("municipalityId", {
      municipalityId: { $exists: true, $ne: null },
      $or: [{ provinceId: { $exists: false } }, { provinceId: null }],
    });
    const orphanMuniDocs = orphanMunis.length > 0
      ? await Municipality.find({ _id: { $in: orphanMunis } }).select("_id name").lean()
      : [];

    return apiResponse({
      migrated: result.length,
      remainingWithoutProvince: remaining,
      orphanMunicipalities: orphanMuniDocs.map((m: { _id: unknown; name: string }) => ({
        id: String(m._id),
        name: m.name,
      })),
    });
  } catch (error) {
    console.error("[admin/migrate/sync-province-ids]", error);
    return apiError("Error en la migración", 500);
  }
}
