import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Route } from "@/models/Route";
import "@/models/Vehicle";
import { apiResponse, apiError } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import type { ICurrentLocation, IVisitedStop } from "@/models/FleetEntry";

/**
 * GET /api/public/flota/activas?municipalityId=<id>
 *
 * Endpoint público (sin auth) para ciudadanos: lista los buses con turno
 * activo (en_ruta) con su posición GPS, ruta y ETA al próximo paradero.
 * No expone datos del conductor (anonimizado).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const municipalityId = url.searchParams.get("municipalityId");

  if (!municipalityId || !isValidObjectId(municipalityId)) {
    return apiResponse({ items: [], total: 0 });
  }

  await connectDB();

  const entries = await FleetEntry.find({
    status: "en_ruta",
    municipalityId,
    "currentLocation.lat": { $exists: true },
    "currentLocation.lng": { $exists: true },
  })
    .populate("vehicleId", "plate brand model vehicleTypeKey status")
    .populate("routeId")
    .select("vehicleId routeId currentLocation visitedStops departureTime")
    .lean();

  const items = entries
    .filter((e) => {
      const loc = e.currentLocation as ICurrentLocation | undefined;
      return loc?.lat != null && loc?.lng != null;
    })
    .map((e) => {
      const loc = e.currentLocation as ICurrentLocation;
      const vehicle = e.vehicleId as {
        plate?: string;
        brand?: string;
        model?: string;
        vehicleTypeKey?: string;
        status?: string;
      } | null;
      const route = e.routeId as {
        _id?: unknown;
        name?: string;
        code?: string;
        waypoints?: Array<{ lat: number; lng: number; label?: string; order: number }>;
      } | null;

      // ── Calcular próximo paradero y ETA ──
      const waypoints = (route?.waypoints ?? []).sort((a, b) => a.order - b.order);
      const visited = (e.visitedStops ?? []) as IVisitedStop[];
      const maxVisitedOrder = visited.length > 0
        ? Math.max(...visited.map((s) => s.stopIndex))
        : -1;
      const nextWp = waypoints.find((w) => w.order > maxVisitedOrder);

      let nextStop: { label: string; lat: number; lng: number; etaSeconds: number } | null = null;
      if (nextWp) {
        const dist = haversineMeters(
          { lat: loc.lat, lng: loc.lng },
          { lat: nextWp.lat, lng: nextWp.lng },
        );
        // Velocidad: usar speed real si > 0.5 m/s, sino 4.17 m/s (15 km/h urbano)
        const speed = (loc.speed ?? 0) > 0.5 ? loc.speed! : 4.17;
        nextStop = {
          label: nextWp.label ?? `Paradero ${nextWp.order + 1}`,
          lat: nextWp.lat,
          lng: nextWp.lng,
          etaSeconds: Math.round(dist / speed),
        };
      }

      return {
        id: String(e._id),
        plate: vehicle?.plate ?? "—",
        vehicleType: vehicle?.vehicleTypeKey ?? "omnibus",
        vehicleStatus: vehicle?.status ?? "apto",
        route: route
          ? {
              id: String(route._id),
              name: route.name ?? "—",
              code: route.code ?? null,
              waypoints: waypoints.map((w) => ({
                lat: w.lat,
                lng: w.lng,
                label: w.label,
                order: w.order,
              })),
            }
          : null,
        currentLocation: {
          lat: loc.lat,
          lng: loc.lng,
          updatedAt: loc.updatedAt,
          speed: loc.speed ?? null,
        },
        nextStop,
      };
    });

  return apiResponse({ items, total: items.length });
}
