/**
 * POST /api/rutas/[id]/marcar-preferida
 *
 * Permite al operador marcar manualmente una pasada (FleetEntry) como la
 * "mejor" para esta ruta. Tiene precedencia sobre el `isBest` automático
 * calculado por score — la UI debe mostrarla como "MEJOR (manual)".
 *
 * Body: `{ "captureId": "<fleetEntryId>" }`
 *
 * Multi-tenant: valida que tanto la ruta como la captura pertenezcan a la
 * misma empresa (companyId del operador en sesión).
 */
import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { FleetEntry } from "@/models/FleetEntry";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { resolveDriverFromSession } from "@/lib/auth/driverFromSession";
import { extractFleetEntryAsWaypoints } from "@/lib/routes/extractFleetEntry";

const Body = z.object({
  captureId: z.string().refine(isValidObjectId, "captureId inválido"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Conductor también puede marcar su propia grabación como preferida
  // (validación de pertenencia más abajo). Operador, admin municipal y
  // super_admin pueden marcar cualquier captura de su jurisdicción/empresa.
  const auth = requireRole(request, [
    ROLES.CONDUCTOR,
    ROLES.OPERADOR,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de ruta inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();

  const route = await Route.findById(id);
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) {
    return apiForbidden();
  }

  // Operador: la ruta debe pertenecer a su empresa.
  if (auth.session.role === ROLES.OPERADOR) {
    const myCompanyId = await getOperatorCompanyId(auth.session.userId);
    if (!myCompanyId) return apiError("Sin empresa asignada", 400);
    if (!route.companyId || String(route.companyId) !== String(myCompanyId)) {
      return apiForbidden("No puedes marcar pasadas en rutas de otra empresa");
    }
  }

  // La captura es una FleetEntry — debe pertenecer a un vehículo de la
  // misma empresa que la ruta. Sin esta validación un operador podría
  // marcar capturas ajenas como "preferidas".
  const capture = await FleetEntry.findById(parsed.data.captureId)
    .select("vehicleId driverId routeId")
    .lean<{
      _id: Types.ObjectId;
      vehicleId: Types.ObjectId;
      driverId: Types.ObjectId;
      routeId?: Types.ObjectId;
    }>();
  if (!capture) return apiNotFound("Pasada no encontrada");

  const vehicle = await Vehicle.findById(capture.vehicleId)
    .select("companyId")
    .lean<{ companyId?: Types.ObjectId } | null>();
  if (!vehicle || !route.companyId || String(vehicle.companyId) !== String(route.companyId)) {
    return apiForbidden("La pasada no pertenece a esta empresa");
  }

  // Conductor: solo puede marcar como preferida una FleetEntry propia.
  // Resolvemos el Driver desde la sesión (User → Driver vía userId o
  // fallback DNI) y comparamos con `capture.driverId`.
  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await resolveDriverFromSession(auth.session);
    if (!driver || String(driver._id) !== String(capture.driverId)) {
      return apiForbidden(
        "Solo puedes marcar como recomendada una grabación tuya",
      );
    }
  }

  // Recomendación: la captura debe ser de la misma ruta. No bloqueamos
  // si difiere (puede ser una captura de un corredor afín que el operador
  // quiere promover) pero sí lo registramos.
  const sameRoute = capture.routeId && String(capture.routeId) === String(route._id);

  route.preferredCaptureId = capture._id;
  route.preferredAt = new Date();
  route.preferredBy = new Types.ObjectId(auth.session.userId);

  // Peso 100% a la preferida: reescribimos `route.waypoints` con los
  // puntos GPS de esta FleetEntry (filtrados por accuracy, simplificados
  // con RDP y resampleados). Antes solo guardábamos el ID y el conductor
  // seguía viendo el promedio convergente o los waypoints originales.
  // Ahora el siguiente turno arranca con la ruta elegida.
  const extracted = await extractFleetEntryAsWaypoints(capture._id);
  let waypointsReplaced = false;
  if (extracted.waypoints.length >= 2) {
    route.waypoints = extracted.waypoints.map((p, i) => ({
      order: i,
      lat: p.lat,
      lng: p.lng,
    })) as typeof route.waypoints;
    waypointsReplaced = true;
  }

  await route.save();

  // Recompute geometry real (Google Routes snap-to-roads) tras reescribir
  // waypoints. Fire-and-forget para no bloquear la respuesta — el mapa cae
  // al fallback de líneas rectas si Google está caído. Mismo patrón que en
  // `/api/rutas/[id]/recalcular`.
  if (waypointsReplaced && route.waypoints.length >= 2) {
    void (async () => {
      try {
        const { routeAlongWaypoints } = await import(
          "@/lib/routing/routingService"
        );
        const geom = await routeAlongWaypoints(
          route.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
        );
        await Route.findByIdAndUpdate(route._id, {
          polylineGeometry: geom
            ? {
                coords: geom.coords,
                distanceMeters: geom.distanceMeters,
                durationSecondsBaseline: geom.durationSeconds,
                computedAt: new Date(),
              }
            : null,
        });
      } catch (err) {
        console.warn(
          "[rutas/[id]/marcar-preferida] recompute geometry failed",
          err,
        );
      }
    })();
  }

  try {
    const { logAuditRaw } = await import("@/lib/audit/log");
    await logAuditRaw(
      request,
      {
        actorId: auth.session.userId,
        actorRole: auth.session.role,
        municipalityId: auth.session.municipalityId,
        provinceId: auth.session.provinceId,
      },
      {
        action: "route.preferred_capture.set",
        resourceType: "route",
        resourceId: String(route._id),
        metadata: {
          captureId: String(capture._id),
          sameRoute,
          waypointsReplaced,
          waypointCount: extracted.waypoints.length,
        },
      },
    );
  } catch { /* audit no debe bloquear */ }

  return apiResponse({
    routeId: String(route._id),
    preferredCaptureId: String(capture._id),
    preferredAt: route.preferredAt,
    sameRoute,
    waypointsReplaced,
    waypointCount: extracted.waypoints.length,
    totalPings: extracted.totalPings,
    filteredByAccuracy: extracted.filteredByAccuracy,
  });
}

/**
 * DELETE — limpia el override manual; vuelve a usar el `isBest` automático.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.OPERADOR,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de ruta inválido", 400);

  await connectDB();
  const route = await Route.findById(id);
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) {
    return apiForbidden();
  }
  if (auth.session.role === ROLES.OPERADOR) {
    const myCompanyId = await getOperatorCompanyId(auth.session.userId);
    if (!myCompanyId || !route.companyId || String(route.companyId) !== String(myCompanyId)) {
      return apiForbidden();
    }
  }

  route.preferredCaptureId = undefined;
  route.preferredAt = undefined;
  route.preferredBy = undefined;
  await route.save();

  return apiResponse({ routeId: String(route._id), cleared: true });
}
