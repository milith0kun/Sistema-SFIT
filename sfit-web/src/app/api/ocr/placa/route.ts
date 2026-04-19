/**
 * RF-17: OCR de placas vehiculares
 * POST /api/ocr/placa — Auth requerida
 *
 * NOTA: Requiere tesseract.js instalado:
 *   npm install tesseract.js
 *
 * Recibe multipart/form-data con campo `image` (archivo de imagen).
 * Devuelve: { data: { raw: string, plate: string | null, confidence: number } }
 */
import { NextRequest } from "next/server";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

// ── Patrones de placa peruana ────────────────────────────────────────────────
// Formato moderno: ABC-123 (3 letras + 3 dígitos con guion opcional)
// Formato antiguo: A1B234 / AB-1234, etc.
const PLATE_PATTERNS = [
  /\b([A-Z]{3}[-\s]?\d{3})\b/,           // ABC-123 / ABC 123 / ABC123
  /\b([A-Z]{2}[-\s]?\d{4})\b/,            // AB-1234 / AB1234
  /\b([A-Z]\d[A-Z]\d{3})\b/,              // A1B234 (alfanumérico)
  /\b([A-Z]{3}[-\s]?\d{2}[A-Z])\b/,      // ABC-12A (diplomático)
];

function extractPlate(text: string): string | null {
  const normalized = text.toUpperCase().replace(/[OQ]/g, "0").replace(/[Il]/g, "1");

  for (const pattern of PLATE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      // Normalizar: sin espacios, con guion en posición correcta
      const raw = match[1].replace(/\s/g, "");
      // Insertar guion si no lo tiene (ej: ABC123 → ABC-123)
      if (!raw.includes("-") && /^[A-Z]{3}\d{3}$/.test(raw)) {
        return `${raw.slice(0, 3)}-${raw.slice(3)}`;
      }
      if (!raw.includes("-") && /^[A-Z]{2}\d{4}$/.test(raw)) {
        return `${raw.slice(0, 2)}-${raw.slice(2)}`;
      }
      return raw;
    }
  }
  return null;
}

const TIMEOUT_MS = 15_000;

export async function POST(request: NextRequest) {
  // Auth check
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  // Verificar Content-Type multipart
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

  // Validar tipo MIME
  const mime = imageFile.type;
  if (mime && !mime.startsWith("image/")) {
    return apiError("El archivo debe ser una imagen (jpeg, png, webp, bmp)", 415);
  }

  // Cargar imagen como buffer
  let imageBuffer: Buffer;
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } catch {
    return apiError("No se pudo leer el archivo de imagen", 400);
  }

  // OCR con Tesseract.js dentro de timeout de 15 s
  let raw = "";
  let confidence = 0;

  try {
    // Importación dinámica para no romper el build si tesseract.js no está instalado
    // @ts-ignore optional dependency — npm install tesseract.js para activar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tesseract = (await import("tesseract.js")) as any;

    const ocrPromise = Tesseract.recognize(imageBuffer, "eng", {
      // Configuraciones optimizadas para placas: solo caracteres alfanuméricos
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
      tessedit_pageseg_mode: "8",   // PSM_SINGLE_WORD – una línea
    } as Record<string, unknown>);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    raw = result.data.text.trim();
    confidence = result.data.confidence ?? 0;
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
    console.error("[ocr/placa POST]", err);
    return apiError("Error al procesar la imagen con OCR", 500);
  }

  // Post-procesado: extraer placa
  const plate = confidence >= 60 ? extractPlate(raw) : null;

  return apiResponse({ raw, plate, confidence });
}
