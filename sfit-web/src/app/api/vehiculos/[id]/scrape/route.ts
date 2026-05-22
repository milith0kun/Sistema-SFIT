/**
 * POST /api/vehiculos/[id]/scrape — Dispara scraping asíncrono para un vehículo.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { triggerVehicleScraping } from "@/lib/scraper/trigger";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;

  try {
    await connectDB();
    const vehicle = await Vehicle.findById(id).lean();

    if (!vehicle) return apiNotFound("Vehículo no encontrado");

    // Si ya está en progreso, no duplicar
    if (
      vehicle.scrapingStatus === "pending" ||
      vehicle.scrapingStatus === "in_progress"
    ) {
      return apiResponse({
        accepted: true,
        vehicleId: id,
        plate: vehicle.plate,
        message: "Scraping ya está en curso",
        status: vehicle.scrapingStatus,
      });
    }

    // Fire-and-forget
    triggerVehicleScraping(id, vehicle.plate).catch((err) => {
      console.error("[scrape] trigger failed:", err);
    });

    return apiResponse({
      accepted: true,
      vehicleId: id,
      plate: vehicle.plate,
      message: "Scraping iniciado",
    });
  } catch (error) {
    console.error("[scrape POST]", error);
    return apiError("Error al iniciar scraping", 500);
  }
}
