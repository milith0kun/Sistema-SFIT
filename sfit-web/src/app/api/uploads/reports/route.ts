import { NextRequest } from "next/server";
import sharp from "sharp";
import { connectDB } from "@/lib/db/mongoose";
import { UploadedFile } from "@/models/UploadedFile";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB de entrada (antes de comprimir)
const MAX_DIMENSION = 1920; // px — limita ancho/alto máximo manteniendo proporción

/**
 * POST /api/uploads/reports
 * Sube una imagen de evidencia y devuelve la URL para servirla.
 *
 * - Persiste el binario en MongoDB Atlas (no en disco), por lo que sobrevive
 *   a redeploys de Dokploy/Docker sin requerir volúmenes persistentes.
 * - Convierte cualquier JPG/PNG/WEBP entrante a WebP en el servidor con
 *   calidad 90 (visualmente indistinguible) y redimensiona a 1920px máx.
 *   Esto reduce 60–80% el peso vs JPG original sin pérdida perceptible y
 *   acelera la carga en el dashboard y la app móvil.
 *
 * Auth: cualquier rol autenticado.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return apiError("No se proporcionó ningún archivo", 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WEBP.", 400);
    }

    if (file.size > MAX_INPUT_BYTES) {
      return apiError("El archivo supera el límite de 10 MB.", 400);
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // Conversión a WebP optimizado:
    // - rotate(): respeta la orientación EXIF antes de redimensionar
    // - resize: solo encoge si excede MAX_DIMENSION, nunca agranda
    // - webp quality 90: ~indistinguible del original, comprime ~70%
    // - effort 5: balance entre velocidad y compresión
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

    await connectDB();

    const doc = await UploadedFile.create({
      data: webpBuffer,
      mimeType: "image/webp",
      size: webpBuffer.length,
      category: "reports",
      uploadedBy: session.userId,
    });

    // URL absoluta pública. Detrás de Cloudflare/Dokploy `request.url` ve
    // el origen interno del socket (`https://0.0.0.0:3000`), que no es
    // accesible desde el cliente. Preferimos `NEXT_PUBLIC_APP_URL` del .env
    // de producción; caemos a los headers de proxy `x-forwarded-host` y
    // como último recurso al `request.url` (útil en dev local).
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

    return apiResponse({ url, id: fileId }, 201);
  } catch (error) {
    console.error("[uploads/reports POST]", error);
    return apiError("Error al subir el archivo", 500);
  }
}
