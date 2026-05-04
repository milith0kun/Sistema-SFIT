import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";

/**
 * Resuelve la empresa (Company) cuyo flota gestiona un operador.
 *
 * Estrategia:
 *  1. Lee `User.companyId` directo (camino moderno, después de A1/A10).
 *  2. Fallback de compatibilidad: busca un Driver vinculado al userId; si
 *     existe y trae companyId, lo usa. Acto seguido hace un backfill
 *     one-shot poblando `User.companyId` para evitar el roundtrip extra
 *     en llamadas siguientes.
 *
 * Devuelve `null` cuando el usuario no tiene empresa asignada todavía
 * (p.ej. operador recién aprobado por el admin sin asignación).
 */
export async function getOperatorCompanyId(userId: string): Promise<string | null> {
  await connectDB();

  // 1) User.companyId directo
  const u = await User.findById(userId).select("companyId").lean();
  if (u && "companyId" in u && u.companyId) return String(u.companyId);

  // 2) Fallback via Driver vinculado (compat backwards)
  const d = await Driver.findOne({ userId }).select("companyId").lean();
  if (d && "companyId" in d && d.companyId) {
    // Backfill: actualiza User.companyId para próximas veces (one-shot).
    // Best-effort — si falla no rompe el flujo principal.
    await User.findByIdAndUpdate(userId, { companyId: d.companyId }).catch(() => {});
    return String(d.companyId);
  }

  return null;
}
