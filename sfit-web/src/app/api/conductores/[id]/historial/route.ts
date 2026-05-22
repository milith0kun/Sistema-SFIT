import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { DriverMembership } from "@/models/DriverMembership";
import "@/models/Company";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";

/**
 * GET /api/conductores/[id]/historial
 *
 * Devuelve el historial de membresías conductor↔empresa, ordenado del más
 * reciente al más antiguo. Sirve la vista "Historial laboral" del conductor
 * y el audit cuando el admin necesita rastrear rotaciones.
 *
 * Scope: cualquier rol con permiso "conductores"/"view" sobre la municipalidad
 * del conductor. El operador solo ve historial de conductores actualmente
 * vinculados a SU empresa.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [...rolesFor("conductores", "view")]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const driver = await Driver.findById(id)
      .select("municipalityId companyId name")
      .lean<{ municipalityId?: unknown; companyId?: unknown; name?: string } | null>();
    if (!driver) return apiNotFound("Conductor no encontrado");
    if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) {
      return apiForbidden();
    }

    // Operador: solo si el conductor está actualmente en su empresa.
    if (auth.session.role === "operador") {
      const { getOperatorCompanyId } = await import("@/lib/auth/operatorCompany");
      const myCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!myCompanyId || String(driver.companyId ?? "") !== String(myCompanyId)) {
        return apiForbidden();
      }
    }

    const memberships = await DriverMembership.find({ driverId: id })
      .populate("companyId", "razonSocial ruc")
      .populate("joinedBy", "name email")
      .populate("leftBy", "name email")
      .sort({ joinedAt: -1 })
      .lean();

    type PopulatedUser = { _id?: unknown; name?: string; email?: string } | null;
    type PopulatedCompany = { _id?: unknown; razonSocial?: string; ruc?: string } | null;

    return apiResponse({
      driverId: id,
      driverName: driver.name ?? null,
      items: memberships.map((m) => {
        const company = m.companyId as unknown as PopulatedCompany;
        const joinedBy = m.joinedBy as unknown as PopulatedUser;
        const leftBy = m.leftBy as unknown as PopulatedUser;
        return {
          id: String(m._id),
          companyId: company?._id ? String(company._id) : null,
          companyName: company?.razonSocial ?? null,
          companyRuc: company?.ruc ?? null,
          joinedAt: m.joinedAt,
          joinedByName: joinedBy?.name ?? null,
          leftAt: m.leftAt ?? null,
          leftByName: leftBy?.name ?? null,
          leftReason: m.leftReason ?? null,
          notes: m.notes ?? null,
          isOpen: !m.leftAt,
        };
      }),
    });
  } catch (error) {
    console.error("[conductores/:id/historial GET]", error);
    return apiError("Error al obtener historial", 500);
  }
}
