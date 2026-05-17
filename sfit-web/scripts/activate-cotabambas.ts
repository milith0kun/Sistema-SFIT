/**
 * Activa la provincia de Cotabambas (0305) y sus 6 distritos en el catálogo
 * UBIGEO. `seed-ubigeo.ts` siembra todo con `active: false` por diseño; este
 * script es el toggle que incorpora el scope operativo de SFIT al sistema.
 *
 * También siembra la razón social oficial de la Municipalidad Provincial de
 * Cotabambas (Tambobamba) y marca su `dataCompleted=true` para que el
 * admin_municipal no tenga que ingresar esos datos en su primer login.
 * El RUC institucional es opcional y se completa después desde la web si
 * hace falta para exportes oficiales.
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
  ACTIVE_MUNICIPALITY_CODE,
  ACTIVE_MUNICIPALITY_FULL_NAME,
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

  // Sede provincial (Tambobamba): pre-sembrar razón social y marcar como
  // dataCompleted para que el onboarding NO solicite estos datos al admin.
  // Solo escribimos los campos si están vacíos (idempotente).
  const sede = await db
    .collection("municipalities")
    .findOne({ ubigeoCode: ACTIVE_MUNICIPALITY_CODE });
  if (sede) {
    const patch: Record<string, unknown> = { dataCompleted: true };
    if (!sede.razonSocial || String(sede.razonSocial).trim() === "") {
      patch.razonSocial = ACTIVE_MUNICIPALITY_FULL_NAME;
    }
    const sedeRes = await db
      .collection("municipalities")
      .updateOne({ _id: sede._id }, { $set: patch });
    console.log(
      `Sede ${ACTIVE_MUNICIPALITY_CODE} (datos institucionales): matched=${sedeRes.matchedCount} modified=${sedeRes.modifiedCount}`,
    );
  } else {
    console.warn(`⚠ Sede ${ACTIVE_MUNICIPALITY_CODE} no encontrada — corre seed-ubigeo.ts --depto=03 primero`);
  }

  await mongoose.disconnect();
  console.log("✅ Cotabambas activada");
})();
