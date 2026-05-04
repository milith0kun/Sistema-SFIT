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

const PassengerInputSchema = z.object({
  fullName: z.string().min(2).max(200),
  documentNumber: z.string().min(3).max(30),
  documentType: z.enum(["DNI", "CE", "PASSPORT"]).optional(),
  seatNumber: z.string().max(20).optional(),
  origin: z.string().max(120).optional(),
  destination: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(200),
      phone: z.string().min(3).max(30),
    })
    .optional(),
  boardedAt: z.string().optional(),
});

const CreateBodySchema = z.object({
  passengers: z.array(PassengerInputSchema).min(1).max(200),
});

/**
 * Verifica que la sesión pueda operar sobre el viaje:
 *  - super_admin / admin_provincial / admin_municipal / fiscal: por
 *    `canAccessMunicipality`.
 *  - operador: además su `companyId` debe coincidir con el de
 *    `vehicle.companyId` del viaje (la empresa dueña de la unidad).
 */
async function authorizeTripAccess(
  session: { role: string; userId: string; municipalityId?: string; provinceId?: string },
  trip: { municipalityId: unknown; vehicleId: unknown },
): Promise<{ ok: true } | { ok: false; reason: "forbidden" | "no_company" }> {
  // RBAC base por municipio.
  if (
    !(await canAccessMunicipality(
      session as never,
      String(trip.municipalityId),
    ))
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (session.role !== ROLES.OPERADOR) return { ok: true };

  const operatorCompanyId = await getOperatorCompanyId(session.userId);
  if (!operatorCompanyId) return { ok: false, reason: "no_company" };

  const vehicle = await Vehicle.findById(trip.vehicleId)
    .select("companyId")
    .lean<{ companyId?: unknown } | null>();
  const vehicleCompanyId = vehicle?.companyId ? String(vehicle.companyId) : null;
  if (!vehicleCompanyId || vehicleCompanyId !== operatorCompanyId) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

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
    ROLES.CONDUCTOR,
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

    const access = await authorizeTripAccess(auth.session, trip);
    if (!access.ok) return apiForbidden();

    const items = await Passenger.find({ tripId: id })
      .sort({ createdAt: 1 })
      .lean();

    return apiResponse({
      items: items.map((p) => ({
        id: String(p._id),
        tripId: String(p.tripId),
        fullName: p.fullName,
        documentNumber: p.documentNumber,
        documentType: p.documentType,
        seatNumber: p.seatNumber,
        origin: p.origin,
        destination: p.destination,
        phone: p.phone,
        emergencyContact: p.emergencyContact,
        boardedAt: p.boardedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error("[viajes/:id/pasajeros GET]", error);
    return apiError("Error al listar pasajeros", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const trip = await Trip.findById(id)
      .select("municipalityId vehicleId passengerListMode")
      .lean<{ municipalityId: unknown; vehicleId: unknown; passengerListMode?: string } | null>();
    if (!trip) return apiNotFound("Viaje no encontrado");

    const access = await authorizeTripAccess(auth.session, trip);
    if (!access.ok) return apiForbidden();

    // Insert tolerante a duplicados: si un documentNumber ya existe en este
    // viaje devolvemos los creados + lista de errores.
    const created: unknown[] = [];
    const skipped: { documentNumber: string; reason: string }[] = [];

    for (const p of parsed.data.passengers) {
      try {
        const doc = await Passenger.create({
          tripId: id,
          fullName: p.fullName,
          documentNumber: p.documentNumber,
          documentType: p.documentType ?? "DNI",
          seatNumber: p.seatNumber,
          origin: p.origin,
          destination: p.destination,
          phone: p.phone,
          emergencyContact: p.emergencyContact,
          boardedAt: p.boardedAt ? new Date(p.boardedAt) : undefined,
        });
        created.push({
          id: String(doc._id),
          fullName: doc.fullName,
          documentNumber: doc.documentNumber,
        });
      } catch (e) {
        const msg = (e as { code?: number; message?: string }).code === 11000
          ? "Documento duplicado en el viaje"
          : (e as Error).message ?? "Error al crear pasajero";
        skipped.push({ documentNumber: p.documentNumber, reason: msg });
      }
    }

    return apiResponse(
      { created, skipped, totalCreated: created.length, totalSkipped: skipped.length },
      201,
    );
  } catch (error) {
    console.error("[viajes/:id/pasajeros POST]", error);
    return apiError("Error al crear pasajeros", 500);
  }
}
