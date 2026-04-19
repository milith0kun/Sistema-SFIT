import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { CitizenReport } from "@/models/CitizenReport";
import { Apelacion } from "@/models/Apelacion";
import { Sanction } from "@/models/Sanction";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

type ActivityItem = {
  type: "inspeccion" | "reporte" | "apelacion" | "sancion";
  title: string;
  subtitle: string;
  date: string;
  href: string;
};

/**
 * GET /api/admin/actividad
 * Devuelve las 10 acciones más recientes combinadas:
 * últimas 3 inspecciones + 3 apelaciones + 3 reportes + 3 sanciones,
 * mezcladas y ordenadas por fecha desc.
 *
 * Roles: super_admin, admin_provincial, admin_municipal, fiscal
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    // Build municipality filter for non-super-admin users
    const muniFilter =
      auth.session.role === ROLES.SUPER_ADMIN || auth.session.role === ROLES.ADMIN_PROVINCIAL
        ? {}
        : { municipalityId: auth.session.municipalityId };

    const [inspecciones, reportes, apelaciones, sanciones] = await Promise.all([
      Inspection.find(muniFilter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select("vehicleId result createdAt municipalityId")
        .populate("vehicleId", "plate")
        .lean(),
      CitizenReport.find(muniFilter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select("category status createdAt citizenId")
        .populate("citizenId", "name")
        .lean(),
      Apelacion.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .select("reason status createdAt inspectionId")
        .lean(),
      Sanction.find(muniFilter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select("faultType status amountSoles createdAt vehicleId")
        .populate("vehicleId", "plate")
        .lean(),
    ]);

    const items: ActivityItem[] = [];

    for (const insp of inspecciones) {
      const vehicle = insp.vehicleId as unknown as { plate?: string } | null;
      items.push({
        type: "inspeccion",
        title: `Inspección ${insp.result ?? "registrada"}`,
        subtitle: vehicle?.plate ? `Vehículo ${vehicle.plate}` : "Vehículo s/d",
        date: String(insp.createdAt),
        href: `/inspecciones/${String(insp._id)}`,
      });
    }

    for (const rep of reportes) {
      const citizen = rep.citizenId as unknown as { name?: string } | null;
      items.push({
        type: "reporte",
        title: `Reporte: ${String(rep.category ?? "Ciudadano")}`,
        subtitle: citizen?.name ? `Por ${citizen.name}` : "Ciudadano anónimo",
        date: String(rep.createdAt),
        href: `/reportes/${String(rep._id)}`,
      });
    }

    for (const ap of apelaciones) {
      items.push({
        type: "apelacion",
        title: `Apelación ${String(ap.status ?? "pendiente")}`,
        subtitle: ap.reason ? String(ap.reason).slice(0, 60) : "Sin motivo registrado",
        date: String(ap.createdAt),
        href: `/apelaciones/${String(ap._id)}`,
      });
    }

    for (const sanc of sanciones) {
      const vehicle = sanc.vehicleId as unknown as { plate?: string } | null;
      items.push({
        type: "sancion",
        title: `Sanción: ${String(sanc.faultType ?? "emitida")}`,
        subtitle: vehicle?.plate ? `Vehículo ${vehicle.plate} · S/ ${sanc.amountSoles}` : `S/ ${sanc.amountSoles}`,
        date: String(sanc.createdAt),
        href: `/sanciones/${String(sanc._id)}`,
      });
    }

    // Sort by date descending, take top 10
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const top10 = items.slice(0, 10);

    return apiResponse({ items: top10 });
  } catch (error) {
    console.error("[admin/actividad GET]", error);
    return apiError("Error al obtener actividad reciente", 500);
  }
}
