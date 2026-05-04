import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { Passenger } from "@/models/Passenger";
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

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500;

/** Normaliza un header: lowercase, sin tildes, sin espacios laterales. */
function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Tabla de aliases: distintos nombres de columna que el usuario podría haber
 * escrito en su Excel se mapean al campo canónico del modelo Passenger.
 */
const COLUMN_ALIASES: Record<string, string> = {
  // documentNumber
  dni: "documentNumber",
  documento: "documentNumber",
  ndocumento: "documentNumber",
  numerodocumento: "documentNumber",
  ndedocumento: "documentNumber",
  documentnumber: "documentNumber",
  // documentType
  tipodocumento: "documentType",
  tipo: "documentType",
  documenttype: "documentType",
  // fullName
  nombre: "fullName",
  nombres: "fullName",
  nombrecompleto: "fullName",
  nombreyapellidos: "fullName",
  apellidosynombres: "fullName",
  pasajero: "fullName",
  fullname: "fullName",
  // seatNumber
  asiento: "seatNumber",
  numerodeasiento: "seatNumber",
  nasiento: "seatNumber",
  seat: "seatNumber",
  seatnumber: "seatNumber",
  // origin / destination
  origen: "origin",
  destino: "destination",
  // phone
  telefono: "phone",
  celular: "phone",
  telf: "phone",
  phone: "phone",
};

interface RawRow {
  [k: string]: unknown;
}

interface ParsedRow {
  fullName?: string;
  documentNumber?: string;
  documentType?: "DNI" | "CE" | "PASSPORT";
  seatNumber?: string;
  origin?: string;
  destination?: string;
  phone?: string;
}

function parseRow(row: RawRow, headerMap: Map<string, string>): ParsedRow {
  const out: ParsedRow = {};
  for (const [origKey, value] of Object.entries(row)) {
    const norm = normalizeHeader(origKey);
    const target = headerMap.get(norm);
    if (!target || value === null || value === undefined) continue;
    const str = String(value).trim();
    if (!str) continue;

    if (target === "documentType") {
      const upper = str.toUpperCase();
      if (upper === "DNI" || upper === "CE" || upper === "PASSPORT" || upper === "PASAPORTE") {
        out.documentType = upper === "PASAPORTE" ? "PASSPORT" : (upper as "DNI" | "CE" | "PASSPORT");
      }
    } else {
      (out as Record<string, string>)[target] = str;
    }
  }
  return out;
}

export async function POST(
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return apiError("No se proporcionó ningún archivo", 400);
    }
    if (file.size > MAX_BYTES) {
      return apiError("El archivo supera el límite de 5 MB", 400);
    }

    await connectDB();
    const trip = await Trip.findById(id)
      .select("municipalityId vehicleId")
      .lean<{ municipalityId: unknown; vehicleId: unknown } | null>();
    if (!trip) return apiNotFound("Viaje no encontrado");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(trip.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    if (auth.session.role === ROLES.OPERADOR) {
      const operatorCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!operatorCompanyId) return apiForbidden();
      const vehicle = await Vehicle.findById(trip.vehicleId)
        .select("companyId")
        .lean<{ companyId?: unknown } | null>();
      if (!vehicle?.companyId || String(vehicle.companyId) !== operatorCompanyId) {
        return apiForbidden();
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return apiError("El Excel no tiene hojas", 400);
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });

    if (rows.length === 0) return apiError("El Excel está vacío", 400);
    if (rows.length > MAX_ROWS) {
      return apiError(`El archivo excede el límite de ${MAX_ROWS} filas`, 400);
    }

    // Construir el header map a partir de las claves de la primera fila.
    const headerMap = new Map<string, string>();
    for (const key of Object.keys(rows[0])) {
      const norm = normalizeHeader(key);
      const target = COLUMN_ALIASES[norm];
      if (target) headerMap.set(norm, target);
    }
    if (!headerMap.has("dni") && !Array.from(headerMap.values()).includes("documentNumber")) {
      // No detectamos columna de documento — falla amistosa.
      if (!Array.from(headerMap.values()).includes("documentNumber")) {
        return apiError(
          "No se detectó columna de DNI/Documento. Asegúrate de tener encabezados claros.",
          400,
        );
      }
    }

    const created: { id: string; fullName: string; documentNumber: string }[] = [];
    const skipped: { row: number; documentNumber?: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseRow(rows[i], headerMap);
      const rowNum = i + 2; // +1 por header, +1 por base 1

      if (!parsed.documentNumber) {
        skipped.push({ row: rowNum, reason: "Falta DNI/Documento" });
        continue;
      }
      if (!parsed.fullName) {
        skipped.push({
          row: rowNum,
          documentNumber: parsed.documentNumber,
          reason: "Falta nombre",
        });
        continue;
      }

      try {
        const doc = await Passenger.create({
          tripId: id,
          fullName: parsed.fullName,
          documentNumber: parsed.documentNumber,
          documentType: parsed.documentType ?? "DNI",
          seatNumber: parsed.seatNumber,
          origin: parsed.origin,
          destination: parsed.destination,
          phone: parsed.phone,
        });
        created.push({
          id: String(doc._id),
          fullName: doc.fullName,
          documentNumber: doc.documentNumber,
        });
      } catch (e) {
        const reason =
          (e as { code?: number }).code === 11000
            ? "Documento duplicado en el viaje"
            : (e as Error).message ?? "Error al crear pasajero";
        skipped.push({
          row: rowNum,
          documentNumber: parsed.documentNumber,
          reason,
        });
      }
    }

    return apiResponse(
      {
        created,
        skipped,
        totalCreated: created.length,
        totalSkipped: skipped.length,
        totalRows: rows.length,
      },
      201,
    );
  } catch (error) {
    console.error("[viajes/:id/pasajeros/import POST]", error);
    return apiError("Error al importar pasajeros", 500);
  }
}
