/**
 * GET /api/catalogo/empresa-mtc?ruc=XXXXXXXXXXX
 *
 * Consulta el catálogo MTC de empresas autorizadas para transporte de
 * pasajeros (poblado desde el dataset oficial 2022-2024 con
 * `scripts/seed-mtc-pasajeros.ts`).
 *
 * Devuelve datos agregados de la empresa: razón social, vigencia más
 * reciente, cobertura por departamento, tipos de servicio observados
 * y conteo de vehículos habilitados. Read-only.
 *
 * Cuando el RUC no está en el catálogo retornamos 404 — el cliente
 * decide si caer a apiperu.dev/sunat para validación SUNAT más amplia.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { TransportAuthorization } from "@/models/TransportAuthorization";
import { apiResponse, apiError, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const url = new URL(request.url);
  const ruc = (url.searchParams.get("ruc") ?? "").trim();
  if (!/^\d{11}$/.test(ruc)) {
    return apiError("RUC debe tener 11 dígitos", 400);
  }

  try {
    await connectDB();
    const auth = await TransportAuthorization
      .findOne({ ruc, mode: "terrestre_pasajeros" })
      .select("ruc razonSocial vigenciaHasta vehicleCount tiposServicio ambitos coverageDepartments coverageDepartmentNames active source.fechaCorte")
      .lean();

    if (!auth) return apiNotFound("RUC no encontrado en el catálogo MTC");

    return apiResponse({
      ruc: auth.ruc,
      razonSocial: auth.razonSocial,
      vigenciaHasta: auth.vigenciaHasta,
      vehicleCount: auth.vehicleCount,
      tiposServicio: auth.tiposServicio ?? [],
      ambitos: auth.ambitos ?? [],
      coverageDepartments: auth.coverageDepartments ?? [],
      coverageDepartmentNames: auth.coverageDepartmentNames ?? [],
      active: auth.active,
      fechaCorte: auth.source?.fechaCorte,
      source: "MTC",
    });
  } catch (err) {
    console.error("[catalogo/empresa-mtc]", err);
    return apiError("Error al consultar el catálogo MTC", 500);
  }
}
