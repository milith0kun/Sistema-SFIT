import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";

/**
 * Endpoint público — lista provincias activas para el formulario de registro.
 *
 * Acepta `?departmentCode=08` para filtrar por departamento (UBIGEO 2 dígitos),
 * lo cual permite usar el LocationPicker con cascada Departamento → Provincia
 * sin requerir auth. Sin parámetros, devuelve todas las provincias activas.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const url = new URL(request.url);
    const departmentCodeRaw = url.searchParams.get("departmentCode");

    const filter: Record<string, unknown> = { active: true };
    if (departmentCodeRaw && /^\d{2}$/.test(departmentCodeRaw)) {
      filter.departmentCode = departmentCodeRaw;
    }

    const items = await Province.find(filter)
      .sort({ departmentCode: 1, name: 1 })
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
