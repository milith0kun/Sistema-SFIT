import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { Inspection } from "@/models/Inspection";
import { Sanction } from "@/models/Sanction";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";

/**
 * GET /api/conductores/[id]/resumen
 *
 * Estadísticas agregadas del conductor para el "Resumen operativo" de su
 * ficha. Devuelve conteos de viajes, inspecciones (con desglose por
 * resultado) y sanciones (con suma de importes y última fecha).
 *
 * Ligero por diseño: una llamada cubre lo que la pantalla muestra al
 * desplegarse, sin obligar al cliente a hacer 3 GETs separados.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [...rolesFor("conductores", "view")]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const driver = await Driver.findById(id)
      .select("municipalityId")
      .lean<{ municipalityId?: unknown } | null>();
    if (!driver) return apiNotFound("Conductor no encontrado");
    if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) {
      return apiForbidden();
    }

    const [tripsTotal, lastTrip, inspAgg, sancAgg, lastSanction] = await Promise.all([
      Trip.countDocuments({ driverId: id }),
      Trip.findOne({ driverId: id })
        .sort({ startTime: -1 })
        .select("startTime status routeId")
        .lean<{ startTime?: Date; status?: string } | null>(),
      Inspection.aggregate<{ _id: string; count: number }>([
        { $match: { driverId: id } },
        { $group: { _id: "$result", count: { $sum: 1 } } },
      ]),
      Sanction.aggregate<{ _id: null; count: number; totalSoles: number }>([
        { $match: { driverId: id } },
        { $group: { _id: null, count: { $sum: 1 }, totalSoles: { $sum: "$amountSoles" } } },
      ]),
      Sanction.findOne({ driverId: id })
        .sort({ createdAt: -1 })
        .select("createdAt amountSoles status")
        .lean<{ createdAt?: Date; amountSoles?: number; status?: string } | null>(),
    ]);

    const inspByResult: Record<string, number> = {};
    for (const row of inspAgg) inspByResult[row._id] = row.count;
    const inspTotal = (inspByResult.aprobada ?? 0) + (inspByResult.rechazada ?? 0) + (inspByResult.observada ?? 0);

    const sancRow = sancAgg[0];

    return apiResponse({
      trips: {
        total: tripsTotal,
        lastAt: lastTrip?.startTime ?? null,
        lastStatus: lastTrip?.status ?? null,
      },
      inspections: {
        total: inspTotal,
        aprobadas: inspByResult.aprobada ?? 0,
        rechazadas: inspByResult.rechazada ?? 0,
        observadas: inspByResult.observada ?? 0,
      },
      sanctions: {
        total: sancRow?.count ?? 0,
        totalSoles: sancRow?.totalSoles ?? 0,
        lastAt: lastSanction?.createdAt ?? null,
        lastAmountSoles: lastSanction?.amountSoles ?? null,
        lastStatus: lastSanction?.status ?? null,
      },
    });
  } catch (error) {
    console.error("[conductores/:id/resumen GET]", error);
    return apiError("Error al obtener resumen", 500);
  }
}
