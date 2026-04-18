import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import QRCode from "qrcode";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { signQrPayload } from "@/lib/qr/hmac";

/**
 * GET /api/vehiculos/[id]/qr
 * Genera (o regenera) el QR firmado HMAC-SHA256 del vehículo.
 * Devuelve la imagen PNG en base64 + el payload JSON para la app.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const v = await Vehicle.findById(id).lean();
  if (!v) return apiNotFound("Vehículo no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(v.municipalityId)))) return apiForbidden();

  const payload = signQrPayload(
    String(v._id),
    v.plate,
    String(v.municipalityId),
    v.vehicleTypeKey,
  );

  // Persist the HMAC in the vehicle doc (for reference / audit)
  await Vehicle.findByIdAndUpdate(id, { qrHmac: payload.sig });

  const qrJson = JSON.stringify(payload);
  const pngDataUrl = await QRCode.toDataURL(qrJson, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#0f0f0f", light: "#ffffff" },
  });

  return apiResponse({
    payload,
    qrJson,
    pngDataUrl,
    plate: v.plate,
    vehicleTypeKey: v.vehicleTypeKey,
  });
}
