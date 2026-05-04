import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const WaypointInputSchema = z.object({
  order: z.number().int().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(100).optional(),
});

const UpdateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(200).optional(),
  type: z.enum(["ruta", "zona"]).optional(),
  stops: z.number().min(0).optional(),
  length: z.string().max(20).optional(),
  area: z.string().max(20).optional(),
  vehicleTypeKey: z.string().optional(),
  companyId: z.string().refine(isValidObjectId).optional().nullable(),
  vehicleCount: z.number().min(0).optional(),
  status: z.enum(["activa", "suspendida"]).optional(),
  frequencies: z.array(z.string().max(80)).optional(),
  waypoints: z.array(WaypointInputSchema).max(200).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const r = await Route.findById(id).populate("companyId", "razonSocial").lean();
  if (!r) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(r.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(r._id), ...r, companyName: (r.companyId as { razonSocial?: string } | null)?.razonSocial });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Operador (gestor de flota de empresa) también puede editar rutas asignadas a su empresa.
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const route = await Route.findById(id);
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  // Operador: solo puede editar rutas asignadas a su empresa
  if (auth.session.role === ROLES.OPERADOR) {
    const { Driver } = await import("@/models/Driver");
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("companyId").lean();
    const driverCompanyId = driver && typeof driver === "object" && "companyId" in driver
      ? String(driver.companyId) : null;
    if (!driverCompanyId || !route.companyId || driverCompanyId !== String(route.companyId)) {
      return apiForbidden("No puedes editar rutas de otra empresa");
    }
  }

  // Detectamos si los waypoints cambiaron — solo en ese caso recomputamos
  // la geometría real con Google Routes API.
  const waypointsChanged = parsed.data.waypoints !== undefined;

  Object.assign(route, parsed.data);
  await route.save();

  // Recompute geometry siguiendo calles reales si los waypoints cambiaron.
  // No bloquea la respuesta — corre fire-and-forget. La app cae al fallback
  // de líneas rectas hasta que termine.
  if (waypointsChanged && route.waypoints.length >= 2) {
    void (async () => {
      try {
        const { routeAlongWaypoints } = await import("@/lib/routing/routingService");
        const geom = await routeAlongWaypoints(
          route.waypoints.map(w => ({ lat: w.lat, lng: w.lng })),
        );
        if (geom) {
          await Route.findByIdAndUpdate(route._id, {
            polylineGeometry: {
              coords: geom.coords,
              distanceMeters: geom.distanceMeters,
              durationSecondsBaseline: geom.durationSeconds,
              computedAt: new Date(),
            },
          });
        } else {
          // Limpia geometry stale si Google falla — es preferible mostrar
          // líneas rectas que una geometría obsoleta de waypoints viejos.
          await Route.findByIdAndUpdate(route._id, { polylineGeometry: null });
        }
      } catch (err) {
        console.warn("[rutas/[id]] recompute geometry failed", err);
      }
    })();
  }

  // Auditoría de edición
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
        action: "route.update",
        resourceType: "route",
        resourceId: String(route._id),
        metadata: { updatedFields: Object.keys(parsed.data) },
      },
    );
  } catch { /* silent — audit failure must not block the response */ }

  return apiResponse({ id: String(route._id), ...route.toObject() });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const route = await Route.findById(id);
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  route.status = "suspendida";
  await route.save();
  return apiResponse({ success: true });
}
