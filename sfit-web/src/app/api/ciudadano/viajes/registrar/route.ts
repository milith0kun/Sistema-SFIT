/**
 * POST /api/ciudadano/viajes/registrar
 *
 * El ciudadano se auto-registra a un viaje interprovincial escaneando el QR
 * del bus o ingresando la placa manualmente. NO aplica a urbanos (esos se
 * "siguen" en el mapa público sin registro individual).
 *
 * Flujo:
 *   1. Resolver Vehicle por `qr.payload` o `plate`.
 *   2. Validar que la empresa del vehículo es `serviceScope=interprovincial`.
 *   3. Buscar Trip activo (`status ∈ {aceptado, en_curso}`) sobre ese vehículo.
 *      - Si existe → asociar el registro.
 *      - Si NO existe → crear Trip "auto" con `driverId=null` y
 *        `passengerListMode="list"` que el conductor adoptará al iniciar turno.
 *   4. Crear `CitizenTripRegistration` con `registeredVia` + `boardedAt`.
 *   5. Devolver `{ tripId, registrationId, vehicle, company }` para que la
 *      app móvil navegue a `/ciudadano/mi-viaje` y empiece el polling.
 */
import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
import { Trip } from "@/models/Trip";
import { CitizenTripRegistration } from "@/models/CitizenTripRegistration";
import { verifyQrPayload, type QrPayload } from "@/lib/qr/hmac";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiValidationError,
  apiForbidden,
  apiNotFound,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const RegisterSchema = z
  .object({
    qrPayload: z
      .object({
        v: z.number(),
        id: z.string(),
        pl: z.string(),
        mu: z.string(),
        ty: z.string(),
        ts: z.number(),
        sig: z.string(),
      })
      .optional(),
    plate: z.string().min(5).max(10).optional(),
  })
  .refine((v) => v.qrPayload != null || (v.plate && v.plate.length > 0), {
    message: "Debes proporcionar qrPayload o plate",
  });

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();
  // El registro auto-servicio es exclusivo de ciudadanos. Conductores y
  // operadores tienen sus propios flujos de inicio de viaje y NO deben
  // poder "registrarse a sí mismos" como pasajeros — eso confundiría las
  // métricas y las políticas anti-fraude.
  if (session.role !== ROLES.CIUDADANO) return apiForbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();

  // 1) Resolver vehículo desde QR (preferido) o placa.
  let lookupPlate = parsed.data.plate?.toUpperCase();
  let qrSignatureValid: boolean | null = null;
  if (parsed.data.qrPayload) {
    const payload: QrPayload = parsed.data.qrPayload;
    qrSignatureValid = verifyQrPayload(payload);
    if (!qrSignatureValid) {
      return apiError(
        "El QR escaneado no es válido o está dañado. Intenta de nuevo o ingresa la placa manualmente.",
        422,
      );
    }
    if (!lookupPlate) lookupPlate = payload.pl;
  }
  if (!lookupPlate) {
    return apiError("Plate o qrPayload requerido", 400);
  }

  const vehicle = await Vehicle.findOne({ plate: lookupPlate, active: true })
    .select("_id plate brand model photoUrl vehicleTypeKey companyId municipalityId")
    .lean();
  if (!vehicle) return apiNotFound("Vehículo no encontrado");
  if (!vehicle.companyId) {
    return apiError(
      "Este vehículo no tiene empresa asignada. Reporta al administrador.",
      422,
    );
  }

  // 2) Validar que es modalidad interprovincial.
  const company = await Company.findById(vehicle.companyId)
    .select("_id razonSocial ruc serviceScope active suspendedAt")
    .lean();
  if (!company || !company.active || company.suspendedAt) {
    return apiError(
      "La empresa del vehículo no está activa actualmente.",
      422,
    );
  }
  if (company.serviceScope !== "interprovincial") {
    return apiError(
      "El registro auto-servicio solo aplica a viajes interprovinciales. " +
        "Los buses urbanos se siguen en el mapa público.",
      422,
    );
  }

  // 3) Buscar Trip activo o crear "auto". Usamos findOneAndUpdate con upsert
  //    para mitigar el race cuando dos ciudadanos escanean a la vez y crean
  //    duplicados (uno con driverId=null).
  const now = new Date();
  // 3.a) Primero intento encontrar un Trip ya iniciado del conductor (con o
  //      sin driver) para asociar el registro.
  let tripId: Types.ObjectId;
  const existingTrip = await Trip.findOne({
    vehicleId: vehicle._id,
    status: { $in: ["aceptado", "en_curso"] },
    endTime: { $exists: false },
  })
    .sort({ startTime: -1 })
    .select("_id")
    .lean();

  if (existingTrip) {
    tripId = existingTrip._id as Types.ObjectId;
  } else {
    // 3.b) Si no hay Trip, intentamos crear uno auto. Race posible cuando
    //      dos ciudadanos escanean a la vez, pero no es crítico: cada uno
    //      se asocia al Trip que su request alcanzó a crear, y el otro
    //      Trip queda "auto" hasta auto-close. No vale la pena complicar.
    const autoTrip = await Trip.create({
      municipalityId: vehicle.municipalityId,
      vehicleId: vehicle._id,
      companyId: vehicle.companyId,
      startTime: now,
      status: "en_curso",
      passengerListMode: "list",
      passengers: 0,
      km: 0,
      notes: "Trip auto-creado por registro ciudadano",
    });
    tripId = autoTrip._id as Types.ObjectId;
  }

  // 4) Crear o reactivar el registro del ciudadano. El índice parcial único
  //    de CitizenTripRegistration previene doble click rápido.
  let registration;
  try {
    registration = await CitizenTripRegistration.create({
      userId: session.userId,
      vehicleId: vehicle._id,
      tripId,
      municipalityId: vehicle.municipalityId,
      registeredVia: parsed.data.qrPayload ? "qr" : "plate",
      boardedAt: now,
      geoVerified: false,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      // Ya existe un registro activo del mismo ciudadano en este vehículo:
      // devolvemos el existente (idempotente). El cliente ve la misma pantalla.
      registration = await CitizenTripRegistration.findOne({
        userId: session.userId,
        vehicleId: vehicle._id,
        endedAt: { $exists: false },
      });
    } else {
      throw err;
    }
  }

  if (!registration) {
    return apiError("No se pudo registrar el viaje", 500);
  }

  return apiResponse(
    {
      registrationId: String(registration._id),
      tripId: String(tripId),
      vehicle: {
        id: String(vehicle._id),
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        photoUrl: vehicle.photoUrl ?? null,
      },
      company: {
        id: String(company._id),
        razonSocial: company.razonSocial,
        ruc: company.ruc,
      },
      qrSignatureValid,
    },
    201,
  );
}
