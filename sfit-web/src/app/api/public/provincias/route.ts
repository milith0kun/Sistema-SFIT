import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";
import { ACTIVE_DEPARTMENT_CODE } from "@/lib/scope";

/**
 * Endpoint público — lista provincias activas dentro del scope habilitado
 * (Apurímac → Cotabambas). El query param `?departmentCode=` se ignora si
 * difiere del scope activo, para evitar que clientes públicos descubran
 * provincias fuera de la operación.
 */
export async function GET() {
  try {
    await connectDB();

    const items = await Province.find({
      active: true,
      departmentCode: ACTIVE_DEPARTMENT_CODE,
    })
      .sort({ name: 1 })
      .select("_id name region departmentCode departmentName ubigeoCode")
      .lean();

    return apiResponse({
      items: items.map((p) => ({
        id:             String(p._id),
        name:           p.name,
        region:         p.region,
        departmentCode: p.departmentCode,
        departmentName: p.departmentName,
        ubigeoCode:     p.ubigeoCode,
      })),
      total: items.length,
    });
  } catch {
    return apiError("Error al obtener provincias", 500);
  }
}
