import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { FleetEntry } from "@/models/FleetEntry";
import { RouteCapture } from "@/models/RouteCapture";
import "@/models/Municipality";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import { samplePolyline } from "@/lib/routes/sample";

const STALE_LOCATION_THRESHOLD_MS = 2 * 60_000; // 2 min — coincide con /flota/activas
const BBOX_DELTA_DEG = 0.3; // ~33 km — radio típico de un bus urbano

type WaypointLite = { order: number; lat: number; lng: number; label?: string };

/**
 * GET /api/public/rutas?lat=&lng=&municipalityId=&limit=
 *
 * Endpoint público (sin auth) que lista rutas activas para que el ciudadano
 * vea TODO lo cercano sin importar el municipio que las administra.
 *
 * - Si vienen `lat`/`lng`: aplica bounding box ±0.3° (~33 km) usando el
 *   primer waypoint de cada ruta como referencia, y ordena por cercanía.
 * - Si NO vienen: devuelve todas las rutas activas (con `limit`).
 * - `municipalityId` es opcional. Si viene, restringe al tenant; si no,
 *   incluye todos los tenants. Mantenido por compat con el cliente viejo.
 *
 * Cada ítem incluye `municipalityName` para que la app pueda mostrar
 * "Ruta C-1 · Cusco" o "Ruta SJ-2 · San Jerónimo" y el usuario sepa de
 * qué jurisdicción es.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const municipalityId = url.searchParams.get("municipalityId");
  const userLatStr = url.searchParams.get("lat");
  const userLngStr = url.searchParams.get("lng");
  const limit = Math.min(150, Math.max(1, Number(url.searchParams.get("limit") ?? 60)));
  const includeCandidates = url.searchParams.get("includeCandidates") === "true";

  const userLat = userLatStr != null && userLatStr !== "" ? Number(userLatStr) : null;
  const userLng = userLngStr != null && userLngStr !== "" ? Number(userLngStr) : null;
  const hasUserCoords =
    userLat != null && userLng != null &&
    !Number.isNaN(userLat) && !Number.isNaN(userLng) &&
    userLat >= -90 && userLat <= 90 &&
    userLng >= -180 && userLng <= 180;

  await connectDB();

  // Filtros: municipalityId solo si viene; resto siempre.
  const baseFilter: Record<string, unknown> = { status: "activa" };
  if (municipalityId && isValidObjectId(municipalityId)) {
    baseFilter.municipalityId = municipalityId;
  }
  // Bounding box geográfico cuando hay GPS — buscamos rutas que tengan al
  // menos un waypoint dentro de ±0.3° del usuario. No es perfecto (rutas
  // largas con un waypoint cercano y otro lejano caben), pero alcanza para
  // filtrar a escala de país y mantener el response chico.
  if (hasUserCoords) {
    baseFilter["waypoints"] = {
      $elemMatch: {
        lat: { $gte: userLat - BBOX_DELTA_DEG, $lte: userLat + BBOX_DELTA_DEG },
        lng: { $gte: userLng - BBOX_DELTA_DEG, $lte: userLng + BBOX_DELTA_DEG },
      },
    };
  }

  const routes = await Route.find(baseFilter)
    .populate("municipalityId", "name ubigeoCode")
    .select("name code waypoints polylineGeometry direction vehicleTypeKey serviceScope municipalityId")
    .lean();

  // NOTA: ya NO retornamos temprano si routes.length === 0. Antes había un
  // bug donde el early return cortaba ANTES del bloque `if (includeCandidates)`,
  // así que el ciudadano nunca veía las RouteCapture candidatas en zonas
  // donde no hay Route oficial todavía (caso típico al lanzar el servicio
  // en un municipio nuevo). Ahora seguimos para evaluar candidatas.

  // Buses transmitiendo agrupados por ruta — solo del subset que devolvemos.
  // Si no hay rutas oficiales, este lookup no encuentra nada y el `Map` queda
  // vacío; el resto del flujo lo maneja sin problema.
  const activeEntries = routes.length === 0 ? [] : await FleetEntry.find({
    status: "en_ruta",
    routeId: { $in: routes.map((r) => r._id) },
    "currentLocation.updatedAt": { $gte: new Date(Date.now() - STALE_LOCATION_THRESHOLD_MS) },
  })
    .select("routeId")
    .lean();

  const activeCountByRoute = new Map<string, number>();
  for (const e of activeEntries) {
    const rid = String(e.routeId);
    activeCountByRoute.set(rid, (activeCountByRoute.get(rid) ?? 0) + 1);
  }

  const items = routes.map((r) => {
    const waypoints = ((r.waypoints ?? []) as WaypointLite[])
      .slice()
      .sort((a, b) => a.order - b.order);

    let nearestStop: {
      stopIndex: number;
      label: string;
      lat: number;
      lng: number;
      distanceFromUserMeters: number;
    } | null = null;

    if (hasUserCoords && waypoints.length > 0) {
      let bestDist = Number.POSITIVE_INFINITY;
      let bestWp: WaypointLite | null = null;
      for (const wp of waypoints) {
        const d = haversineMeters(
          { lat: userLat, lng: userLng },
          { lat: wp.lat, lng: wp.lng },
        );
        if (d < bestDist) {
          bestDist = d;
          bestWp = wp;
        }
      }
      if (bestWp) {
        nearestStop = {
          stopIndex: bestWp.order,
          label: bestWp.label ?? `Paradero ${bestWp.order + 1}`,
          lat: bestWp.lat,
          lng: bestWp.lng,
          distanceFromUserMeters: Math.round(bestDist),
        };
      }
    }

    const muni = r.municipalityId as { _id?: unknown; name?: string; ubigeoCode?: string } | null;

    return {
      routeId: String(r._id),
      name: r.name,
      code: (r.code ?? null) as string | null,
      direction: r.direction ?? null,
      vehicleTypeKey: r.vehicleTypeKey ?? null,
      municipalityId: muni?._id ? String(muni._id) : null,
      municipalityName: muni?.name ?? null,
      activeBusCount: activeCountByRoute.get(String(r._id)) ?? 0,
      waypoints: waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label,
        order: w.order,
      })),
      polylineCoords: r.polylineGeometry?.coords ?? null,
      nearestStop,
      validated: true as boolean,
    };
  });

  // includeCandidates: capturas en status="candidate" se devuelven como
  // rutas no oficiales (validated:false). El cliente decide si mostrarlas.
  // Mantiene back-compat: clientes viejos no envían el flag y no las ven.
  if (includeCandidates) {
    const capFilter: Record<string, unknown> = { status: "candidate" };
    if (municipalityId && isValidObjectId(municipalityId)) {
      capFilter.municipalityId = municipalityId;
    }
    const captures = await RouteCapture.find(capFilter)
      .select("_id municipalityId points pointCount distanceMeters durationSeconds proposedName proposedCode createdAt")
      .populate("municipalityId", "name ubigeoCode")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const c of captures) {
      const pts = (c.points ?? []) as Array<{ lat: number; lng: number }>;
      if (pts.length < 2) continue;

      // No aplicamos bbox filter a candidatas: el operador necesita verlas
      // todas para validarlas, y un ciudadano de zona vecina debe poder ver
      // las rutas no oficiales que circulan cerca aunque su GPS apunte a
      // otro distrito. El `limit(50)` + orden por createdAt ya acota.

      let nearestStop: typeof items[number]["nearestStop"] = null;
      if (hasUserCoords) {
        let bestDist = Number.POSITIVE_INFINITY;
        let bestIdx = 0;
        for (let i = 0; i < pts.length; i++) {
          const d = haversineMeters(
            { lat: userLat, lng: userLng },
            { lat: pts[i].lat, lng: pts[i].lng },
          );
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        nearestStop = {
          stopIndex: bestIdx,
          label: `Punto ${bestIdx}`,
          lat: pts[bestIdx].lat,
          lng: pts[bestIdx].lng,
          distanceFromUserMeters: Math.round(bestDist),
        };
      }

      const muni = c.municipalityId as { _id?: unknown; name?: string } | null;
      const sample = samplePolyline(pts, 60);

      items.push({
        routeId: String(c._id),
        name: c.proposedName ?? "Ruta sin nombre",
        code: c.proposedCode ?? null,
        direction: null,
        vehicleTypeKey: null,
        municipalityId: muni?._id ? String(muni._id) : null,
        municipalityName: muni?.name ?? null,
        activeBusCount: 0,
        // No hay waypoints oficiales — usamos samplePolyline como aproximación.
        waypoints: sample.map(([lat, lng], idx) => ({
          lat,
          lng,
          label: undefined,
          order: idx,
        })),
        polylineCoords: sample,
        nearestStop,
        validated: false,
      });
    }
  }

  // Orden: si hay GPS → paradero más cercano primero; si no → rutas con buses
  // activos primero, luego alfabético por código/nombre.
  if (hasUserCoords) {
    items.sort((a, b) => {
      const da = a.nearestStop?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      const db = b.nearestStop?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  } else {
    items.sort((a, b) => {
      if (a.activeBusCount !== b.activeBusCount) return b.activeBusCount - a.activeBusCount;
      return (a.code ?? a.name).localeCompare(b.code ?? b.name);
    });
  }

  const limited = items.slice(0, limit);
  return apiResponse({ items: limited, total: items.length });
}
