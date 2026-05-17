/**
 * Activa la provincia de Cotabambas (0305) y sus 6 distritos en el catálogo
 * UBIGEO. `seed-ubigeo.ts` siembra todo con `active: false` por diseño; este
 * script es el toggle que incorpora el scope operativo de SFIT al sistema.
 *
 * Idempotente: re-ejecutar no causa daño.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";
import {
  ACTIVE_PROVINCE_CODE,
  ACTIVE_DISTRICT_CODES,
} from "../src/lib/scope";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const prov = await db
    .collection("provinces")
    .updateOne({ ubigeoCode: ACTIVE_PROVINCE_CODE }, { $set: { active: true } });
  console.log(
    `Provincia ${ACTIVE_PROVINCE_CODE}: matched=${prov.matchedCount} modified=${prov.modifiedCount}`,
  );

  const munis = await db
    .collection("municipalities")
    .updateMany(
      { ubigeoCode: { $in: ACTIVE_DISTRICT_CODES as string[] } },
      { $set: { active: true } },
    );
  console.log(
    `Distritos (${ACTIVE_DISTRICT_CODES.length}): matched=${munis.matchedCount} modified=${munis.modifiedCount}`,
  );

  await mongoose.disconnect();
  console.log("✅ Cotabambas activada");
})();
