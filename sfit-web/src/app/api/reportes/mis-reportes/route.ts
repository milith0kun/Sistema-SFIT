import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CIUDADANO]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

    const filter = { citizenId: auth.session.userId };

    const [items, total] = await Promise.all([
      CitizenReport.find(filter)
        .populate("vehicleId", "plate")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CitizenReport.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        category: r.category,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
        vehiclePlate: (r.vehicleId as unknown as { plate?: string } | null)?.plate,
        fraudScore: r.fraudScore,
        imageUrls: r.imageUrls ?? [],
        latitude: r.latitude,
        longitude: r.longitude,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[mis-reportes GET]", error);
    return apiError("Error al obtener tus reportes", 500);
  }
}
