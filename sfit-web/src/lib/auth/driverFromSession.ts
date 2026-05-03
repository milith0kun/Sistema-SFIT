import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import type { JwtPayload } from "./jwt";

/**
 * Resuelve el documento Driver del conductor autenticado.
 *
 * El usuario (User) y el Driver son entidades separadas: el User tiene
 * el rol "conductor" para autenticarse y el Driver tiene los datos
 * profesionales (licencia, municipio, etc.). La relación es:
 *   - Driver.userId === User._id  (preferida, denormalizada)
 *   - Driver.dni === User.dni     (fallback, datos importados antes
 *                                   del flujo unificado)
 *
 * Devuelve `null` si el usuario aún no tiene registro de conductor
 * asociado (caso onboarding incompleto). Los handlers deben tratar
 * esto como "lista vacía / sin permisos", no como error.
 *
 * Requiere `connectDB()` activa.
 */
export async function resolveDriverFromSession(
  session: JwtPayload,
): Promise<{ _id: unknown; municipalityId: unknown } | null> {
  let driver = await Driver.findOne({ userId: session.userId })
    .select("_id municipalityId")
    .lean<{ _id: unknown; municipalityId: unknown } | null>();

  if (!driver && session.municipalityId) {
    const user = await User.findById(session.userId)
      .select("dni municipalityId")
      .lean<{ dni?: string } | null>();
    if (user?.dni) {
      driver = await Driver.findOne({
        dni: user.dni,
        municipalityId: session.municipalityId,
      })
        .select("_id municipalityId")
        .lean<{ _id: unknown; municipalityId: unknown } | null>();
    }
  }

  return driver;
}
