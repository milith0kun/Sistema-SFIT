/**
 * RF-17: OCR de documentos (DNI / licencia de conducir)
 * POST /api/ocr/documento — Auth requerida
 *
 * NOTA: Requiere tesseract.js instalado:
 *   npm install tesseract.js
 *
 * Recibe multipart/form-data con campo `image` (archivo de imagen).
 * Devuelve: { data: { raw: string, dni: string | null, nombre: string | null } }
 */
import { NextRequest } from "next/server";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

// ── Patrones de extracción de documento ────────────────────────────────────
// DNI peruano: 8 dígitos exactos
const DNI_PATTERN = /\b(\d{8})\b/;

// Nombre en DNI: línea con mayúsculas, a menudo precedida por "APELLIDOS" / "NOMBRES"
// También intenta capturar líneas con 2+ palabras en mayúsculas
const NOMBRE_PATTERNS = [
  /NOMBRES?[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,60})/i,
  /APELLIDOS?[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,60})/i,
];

function extractDni(text: string): string | null {
  const match = text.match(DNI_PATTERN);
  return match ? match[1] : null;
}

function extractNombre(text: string): string | null {
  for (const pattern of NOMBRE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/\s{2,}/g, " ").slice(0, 80);
    }
  }

  // Fallback: buscar línea con 2+ palabras en mayúsculas de ≥3 letras cada una
  const lines = text.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (/^([A-ZÁÉÍÓÚÑ]{3,}\s){1,4}[A-ZÁÉÍÓÚÑ]{3,}$/.test(line)) {
      return line.slice(0, 80);
    }
  }
  return null;
}

const TIMEOUT_MS = 15_000;

export async function POST(request: NextRequest) {
  // Auth check
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return apiError("Se requiere multipart/form-data con campo 'image'", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Error al leer el formulario", 400);
  }

  const imageFile = formData.get("image");
  if (!imageFile || !(imageFile instanceof Blob)) {
    return apiError("Campo 'image' requerido (archivo de imagen)", 400);
  }

  const mime = imageFile.type;
  if (mime && !mime.startsWith("image/")) {
    return apiError("El archivo debe ser una imagen (jpeg, png, webp, bmp)", 415);
  }

  let imageBuffer: Buffer;
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } catch {
    return apiError("No se pudo leer el archivo de imagen", 400);
  }

  // OCR con Tesseract.js — modo texto libre para documentos
  let raw = "";

  try {
    // @ts-ignore optional dependency — npm install tesseract.js para activar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tesseract = (await import("tesseract.js")) as any;

    const ocrPromise = Tesseract.recognize(imageBuffer, "spa", {
      // Modo multiline para documentos
      tessedit_pageseg_mode: "6", // PSM_SINGLE_BLOCK
    } as Record<string, unknown>);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    raw = result.data.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "OCR timeout") {
      return apiError("El procesamiento OCR superó los 15 segundos", 408);
    }
    if (msg.includes("Cannot find module")) {
      return apiError(
        "tesseract.js no está instalado. Ejecuta: npm install tesseract.js",
        501
      );
    }
    console.error("[ocr/documento POST]", err);
    return apiError("Error al procesar el documento con OCR", 500);
  }

  const dni = extractDni(raw);
  const nombre = extractNombre(raw);

  return apiResponse({ raw, dni, nombre });
}
