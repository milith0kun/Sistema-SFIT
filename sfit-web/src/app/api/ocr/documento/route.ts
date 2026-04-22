/**
 * RF-17: OCR de documentos (DNI / licencia / SOAT / tarjeta de circulación)
 * POST /api/ocr/documento — Auth requerida
 *
 * NOTA: Requiere tesseract.js instalado:
 *   npm install tesseract.js
 *
 * Recibe multipart/form-data con campos:
 *   image   — archivo de imagen
 *   docType — "dni" | "licencia" | "soat" | "tarjeta_circulacion"  (opcional, default "dni")
 *
 * Devuelve: { data: { raw, docType, fields: { [campo]: { value, confidence } } } }
 */
import { NextRequest } from "next/server";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type DocType = "dni" | "licencia" | "soat" | "tarjeta_circulacion";

interface FieldResult {
  value: string;
  confidence: number;
}

type FieldsMap = Record<string, FieldResult>;

// ── Confianza ──────────────────────────────────────────────────────────────────
const CONF_EXACT = 0.90;
const CONF_PARTIAL = 0.70;
const CONF_HEURISTIC = 0.55;

// ── Patrones — DNI ─────────────────────────────────────────────────────────────
const DNI_PATTERN = /\b(\d{8})\b/;
const FECHA_NAC_PATTERN = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/;
const NOMBRE_PATTERNS = [
  /NOMBRES?[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,60})/i,
  /APELLIDOS?[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,60})/i,
];

function extractDniFields(text: string): FieldsMap {
  const fields: FieldsMap = {};

  // numeroDocumento
  const dniMatch = text.match(DNI_PATTERN);
  if (dniMatch) {
    fields.numeroDocumento = { value: dniMatch[1], confidence: CONF_EXACT };
  }

  // nombre
  let nombreValue: string | null = null;
  let nombreConf = CONF_HEURISTIC;
  for (const pattern of NOMBRE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      nombreValue = match[1].trim().replace(/\s{2,}/g, " ").slice(0, 80);
      nombreConf = CONF_PARTIAL;
      break;
    }
  }
  if (!nombreValue) {
    // Fallback: línea con 2+ palabras en mayúsculas de ≥3 letras
    const lines = text.split("\n").map((l) => l.trim());
    for (const line of lines) {
      if (/^([A-ZÁÉÍÓÚÑ]{3,}\s){1,4}[A-ZÁÉÍÓÚÑ]{3,}$/.test(line)) {
        nombreValue = line.slice(0, 80);
        nombreConf = CONF_HEURISTIC;
        break;
      }
    }
  }
  if (nombreValue) {
    fields.nombre = { value: nombreValue, confidence: nombreConf };
  }

  // fechaNacimiento
  const fechaMatch = text.match(FECHA_NAC_PATTERN);
  if (fechaMatch) {
    const normalized = fechaMatch[1].replace(/-/g, "/");
    fields.fechaNacimiento = { value: normalized, confidence: CONF_PARTIAL };
  }

  return fields;
}

// ── Patrones — Licencia ────────────────────────────────────────────────────────
const LICENCIA_PATTERN = /\b([A-Z]\d{8})\b/;
const CATEGORIA_PATTERN = /\b(A-I{1,3}[abc]?|B-I{1,2}[ab]?)\b/i;
const FECHA_PATTERN = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/;

function extractLicenciaFields(text: string): FieldsMap {
  const fields: FieldsMap = {};

  const licMatch = text.match(LICENCIA_PATTERN);
  if (licMatch) {
    fields.numeroLicencia = { value: licMatch[1], confidence: CONF_EXACT };
  }

  const catMatch = text.match(CATEGORIA_PATTERN);
  if (catMatch) {
    fields.categoria = { value: catMatch[1].toUpperCase(), confidence: CONF_EXACT };
  }

  const fechaMatch = text.match(FECHA_PATTERN);
  if (fechaMatch) {
    const normalized = fechaMatch[1].replace(/-/g, "/");
    fields.fechaVencimiento = { value: normalized, confidence: CONF_PARTIAL };
  }

  return fields;
}

// ── Patrones — SOAT ────────────────────────────────────────────────────────────
const POLIZA_PATTERN = /(?:PÓLIZA|POLIZA|N°|NRO)[:\s]+([A-Z0-9\-]{6,20})/i;
const VIGENCIA_PATTERN = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/;
const ASEGURADORAS = [
  "RIMAC", "MAPFRE", "PACIFICO", "LA POSITIVA", "CARDIF", "HDI", "SECREX",
] as const;

function extractSoatFields(text: string): FieldsMap {
  const fields: FieldsMap = {};
  const upper = text.toUpperCase();

  const polizaMatch = text.match(POLIZA_PATTERN);
  if (polizaMatch) {
    fields.numeroPóliza = { value: polizaMatch[1], confidence: CONF_EXACT };
  }

  const vigMatch = text.match(VIGENCIA_PATTERN);
  if (vigMatch) {
    const normalized = vigMatch[1].replace(/-/g, "/");
    fields.vigencia = { value: normalized, confidence: CONF_PARTIAL };
  }

  const foundAseg = ASEGURADORAS.find((a) => upper.includes(a));
  if (foundAseg) {
    fields.aseguradora = { value: foundAseg, confidence: CONF_EXACT };
  } else {
    // Heurística: línea con palabra(s) seguida de "SEGUROS" o "COMPAÑÍA"
    const segLine = text.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,30})\s+(?:SEGUROS|COMPA[ÑN][IÍ]A)/i);
    if (segLine) {
      fields.aseguradora = {
        value: segLine[1].trim().toUpperCase(),
        confidence: CONF_HEURISTIC,
      };
    }
  }

  return fields;
}

// ── Patrones — Tarjeta de circulación ─────────────────────────────────────────
const PLACA_PATTERN = /\b([A-Z]{3}-\d{3}|[A-Z]\d[A-Z]-\d{3})\b/;
const AÑO_PATTERN = /\b(19[5-9]\d|20[0-2]\d)\b/;
const MARCAS = [
  "TOYOTA", "NISSAN", "HYUNDAI", "KIA", "CHEVROLET", "FORD",
  "VOLKSWAGEN", "SUZUKI", "HONDA", "MITSUBISHI", "ISUZU", "HINO", "YUTONG",
] as const;

function extractTarjetaFields(text: string): FieldsMap {
  const fields: FieldsMap = {};
  const upper = text.toUpperCase();

  const placaMatch = text.match(PLACA_PATTERN);
  if (placaMatch) {
    fields.placa = { value: placaMatch[1].toUpperCase(), confidence: CONF_EXACT };
  }

  const foundMarca = MARCAS.find((m) => upper.includes(m));
  if (foundMarca) {
    fields.marca = { value: foundMarca, confidence: CONF_EXACT };
  } else {
    // Heurística: línea con "MARCA" seguido de texto
    const marcaLine = text.match(/MARCA[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,30})/i);
    if (marcaLine) {
      fields.marca = { value: marcaLine[1].trim().toUpperCase(), confidence: CONF_HEURISTIC };
    }
  }

  // Modelo: línea con "MODELO" seguida de texto
  const modeloLine = text.match(/MODELO[:\s]+([A-Z0-9][A-Z0-9\s\-]{1,40})/i);
  if (modeloLine) {
    fields.modelo = { value: modeloLine[1].trim().toUpperCase(), confidence: CONF_PARTIAL };
  }

  const añoMatch = text.match(AÑO_PATTERN);
  if (añoMatch) {
    fields.año = { value: añoMatch[1], confidence: CONF_PARTIAL };
  }

  return fields;
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────
function extractFields(text: string, docType: DocType): FieldsMap {
  switch (docType) {
    case "licencia":
      return extractLicenciaFields(text);
    case "soat":
      return extractSoatFields(text);
    case "tarjeta_circulacion":
      return extractTarjetaFields(text);
    case "dni":
    default:
      return extractDniFields(text);
  }
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

  // Leer docType del FormData (default: "dni")
  const docTypeRaw = (formData.get("docType") as string | null) ?? "dni";
  const VALID_DOC_TYPES: DocType[] = ["dni", "licencia", "soat", "tarjeta_circulacion"];
  const docType: DocType = VALID_DOC_TYPES.includes(docTypeRaw as DocType)
    ? (docTypeRaw as DocType)
    : "dni";

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

  const fields = extractFields(raw, docType);

  return apiResponse({ raw, docType, fields });
}
