import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { Sanction } from "@/models/Sanction";
import { CitizenReport } from "@/models/CitizenReport";
import { Municipality } from "@/models/Municipality";
import { User } from "@/models/User";
import { sendEmail } from "@/lib/email/email_service";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const validCron =
    !!cronSecret &&
    !!process.env.CRON_SECRET &&
    cronSecret === process.env.CRON_SECRET;

  if (!validCron) {
    const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL]);
    if ("error" in auth) {
      return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
    }
  }

  try {
    await connectDB();

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekEnd = now;

    const municipalidades = await Municipality.find({ active: true }).lean();

    let municipalidadesNotificadas = 0;
    let operadoresNotificados = 0;

    await Promise.all(
      municipalidades.map(async (muni) => {
        const muniId = muni._id;

        const [
          totalInspecciones,
          aprobadas,
          observadas,
          rechazadas,
          totalSanciones,
          totalReportesPendientes,
          operadores,
        ] = await Promise.all([
          Inspection.countDocuments({ municipalityId: muniId, date: { $gte: weekStart, $lte: weekEnd } }),
          Inspection.countDocuments({ municipalityId: muniId, date: { $gte: weekStart, $lte: weekEnd }, result: "aprobada" }),
          Inspection.countDocuments({ municipalityId: muniId, date: { $gte: weekStart, $lte: weekEnd }, result: "observada" }),
          Inspection.countDocuments({ municipalityId: muniId, date: { $gte: weekStart, $lte: weekEnd }, result: "rechazada" }),
          Sanction.countDocuments({ municipalityId: muniId, createdAt: { $gte: weekStart, $lte: weekEnd } }),
          CitizenReport.countDocuments({ municipalityId: muniId, status: "pendiente" }),
          User.find({ role: ROLES.OPERADOR, municipalityId: muniId, status: "activo" }).select("email name").lean(),
        ]);

        if (operadores.length === 0) return;

        const fechaInicio = weekStart.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
        const fechaFin = weekEnd.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

        const html = `
<h2>Resumen semanal SFIT — ${muni.name}</h2>
<p>Semana: ${fechaInicio} — ${fechaFin}</p>
<table>
  <tr><td>Inspecciones realizadas</td><td>${totalInspecciones}</td></tr>
  <tr><td>— Aprobadas</td><td>${aprobadas}</td></tr>
  <tr><td>— Observadas</td><td>${observadas}</td></tr>
  <tr><td>— Rechazadas</td><td>${rechazadas}</td></tr>
  <tr><td>Sanciones emitidas</td><td>${totalSanciones}</td></tr>
  <tr><td>Reportes ciudadanos pendientes</td><td>${totalReportesPendientes}</td></tr>
</table>
<p>Panel web: <a href="https://sfit.ecosdelseo.com">sfit.ecosdelseo.com</a></p>
`;

        for (const op of operadores) {
          void sendEmail(op.email, `Resumen semanal SFIT — ${muni.name}`, html);
          operadoresNotificados++;
        }

        municipalidadesNotificadas++;
      }),
    );

    return apiResponse({ municipalidadesNotificadas, operadoresNotificados });
  } catch (error) {
    console.error("[admin/reportes/weekly-summary POST]", error);
    return apiError("Error al generar resumen semanal", 500);
  }
}
