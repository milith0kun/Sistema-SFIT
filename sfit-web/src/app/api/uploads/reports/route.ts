import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/uploads/reports
 * Sube una imagen de evidencia y devuelve su URL pública.
 * El archivo se almacena en /public/uploads/reports/ del servidor.
 *
 * En producción (Dokploy/Docker) montar el volumen:
 *   /app/public/uploads  →  <volumen persistente>
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

    if (file.size > MAX_SIZE_BYTES) {
      return apiError("El archivo supera el límite de 5 MB.", 400);
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "reports");

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const url = `${appUrl}/uploads/reports/${filename}`;

    return apiResponse({ url, filename }, 201);
  } catch (error) {
    console.error("[uploads/reports POST]", error);
    return apiError("Error al subir el archivo", 500);
  }
}
