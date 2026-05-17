import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";
import { ACTIVE_PROVINCE_CODE } from "@/lib/scope";

/**
 * Endpoint público — lista municipalidades (distritos) activas de una
 * provincia. SFIT opera solo en Cotabambas, así que validamos que la
 * provincia solicitada coincida con el scope activo y rechazamos cualquier
 * otra para no leakar geografía fuera del despliegue.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const provinceId = url.searchParams.get("provinceId");

  if (!provinceId || !isValidObjectId(provinceId)) {
    return apiError("provinceId requerido", 400);
  }

  try {
    await connectDB();

    const province = await Province.findById(provinceId)
      .select("ubigeoCode")
      .lean<{ ubigeoCode?: string } | null>();
    if (!province || province.ubigeoCode !== ACTIVE_PROVINCE_CODE) {
      return apiError("Provincia fuera del ámbito habilitado", 404);
    }

    const items = await Municipality.find({ provinceId, active: true })
      .sort({ name: 1 })
      .select("_id name provinceId ubigeoCode")
      .lean();

    return apiResponse({
      items: items.map((m) => ({
        id:         String(m._id),
        name:       m.name,
        provinceId: String(m.provinceId),
        ubigeoCode: m.ubigeoCode,
        active:     true,
      })),
      total: items.length,
    });
  } catch {
    return apiError("Error al obtener municipalidades", 500);
  }
}
