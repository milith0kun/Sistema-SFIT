import { connectDB } from "@/lib/db/mongoose";
import { Region } from "@/models/Region";
import { apiResponse, apiError } from "@/lib/api/response";

/**
 * Endpoint público — lista regiones (departamentos) activas para selectores
 * en flujos sin auth (registro). Devuelve los 24 departamentos del Perú
 * según el catálogo INEI seedeado.
 */
export async function GET() {
  try {
    await connectDB();
    const items = await Region.find({ active: true })
      .sort({ name: 1 })
      .select("_id name code")
      .lean();
    return apiResponse({
      items: items.map((r) => ({
        id:     String(r._id),
        name:   r.name,
        code:   r.code,
        active: true,
      })),
      total: items.length,
    });
  } catch {
    return apiError("Error al obtener regiones", 500);
  }
}
