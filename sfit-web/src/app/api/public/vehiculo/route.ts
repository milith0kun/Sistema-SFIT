import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { apiResponse, apiError, apiNotFound } from "@/lib/api/response";
import { verifyQrPayload, type QrPayload } from "@/lib/qr/hmac";

/**
 * GET /api/public/vehiculo?plate=ABC123
 * GET /api/public/vehiculo?qr=<encoded_json>
 * Vista pública de vehículo y conductor — sin autenticación.
 * RF-08: expone sólo los datos permitidos (sin DNI ni contacto).
 * RF-15: incluye reputationScore y reputationLabel para el vehículo y conductor.
 */

/**
 * RF-15: Convierte un puntaje numérico de reputación (0-100) en una etiqueta
 * legible por el ciudadano.
 */
function getReputationLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bueno";
  if (score >= 40) return "Regular";
  if (score >= 20) return "Deficiente";
  return "Sin historial";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const plate = url.searchParams.get("plate")?.toUpperCase();
  const qrRaw = url.searchParams.get("qr");

  if (!plate && !qrRaw) return apiError("Parámetro plate o qr requerido", 400);

  let qrValid: boolean | null = null;
  let lookupPlate = plate;

  if (qrRaw) {
    try {
      const payload: QrPayload = JSON.parse(decodeURIComponent(qrRaw));
      qrValid = verifyQrPayload(payload);
      if (!lookupPlate) lookupPlate = payload.pl;
    } catch {
      qrValid = false;
    }
  }

  if (!lookupPlate) return apiError("Parámetro plate requerido", 400);

  await connectDB();

  const v = await Vehicle.findOne({ plate: lookupPlate, active: true })
    .populate("companyId", "razonSocial")
    .populate("currentDriverId", "name licenseCategory reputationScore status")
    .lean();

  if (!v) return apiNotFound("Vehículo no encontrado o no habilitado");

  // Determinar indicador visual
  let indicator: "verde" | "amarillo" | "rojo" = "verde";
  if (v.status === "fuera_de_servicio" || !v.active) {
    indicator = "rojo";
  } else if (v.lastInspectionStatus === "rechazada" || v.status === "en_mantenimiento") {
    indicator = "rojo";
  } else if (v.lastInspectionStatus === "observada" || v.reputationScore < 60) {
    indicator = "amarillo";
  }

  const driver = v.currentDriverId as {
    _id: unknown; name?: string; licenseCategory?: string;
    reputationScore?: number; status?: string;
  } | null;

  return apiResponse({
    qrSignatureValid: qrValid,
    vehicle: {
      id: String(v._id),
      plate: v.plate,
      vehicleTypeKey: v.vehicleTypeKey,
      brand: v.brand,
      model: v.model,
      year: v.year,
      status: v.status,
      company: (v.companyId as { razonSocial?: string } | null)?.razonSocial ?? null,
      lastInspectionStatus: v.lastInspectionStatus ?? "pendiente",
      reputationScore: v.reputationScore ?? 0,
      reputationLabel: getReputationLabel(v.reputationScore ?? 0),
      indicator,
    },
    driver: driver
      ? {
          id: String(driver._id),
          name: driver.name ?? "—",
          licenseCategory: driver.licenseCategory ?? "—",
          fatigueStatus: driver.status ?? "apto",
          reputationScore: driver.reputationScore ?? 0,
          reputationLabel: getReputationLabel(driver.reputationScore ?? 0),
          enabled: driver.status !== "no_apto",
        }
      : null,
  });
}
