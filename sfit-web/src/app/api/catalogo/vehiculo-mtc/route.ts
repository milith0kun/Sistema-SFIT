/**
 * GET /api/catalogo/vehiculo-mtc?placa=ABC123
 *
 * Consulta el catálogo MTC de vehículos habilitados (poblado desde el
 * dataset oficial 2022-2024). Devuelve datos técnicos completos:
 * marca, clase, año fabricación, asientos, ejes, dimensiones, peso,
 * y la empresa autorizadora (RUC + razón social).
 *
 * Útil para autocompletar el formulario de `Vehicle` cuando un
 * admin_municipal registra una unidad por placa. Si la placa no existe
 * en el catálogo retornamos 404 — el cliente puede caer a
 * `/api/validar/placa` (Factiliza/SUNARP) como respaldo.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { AuthorizedVehicle } from "@/models/AuthorizedVehicle";
import { apiResponse, apiError, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const url = new URL(request.url);
  const placa = (url.searchParams.get("placa") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{5,8}$/.test(placa)) {
    return apiError("Placa inválida (5-8 caracteres alfanuméricos)", 400);
  }

  try {
    await connectDB();
    const v = await AuthorizedVehicle
      .findOne({ placa, mode: "terrestre_pasajeros" })
      .populate("authorizationId", "razonSocial ruc vigenciaHasta active")
      .lean();

    if (!v) return apiNotFound("Placa no encontrada en el catálogo MTC");

    const auth = v.authorizationId as unknown as {
      _id: unknown; razonSocial?: string; ruc?: string;
      vigenciaHasta?: Date | null; active?: boolean;
    } | null;

    return apiResponse({
      placa: v.placa,
      // Datos técnicos del vehículo
      clase:    v.clase,
      marca:    v.marca,
      anioFabr: v.anioFabr,
      nChasis:  v.nChasis,
      nMotor:   v.nMotor,
      nAsientos: v.nAsientos,
      nLlantas:  v.nLlantas,
      nEjes:     v.nEjes,
      cargaUtil: v.cargaUtil,
      pesoSeco:  v.pesoSeco,
      pesoBruto: v.pesoBruto,
      largo:     v.largo,
      ancho:     v.ancho,
      altura:    v.altura,
      // Servicio y ámbito
      ambitoOpera:        v.ambitoOpera,
      ambitoTerritorial:  v.ambitoTerritorial,
      naturalezaServicio: v.naturalezaServicio,
      tipoServicio:       v.tipoServicio,
      actividadServicio:  v.actividadServicio,
      // Empresa autorizadora (denormalizada)
      authorization: auth ? {
        ruc: auth.ruc ?? v.ruc,
        razonSocial: auth.razonSocial ?? null,
        vigenciaHasta: auth.vigenciaHasta ?? null,
        active: auth.active ?? null,
      } : { ruc: v.ruc, razonSocial: null, vigenciaHasta: null, active: null },
      // Ubicación
      ubigeoCode:     v.ubigeoCode,
      departmentCode: v.departmentCode,
      departmentName: v.departmentName,
      provinceName:   v.provinceName,
      districtName:   v.districtName,
      vigenciaHasta: v.vigenciaHasta,
      fechaCorte:    v.fechaCorte,
      active:        v.active,
      source: "MTC",
    });
  } catch (err) {
    console.error("[catalogo/vehiculo-mtc]", err);
    return apiError("Error al consultar el catálogo MTC", 500);
  }
}
