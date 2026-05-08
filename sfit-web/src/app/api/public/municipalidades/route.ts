import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiError } from "@/lib/api/response";

/**
 * Endpoint público — lista municipalidades activas de una provincia.
 * Usado por el formulario de registro y por LocationPicker en flujo público.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const provinceId = url.searchParams.get("provinceId");

  if (!provinceId || !isValidObjectId(provinceId)) {
    return apiError("provinceId requerido", 400);
  }

  try {
    await connectDB();
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
