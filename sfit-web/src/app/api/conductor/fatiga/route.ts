import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * RF-14 — Motor de fatiga del conductor.
 * GET /api/conductor/fatiga
 *
 * Requiere: Authorization: Bearer <access_token> con rol "conductor".
 *
 * Lógica:
 *  1. Obtiene el User autenticado para leer su DNI.
 *  2. Busca el Driver (municipalityId + dni).
 *  3. Consulta las FleetEntry del Driver para el día actual
 *     cuyo status sea "cerrado" o "auto_cierre".
 *  4. Suma horas de conducción (departureTime→returnTime por entrada).
 *  5. Calcula horas de descanso desde el último cierre hasta ahora.
 *  6. Aplica reglas del reglamento peruano para determinar el estado.
 *
 * Respuesta:
 *   { horasConduccion, horasDescanso, estado, ultimaActualizacion }
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth)
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    // ── 1. Obtener datos del usuario autenticado ──────────────────────────
    const user = await User.findById(auth.session.userId).lean();
    if (!user) return apiUnauthorized("Usuario no encontrado");

    // ── 2. Resolver el registro Driver por DNI + municipalidad ────────────
    const municipalityId =
      user.municipalityId?.toString() ?? auth.session.municipalityId;

    let driver = null;
    if (user.dni && municipalityId) {
      driver = await Driver.findOne({
        municipalityId,
        dni: user.dni,
        active: true,
      }).lean();
    }
    if (!driver) {
      return apiNotFound("Registro de conductor no encontrado");
    }

    // ── 3. Entradas de flota del conductor HOY ────────────────────────────
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const entries = await FleetEntry.find({
      driverId: driver._id,
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ["cerrado", "auto_cierre"] },
    })
      .sort({ updatedAt: 1 })
      .lean();

    // ── 4. Calcular horas de conducción acumuladas ─────────────────────────
    // Cada entrada cerrada con departureTime y returnTime (formato "HH:MM")
    // contribuye con (returnTime - departureTime) en horas.
    let horasConduccion = 0;
    let lastCloseTime: Date | null = null;

    for (const entry of entries) {
      if (entry.departureTime && entry.returnTime) {
        const [depH, depM] = entry.departureTime.split(":").map(Number);
        const [retH, retM] = entry.returnTime.split(":").map(Number);

        const depMinutes = depH * 60 + depM;
        const retMinutes = retH * 60 + retM;

        const diffMinutes = retMinutes - depMinutes;
        if (diffMinutes > 0) {
          horasConduccion += diffMinutes / 60;
        }

        // Rastrear la hora de cierre más reciente del día
        const closeDate = new Date(todayStart);
        closeDate.setHours(retH, retM, 0, 0);
        if (!lastCloseTime || closeDate > lastCloseTime) {
          lastCloseTime = closeDate;
        }
      } else {
        // Fallback: usar updatedAt como referencia del cierre si no hay returnTime
        if (!lastCloseTime || entry.updatedAt > lastCloseTime) {
          lastCloseTime = entry.updatedAt;
        }
      }
    }

    // ── 5. Calcular horas de descanso desde el último cierre ──────────────
    let horasDescanso = 0;
    if (lastCloseTime) {
      const diffMs = now.getTime() - lastCloseTime.getTime();
      horasDescanso = Math.max(0, diffMs / (1000 * 60 * 60));
    }

    // ── 6. Determinar estado de fatiga (reglamento peruano) ───────────────
    type EstadoFatiga = "apto" | "precaucion" | "riesgo" | "no_apto";
    let estado: EstadoFatiga;

    if (horasConduccion >= 5 && horasDescanso < 0.5) {
      estado = "no_apto";
    } else if (horasConduccion >= 4) {
      estado = "riesgo";
    } else if (horasConduccion >= 2.5) {
      estado = "precaucion";
    } else {
      estado = "apto";
    }

    // ── 7. Respuesta ──────────────────────────────────────────────────────
    return apiResponse({
      horasConduccion: Math.round(horasConduccion * 100) / 100,
      horasDescanso: Math.round(horasDescanso * 100) / 100,
      estado,
      ultimaActualizacion: now.toISOString(),
    });
  } catch (error) {
    console.error("[conductor/fatiga GET]", error);
    return apiError("Error al calcular estado de fatiga", 500);
  }
}
