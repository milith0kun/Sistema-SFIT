import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { ReportApoyo } from "@/models/ReportApoyo";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { awardCoins } from "@/lib/coins/awardCoins";

/**
 * POST /api/reportes/:id/apoyar
 * Alterna el apoyo del usuario autenticado a un reporte validado.
 * Si ya apoyaba → quita el apoyo. Si no → lo agrega.
 * Retorna { apoyado: boolean, totalApoyos: number }.
 *
 * Recompensa: cuando un ciudadano apoya por primera vez un reporte
 * (no toggle), el AUTOR del reporte recibe +1 SFITCoin (RF-15). El que
 * apoya no recibe recompensa para evitar farmeo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.CIUDADANO, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL, ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID de reporte inválido", 400);

    await connectDB();

    const report = await CitizenReport.findById(id).select("_id status citizenId").lean();
    if (!report) return apiNotFound("Reporte no encontrado");
    if (report.status !== "validado") {
      return apiError("Solo se pueden apoyar reportes validados", 409);
    }

    const existing = await ReportApoyo.findOneAndDelete({
      reportId: id,
      userId: auth.session.userId,
    }).lean();

    let apoyado: boolean;
    let nuevoApoyo = false;
    if (existing) {
      apoyado = false;
    } else {
      try {
        await ReportApoyo.create({ reportId: id, userId: auth.session.userId });
        apoyado = true;
        nuevoApoyo = true;
      } catch (e: unknown) {
        // Race condition: índice único disparó duplicado — tratar como ya apoyado
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: number }).code === 11000) {
          apoyado = true;
        } else {
          throw e;
        }
      }
    }

    const totalApoyos = await ReportApoyo.countDocuments({ reportId: id });

    // RF-15: el autor del reporte gana 1 coin por cada apoyo nuevo recibido.
    // No recompensamos al autor por apoyarse a sí mismo ni al que da apoyo
    // (evita farmeo creando cuentas).
    if (
      nuevoApoyo &&
      report.citizenId &&
      String(report.citizenId) !== auth.session.userId
    ) {
      void awardCoins(String(report.citizenId), 1, "reporte_apoyado", String(report._id));
    }

    return apiResponse({ apoyado, totalApoyos });
  } catch (error) {
    console.error("[reportes/:id/apoyar POST]", error);
    return apiError("Error al registrar el apoyo", 500);
  }
}
