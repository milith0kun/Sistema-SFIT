import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { apiResponse, apiError } from "@/lib/api/response";

/** Endpoint público — lista provincias activas para el formulario de registro */
export async function GET() {
  try {
    await connectDB();
    const items = await Province.find({ active: true })
      .sort({ name: 1 })
      .select("_id name region")
      .lean();
    return apiResponse(
      items.map((p) => ({ id: String(p._id), name: p.name, region: p.region })),
    );
  } catch {
    return apiError("Error al obtener provincias", 500);
  }
}
