import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import {
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { generatePassengerManifestExcel } from "@/lib/exports/passengerManifest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    await connectDB();
    const trip = await Trip.findById(id)
      .select("municipalityId vehicleId")
      .lean<{ municipalityId: unknown; vehicleId: unknown } | null>();
    if (!trip) return apiNotFound("Viaje no encontrado");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(trip.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    if (auth.session.role === ROLES.OPERADOR) {
      const operatorCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!operatorCompanyId) return apiForbidden();
      const vehicle = await Vehicle.findById(trip.vehicleId)
        .select("companyId")
        .lean<{ companyId?: unknown } | null>();
      if (!vehicle?.companyId || String(vehicle.companyId) !== operatorCompanyId) {
        return apiForbidden();
      }
    }

    const { buffer, filename } = await generatePassengerManifestExcel(id);

    // Devolver el buffer como descarga. Copiamos a un ArrayBuffer fresco —
    // mismo patrón que /api/uploads/files/[id] para evitar problemas con
    // el view del Buffer original cuando Next serializa la respuesta.
    const body = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(body).set(
      new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[viajes/:id/manifiesto.xlsx GET]", error);
    return apiError("Error al generar el manifiesto", 500);
  }
}
