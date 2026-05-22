/**
 * POST /api/vehiculos/sunarp-headful — Verifica placa en SUNARP vía navegador
 * visible con resolución manual de Turnstile + DeepSeek Vision.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
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
    const resp = await fetch(
      `${SCRAPER_URL}/scrape/sunarp/headful?plate=${normalized}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SCRAPER_TOKEN}`,
        },
        signal: AbortSignal.timeout(300_000), // 5 min para interacción manual
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[sunarp-headful] Scraper error:", resp.status, text);
      return apiError("Error al consultar SUNARP", 502);
    }

    const result = await resp.json();

    return NextResponse.json({
      success: true,
      plate: result.plate,
      scrapingSuccess: result.success,
      data: result.data,
      sources_consulted: result.sources_consulted ?? ["sunarp_vehicular"],
      errors: result.errors ?? [],
      captchaCost: result.captchaCost ?? 0,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return apiError("Tiempo de espera agotado (5 min) para verificación manual de SUNARP", 504);
    }
    console.error("[sunarp-headful]", error);
    return apiError("No se pudo contactar al servicio de verificación SUNARP", 503);
  }
}
