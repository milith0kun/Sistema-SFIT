/**
 * POST /api/vehiculos/verify-plate — Verifica una placa contra fuentes oficiales
 * y retorna datos estructurados para autocompletar el formulario de registro.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { normalizePlate } from "@/lib/scraper/trigger";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR];

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL ?? "http://127.0.0.1:8001";
const SCRAPER_TOKEN = process.env.SCRAPER_INTERNAL_TOKEN ?? "sfit_scraper_internal_prod_2026";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  let body: { plate?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Body JSON inválido", 400);
  }

  if (!body.plate || typeof body.plate !== "string" || body.plate.trim().length < 6) {
    return apiError("Placa inválida. Debe tener al menos 6 caracteres.", 400);
  }

  const normalized = normalizePlate(body.plate);

  if (normalized.length !== 6) {
    return apiError("Placa inválida después de normalizar. Use formato ABC123.", 400);
  }

  try {
    const resp = await fetch(`${SCRAPER_URL}/scrape/plate/${normalized}`, {
      headers: {
        Authorization: `Bearer ${SCRAPER_TOKEN}`,
      },
      signal: AbortSignal.timeout(180_000), // 3 min para CAPTCHAs
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[verify-plate] Scraper error:", resp.status, text);
      return apiError("Error al consultar fuentes oficiales", 502);
    }

    const result = await resp.json();

    // Devolver plano sin doble encapsulamiento de apiResponse
    return NextResponse.json({
      success: true,
      plate: result.plate,
      scrapingSuccess: result.success,
      data: result.data,
      sources_consulted: result.sources_consulted ?? [],
      errors: result.errors ?? [],
      captchaCost: result.captchaCost ?? 0,
    });
  } catch (error: any) {
    console.error("[verify-plate]", error);
    return apiError(
      "No se pudo contactar al servicio de verificación de placas",
      503,
    );
  }
}
