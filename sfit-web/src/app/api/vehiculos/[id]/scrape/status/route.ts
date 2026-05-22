/**
 * GET /api/vehiculos/[id]/scrape/status — Estado y resultados del scraping.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { apiResponse, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { VehicleScrapingResult } from "@/models/VehicleScrapingResult";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;

  await connectDB();

  const vehicle = await Vehicle.findById(id)
    .select("scrapingStatus scrapingRequestedAt scrapingCompletedAt plate")
    .lean();

  if (!vehicle) return apiNotFound("Vehículo no encontrado");

  const results = await VehicleScrapingResult.find({ vehicleId: id })
    .select("source status rawData errorMessage captchaCost durationMs completedAt")
    .lean();

  const sources: Record<string, unknown> = {};
  for (const r of results) {
    sources[r.source] = {
      source: r.source,
      status: r.status,
      data: r.rawData,
      error: r.errorMessage ?? null,
      captchaCost: r.captchaCost,
      durationMs: r.durationMs,
      completedAt: r.completedAt ?? null,
    };
  }

  return apiResponse({
    vehicleId: id,
    plate: vehicle.plate,
    overallStatus: vehicle.scrapingStatus ?? "idle",
    requestedAt: vehicle.scrapingRequestedAt ?? null,
    completedAt: vehicle.scrapingCompletedAt ?? null,
    sources,
  });
}
