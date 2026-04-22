import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.FISCAL,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get("vehicleId");

  if (!vehicleId) return apiError("vehicleId requerido", 400);
  if (!isValidObjectId(vehicleId)) return apiError("vehicleId inválido", 400);

  try {
    await connectDB();

    const inspecciones = await Inspection.find({ vehicleId })
      .sort({ date: -1 })
      .limit(15)
      .select("checklistResults")
      .lean();

    if (inspecciones.length === 0) {
      return apiResponse({ sugerencias: [], hayHistorial: false });
    }

    const fallos: Record<string, number> = {};
    const totales: Record<string, number> = {};

    for (const inspeccion of inspecciones) {
      for (const resultado of inspeccion.checklistResults) {
        const item = resultado.item;
        totales[item] = (totales[item] ?? 0) + 1;
        if (!resultado.passed) {
          fallos[item] = (fallos[item] ?? 0) + 1;
        }
      }
    }

    const sugerencias = Object.entries(totales)
      .map(([item, total]) => ({
        item,
        fallos: fallos[item] ?? 0,
        total,
        tasaFallo: (fallos[item] ?? 0) / total,
      }))
      .filter((s) => s.tasaFallo >= 0.3)
      .sort((a, b) => b.tasaFallo - a.tasaFallo)
      .slice(0, 3);

    return apiResponse({
      hayHistorial: true,
      totalInspecciones: inspecciones.length,
      sugerencias,
    });
  } catch (error) {
    console.error("[inspecciones/sugerencias GET]", error);
    return apiError("Error al calcular sugerencias", 500);
  }
}
