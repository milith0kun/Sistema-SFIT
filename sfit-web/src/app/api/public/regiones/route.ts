import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";

/**
 * Endpoint público — lista las 25 regiones (departamentos) del Perú para
 * selectores en flujos sin auth (registro). Lee del catálogo UBIGEO
 * denormalizado en Province.departmentCode/Name (mismo origen que
 * /api/admin/red-nacional). El `id` es el departmentCode UBIGEO (2 dígitos).
 */
export async function GET() {
  try {
    await connectDB();
    const agg = await Province.aggregate<{
      _id: string;
      departmentName: string;
    }>([
      { $match: { departmentCode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$departmentCode",
          departmentName: { $first: "$departmentName" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const items = agg.map((r) => ({
      id: r._id,
      name: r.departmentName ?? "(sin nombre)",
      code: r._id,
      active: true,
    }));

    return apiResponse({ items, total: items.length });
  } catch {
    return apiError("Error al obtener regiones", 500);
  }
}
