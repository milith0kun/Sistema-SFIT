import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { Region } from "@/models/Region";
import { User } from "@/models/User";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * POST /api/admin/migrate/sync-region-ids (super_admin)
 *
 * Migración one-shot:
 *   1. Por cada Province con `region` string → busca/crea Region por name
 *      (case-insensitive trim) y le asigna `regionId`. Idempotente.
 *   2. Para cada User con provinceId → derive regionId desde Province.regionId
 *      y persistirlo en User.regionId.
 *
 * Requiere haber corrido antes /api/admin/migrate/sync-province-ids para
 * que los Users tengan provinceId denormalizado.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    // ── Paso 1: Provinces sin regionId, crear/asociar Region por name ──
    const provs = await Province.find({
      region: { $exists: true, $ne: "" },
      $or: [{ regionId: { $exists: false } }, { regionId: null }],
    }).select("_id region").lean();

    const regionByName = new Map<string, string>();
    let regionsCreated = 0;
    let provincesLinked = 0;

    for (const p of provs) {
      const rname = (p.region ?? "").trim();
      if (!rname) continue;
      const key = rname.toLowerCase();
      let regionId = regionByName.get(key);
      if (!regionId) {
        let region = await Region.findOne({
          name: { $regex: `^${rname}$`, $options: "i" },
        }).select("_id").lean<{ _id: unknown } | null>();
        if (!region) {
          const created = await Region.create({ name: rname, active: true });
          region = { _id: created._id };
          regionsCreated++;
        }
        regionId = String(region._id);
        regionByName.set(key, regionId);
      }
      await Province.updateOne({ _id: p._id }, { $set: { regionId } });
      provincesLinked++;
    }

    // ── Paso 2: Users con provinceId pero sin regionId, derivarlo ──
    const userResult = await User.aggregate([
      {
        $match: {
          provinceId: { $exists: true, $ne: null },
          $or: [{ regionId: { $exists: false } }, { regionId: null }],
        },
      },
      {
        $lookup: {
          from: "provinces",
          localField: "provinceId",
          foreignField: "_id",
          as: "prov",
        },
      },
      { $unwind: { path: "$prov", preserveNullAndEmptyArrays: true } },
      { $match: { "prov.regionId": { $exists: true, $ne: null } } },
      { $project: { _id: 1, regionId: "$prov.regionId" } },
    ]);

    let usersLinked = 0;
    if (userResult.length > 0) {
      const bulkOps = userResult.map((doc: { _id: unknown; regionId: unknown }) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { regionId: doc.regionId } },
        },
      }));
      const r = await User.bulkWrite(bulkOps as Parameters<typeof User.bulkWrite>[0]);
      usersLinked = r.modifiedCount ?? userResult.length;
    }

    return apiResponse({
      regionsCreated,
      provincesLinked,
      usersLinked,
      regions: Array.from(regionByName.entries()).map(([k, v]) => ({ name: k, id: v })),
    });
  } catch (error) {
    console.error("[admin/migrate/sync-region-ids]", error);
    return apiError("Error en la migración", 500);
  }
}
