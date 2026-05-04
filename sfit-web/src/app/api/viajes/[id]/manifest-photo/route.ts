import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import sharp from "sharp";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { UploadedFile } from "@/models/UploadedFile";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1920;

async function authorizeOperatorOrAdmin(
  session: { role: string; userId: string; municipalityId?: string; provinceId?: string },
  trip: { municipalityId: unknown; vehicleId: unknown },
): Promise<boolean> {
  if (
    !(await canAccessMunicipality(
      session as never,
      String(trip.municipalityId),
    ))
  ) {
    return false;
  }
  if (session.role !== ROLES.OPERADOR) return true;

  const operatorCompanyId = await getOperatorCompanyId(session.userId);
  if (!operatorCompanyId) return false;
  const vehicle = await Vehicle.findById(trip.vehicleId)
    .select("companyId")
    .lean<{ companyId?: unknown } | null>();
  return !!vehicle?.companyId && String(vehicle.companyId) === operatorCompanyId;
}

function buildBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
    ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return apiError("No se proporcionó ningún archivo", 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError(
        "Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WEBP.",
        400,
      );
    }
    if (file.size > MAX_INPUT_BYTES) {
      return apiError("El archivo supera el límite de 10 MB.", 400);
    }

    await connectDB();
    const trip = await Trip.findById(id);
    if (!trip) return apiNotFound("Viaje no encontrado");

    // Para el conductor ampliamos la regla: debe ser el conductor asignado al viaje.
    if (auth.session.role === ROLES.CONDUCTOR) {
      // Buscar el Driver del usuario y verificar que sea el del viaje.
      const { Driver } = await import("@/models/Driver");
      const driver = await Driver.findOne({ userId: auth.session.userId })
        .select("_id")
        .lean<{ _id?: unknown } | null>();
      if (!driver?._id || String(driver._id) !== String(trip.driverId)) {
        return apiForbidden();
      }
    } else if (
      !(await authorizeOperatorOrAdmin(auth.session, {
        municipalityId: trip.municipalityId,
        vehicleId: trip.vehicleId,
      }))
    ) {
      return apiForbidden();
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const webpBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90, effort: 5 })
      .toBuffer();

    const doc = await UploadedFile.create({
      data: webpBuffer,
      mimeType: "image/webp",
      size: webpBuffer.length,
      category: "trip-manifest",
      uploadedBy: auth.session.userId,
    });

    const baseUrl = buildBaseUrl(request);
    const url = `${baseUrl}/api/uploads/files/${String(doc._id)}`;

    // Push al array del Trip.
    if (!Array.isArray(trip.manifestPhotoUrls)) {
      trip.manifestPhotoUrls = [];
    }
    trip.manifestPhotoUrls.push(url);
    await trip.save();

    return apiResponse(
      { url, id: String(doc._id), manifestPhotoUrls: trip.manifestPhotoUrls },
      201,
    );
  } catch (error) {
    console.error("[viajes/:id/manifest-photo POST]", error);
    return apiError("Error al subir la foto del manifiesto", 500);
  }
}

export async function DELETE(
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
    const url = new URL(request.url).searchParams.get("url");
    if (!url) return apiError("Parámetro 'url' requerido", 400);

    await connectDB();
    const trip = await Trip.findById(id);
    if (!trip) return apiNotFound("Viaje no encontrado");

    if (
      !(await authorizeOperatorOrAdmin(auth.session, {
        municipalityId: trip.municipalityId,
        vehicleId: trip.vehicleId,
      }))
    ) {
      return apiForbidden();
    }

    const before = Array.isArray(trip.manifestPhotoUrls)
      ? trip.manifestPhotoUrls.length
      : 0;
    trip.manifestPhotoUrls = (trip.manifestPhotoUrls ?? []).filter(
      (u) => u !== url,
    );
    await trip.save();

    // Best-effort: si el URL apunta a /api/uploads/files/<id> también borramos
    // el binario subido, así el archivo no queda huérfano en MongoDB.
    const match = url.match(/\/api\/uploads\/files\/([a-f0-9]{24})/i);
    if (match && isValidObjectId(match[1])) {
      await UploadedFile.findByIdAndDelete(match[1]).catch(() => {});
    }

    return apiResponse({
      success: true,
      removed: before - trip.manifestPhotoUrls.length,
      manifestPhotoUrls: trip.manifestPhotoUrls,
    });
  } catch (error) {
    console.error("[viajes/:id/manifest-photo DELETE]", error);
    return apiError("Error al eliminar la foto del manifiesto", 500);
  }
}
