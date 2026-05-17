import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";
import { ACTIVE_DEPARTMENT_CODE } from "@/lib/scope";

/**
 * Endpoint público — lista las regiones (departamentos) habilitadas para
 * selectores en flujos sin auth (registro). SFIT opera exclusivamente en
 * Apurímac, así que esta lista contiene un único elemento aunque la BD
 * tenga sembradas más regiones.
 */
export async function GET() {
  try {
    await connectDB();
    const agg = await Province.aggregate<{
      _id: string;
      departmentName: string;
    }>([
      { $match: { departmentCode: ACTIVE_DEPARTMENT_CODE } },
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
