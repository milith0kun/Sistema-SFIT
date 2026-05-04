import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { Passenger } from "@/models/Passenger";
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

const UpdateSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  documentNumber: z.string().min(3).max(30).optional(),
  documentType: z.enum(["DNI", "CE", "PASSPORT"]).optional(),
  seatNumber: z.string().max(20).optional().nullable(),
  origin: z.string().max(120).optional().nullable(),
  destination: z.string().max(120).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(200),
      phone: z.string().min(3).max(30),
    })
    .optional()
    .nullable(),
  boardedAt: z.string().optional().nullable(),
});

async function authorizeTrip(
  session: { role: string; userId: string; municipalityId?: string; provinceId?: string },
  tripId: string,
): Promise<
  | { ok: true; trip: { _id: unknown; municipalityId: unknown; vehicleId: unknown } }
  | { ok: false; status: 403 | 404 }
> {
  const trip = await Trip.findById(tripId)
    .select("municipalityId vehicleId")
    .lean<{ _id: unknown; municipalityId: unknown; vehicleId: unknown } | null>();
  if (!trip) return { ok: false, status: 404 };

  if (
    !(await canAccessMunicipality(
      session as never,
      String(trip.municipalityId),
    ))
  ) {
    return { ok: false, status: 403 };
  }

  if (session.role === ROLES.OPERADOR) {
    const operatorCompanyId = await getOperatorCompanyId(session.userId);
    if (!operatorCompanyId) return { ok: false, status: 403 };
    const vehicle = await Vehicle.findById(trip.vehicleId)
      .select("companyId")
      .lean<{ companyId?: unknown } | null>();
    if (!vehicle?.companyId || String(vehicle.companyId) !== operatorCompanyId) {
      return { ok: false, status: 403 };
    }
  }

  return { ok: true, trip };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id, pid } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(pid)) {
    return apiError("ID inválido", 400);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const access = await authorizeTrip(auth.session, id);
    if (!access.ok) {
      return access.status === 404
        ? apiNotFound("Viaje no encontrado")
        : apiForbidden();
    }

    const passenger = await Passenger.findOne({ _id: pid, tripId: id });
    if (!passenger) return apiNotFound("Pasajero no encontrado");

    const updates = parsed.data;
    if (updates.fullName !== undefined) passenger.fullName = updates.fullName;
    if (updates.documentNumber !== undefined) passenger.documentNumber = updates.documentNumber;
    if (updates.documentType !== undefined) passenger.documentType = updates.documentType;
    if (updates.seatNumber !== undefined) passenger.seatNumber = updates.seatNumber ?? undefined;
    if (updates.origin !== undefined) passenger.origin = updates.origin ?? undefined;
    if (updates.destination !== undefined) passenger.destination = updates.destination ?? undefined;
    if (updates.phone !== undefined) passenger.phone = updates.phone ?? undefined;
    if (updates.emergencyContact !== undefined) {
      passenger.emergencyContact = updates.emergencyContact ?? undefined;
    }
    if (updates.boardedAt !== undefined) {
      passenger.boardedAt = updates.boardedAt ? new Date(updates.boardedAt) : undefined;
    }

    try {
      await passenger.save();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        return apiError("Documento duplicado en el viaje", 409);
      }
      throw e;
    }

    return apiResponse({
      id: String(passenger._id),
      tripId: String(passenger.tripId),
      fullName: passenger.fullName,
      documentNumber: passenger.documentNumber,
      documentType: passenger.documentType,
      seatNumber: passenger.seatNumber,
      origin: passenger.origin,
      destination: passenger.destination,
      phone: passenger.phone,
      emergencyContact: passenger.emergencyContact,
      boardedAt: passenger.boardedAt,
      updatedAt: passenger.updatedAt,
    });
  } catch (error) {
    console.error("[viajes/:id/pasajeros/:pid PATCH]", error);
    return apiError("Error al actualizar pasajero", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id, pid } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(pid)) {
    return apiError("ID inválido", 400);
  }

  try {
    await connectDB();
    const access = await authorizeTrip(auth.session, id);
    if (!access.ok) {
      return access.status === 404
        ? apiNotFound("Viaje no encontrado")
        : apiForbidden();
    }

    const result = await Passenger.findOneAndDelete({ _id: pid, tripId: id });
    if (!result) return apiNotFound("Pasajero no encontrado");

    return apiResponse({ success: true, id: pid });
  } catch (error) {
    console.error("[viajes/:id/pasajeros/:pid DELETE]", error);
    return apiError("Error al eliminar pasajero", 500);
  }
}
