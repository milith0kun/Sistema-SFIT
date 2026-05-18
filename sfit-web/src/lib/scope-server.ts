/**
 * Helpers server-only sobre el ámbito geográfico activo.
 *
 * Separado de `@/lib/scope` (que es isomorfo) porque acá tocamos Mongoose:
 * resolvemos el `_id` de la municipalidad sede (Tambobamba) a partir de su
 * UBIGEO, cacheado en memoria de proceso. Toda creación/actualización de
 * usuarios fuerza este ObjectId como `municipalityId` — el sistema opera
 * sobre una única municipalidad institucional, no es seleccionable.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
import { ACTIVE_MUNICIPALITY_CODE } from "@/lib/scope";

let cachedId: mongoose.Types.ObjectId | null = null;

/**
 * Devuelve el ObjectId de la municipalidad activa (Tambobamba). Lanza si la
 * muni no fue sembrada todavía — `scripts/activate-cotabambas.ts` la crea y
 * marca como activa. La cache es de proceso, así que se invalida al reiniciar.
 */
export async function getActiveMunicipalityId(): Promise<mongoose.Types.ObjectId> {
  if (cachedId) return cachedId;
  await connectDB();
  const muni = await Municipality.findOne({ ubigeoCode: ACTIVE_MUNICIPALITY_CODE })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();
  if (!muni) {
    throw new Error(
      `Municipalidad activa (${ACTIVE_MUNICIPALITY_CODE}) no encontrada. ` +
        "Corre scripts/activate-cotabambas.ts primero.",
    );
  }
  cachedId = muni._id;
  return cachedId;
}

/** Resetea la cache. Sólo necesario en tests. */
export function __resetActiveMunicipalityCache(): void {
  cachedId = null;
}
