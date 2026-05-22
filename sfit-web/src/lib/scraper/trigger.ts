/**
 * Fire-and-forget trigger hacia el microservicio Python de scraping.
 *
 * Se llama después de crear un vehículo para iniciar scraping asíncrono
 * desde SUNARP, MTC CITV y SOAT sin bloquear la respuesta HTTP.
 */

import { VehicleScrapingResult } from "@/models/VehicleScrapingResult";
import { Vehicle } from "@/models/Vehicle";

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL ?? "http://127.0.0.1:8001";
const SCRAPER_TOKEN = process.env.SCRAPER_INTERNAL_TOKEN ?? "sfit_scraper_internal_prod_2026";

export function normalizePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

export async function triggerVehicleScraping(
  vehicleId: string,
  plate: string,
): Promise<void> {
  const normalized = normalizePlate(plate);

  if (normalized.length !== 6) {
    console.warn("[scraper] Placa inválida para scraping:", plate);
    return;
  }

  // Marcar vehículo como pending
  await Vehicle.updateOne(
    { _id: vehicleId },
    {
      $set: {
        scrapingStatus: "pending",
        scrapingRequestedAt: new Date(),
      },
    },
  );

  // Disparar al microservicio Python (fire-and-forget)
  fetch(`${SCRAPER_URL}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SCRAPER_TOKEN}`,
    },
    body: JSON.stringify({ vehicleId, plate: normalized }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => {
    console.error("[scraper] No se pudo contactar al servicio de scraping:", err.message);
  });
}

export async function getVehicleScrapingStatus(vehicleId: string) {
  const vehicle = await Vehicle.findById(vehicleId).select("scrapingStatus scrapingRequestedAt scrapingCompletedAt").lean();
  const results = await VehicleScrapingResult.find({ vehicleId }).lean();

  const sources: Record<string, unknown> = {};
  for (const r of results) {
    sources[r.source] = {
      source: r.source,
      status: r.status,
      data: r.rawData,
      error: r.errorMessage,
      captchaCost: r.captchaCost,
      durationMs: r.durationMs,
      completedAt: r.completedAt,
    };
  }

  return {
    vehicleId,
    plate: results[0]?.plate ?? "",
    overallStatus: vehicle?.scrapingStatus ?? "idle",
    requestedAt: vehicle?.scrapingRequestedAt ?? null,
    completedAt: vehicle?.scrapingCompletedAt ?? null,
    sources,
  };
}
