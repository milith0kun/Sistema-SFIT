import { NextRequest } from "next/server";
import sharp from "sharp";
import { connectDB } from "@/lib/db/mongoose";
import { UploadedFile } from "@/models/UploadedFile";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1280; // px — fotos referenciales no necesitan mayor resolución

const ALLOWED_CATEGORIES = ["driver", "vehicle", "user"] as const;
type PhotoCategory = (typeof ALLOWED_CATEGORIES)[number];

/**
 * POST /api/uploads/photos
 * Sube una foto referencial (conductor, vehículo, usuario) y devuelve la
 * URL para servirla. Sigue el mismo patrón que `/api/uploads/reports`:
 * persiste el binario en MongoDB Atlas como WebP optimizado, sirve vía
 * `GET /api/uploads/files/[id]`.
 *
 * Form-data:
 *   - file (File, requerido)
 *   - category (string: "driver" | "vehicle" | "user", requerido)
 *
 * Auth: cualquier rol autenticado (el admin_municipal sube fotos al
 * registrar; el operador podría subir fotos del conductor cuando lo asigna).
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = String(formData.get("category") ?? "").trim();

    if (!file || typeof file === "string") {
      return apiError("No se proporcionó ningún archivo", 400);
    }
    if (!ALLOWED_CATEGORIES.includes(category as PhotoCategory)) {
      return apiError(`Categoría inválida. Debe ser una de: ${ALLOWED_CATEGORIES.join(", ")}`, 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("Tipo de archivo no permitido. Solo JPG, PNG o WEBP.", 400);
    }
    if (file.size > MAX_INPUT_BYTES) {
      return apiError("El archivo supera el límite de 10 MB.", 400);
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
      .webp({ quality: 88, effort: 5 })
      .toBuffer();

    await connectDB();

    const doc = await UploadedFile.create({
      data: webpBuffer,
      mimeType: "image/webp",
      size: webpBuffer.length,
      category,
      uploadedBy: session.userId,
    });

    const fileId = String(doc._id);
    const baseUrl = (() => {
      const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
      if (envUrl) return envUrl;
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      if (host) return `${proto}://${host}`;
      return new URL(request.url).origin;
    })();
    const url = `${baseUrl}/api/uploads/files/${fileId}`;

    return apiResponse({ url, id: fileId, category }, 201);
  } catch (error) {
    console.error("[uploads/photos POST]", error);
    return apiError("Error al subir la foto", 500);
  }
}
