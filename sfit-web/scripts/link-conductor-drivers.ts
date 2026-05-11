/**
 * Vincula bidireccional User ↔ Driver para conductores existentes.
 *
 * Problema que resuelve: el endpoint `PATCH /api/conductores/me` busca el
 * Driver por `userId`. Si el seed creó el User pero no creó un Driver con
 * `userId` apuntando a él (caso de `conductor@sfit.test` y otros legacy),
 * el PATCH devuelve 404 y el conductor nunca puede asociarse a empresa.
 *
 * Este script itera todos los Users con `role: conductor` y:
 *   1. Busca un Driver activo con `userId` apuntando al User → si ya hay
 *      vínculo, no hace nada.
 *   2. Si no, busca un Driver con `dni` igual al `User.dni` → escribe
 *      `userId` en ese Driver.
 *   3. Si no, busca por nombre aproximado → escribe `userId`.
 *   4. Si no encuentra ningún Driver, REPORTA pero NO crea uno
 *      automáticamente (la creación requiere `municipalityId` que solo
 *      el operador o admin puede decidir).
 *
 * Idempotente. Re-correr es seguro.
 *
 * Uso: cd sfit-web && npx tsx scripts/link-conductor-drivers.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const UserModel = mongoose.models.User ?? model("User", new Schema({}, loose));
const DriverModel =
  mongoose.models.Driver ?? model("Driver", new Schema({}, loose));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✖ Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  console.log("→ Conectando a Mongo…");
  await mongoose.connect(uri);

  const conductores = await UserModel.find({ role: "conductor" })
    .select("_id name dni email")
    .lean<Array<{ _id: Types.ObjectId; name?: string; dni?: string; email?: string }>>();
  console.log(`→ ${conductores.length} usuarios con role=conductor`);

  let alreadyLinked = 0;
  let linkedByDni = 0;
  let linkedByName = 0;
  let unmatched = 0;
  const unmatchedDetails: Array<{ email?: string; name?: string; dni?: string }> = [];

  for (const u of conductores) {
    // 1. ¿Ya hay Driver vinculado por userId?
    const existing = await DriverModel.findOne({ userId: u._id }).select("_id").lean();
    if (existing) {
      alreadyLinked++;
      continue;
    }

    // 2. Por DNI.
    let driver = u.dni
      ? await DriverModel.findOne({ dni: u.dni, active: true })
      : null;
    let matchedBy: "dni" | "name" | null = driver ? "dni" : null;

    // 3. Por nombre.
    if (!driver && u.name) {
      const nameParts = u.name.trim().split(/\s+/).filter(Boolean);
      const searchTerm = nameParts.slice(0, 2).join(" ");
      if (searchTerm.length >= 3) {
        driver = await DriverModel.findOne({
          name: { $regex: searchTerm, $options: "i" },
          active: true,
        });
        if (driver) matchedBy = "name";
      }
    }

    if (!driver) {
      unmatched++;
      unmatchedDetails.push({ email: u.email, name: u.name, dni: u.dni });
      continue;
    }

    // Escribir userId en el Driver matched.
    driver.userId = u._id;
    await driver.save();
    if (matchedBy === "dni") linkedByDni++;
    else linkedByName++;
    console.log(
      `  ✓ ${u.email ?? u.name} → Driver "${driver.name}" (${matchedBy})`,
    );
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Ya vinculados (userId presente): ${alreadyLinked}`);
  console.log(`Vinculados ahora por DNI:        ${linkedByDni}`);
  console.log(`Vinculados ahora por nombre:     ${linkedByName}`);
  console.log(`Sin Driver match (sin tocar):    ${unmatched}`);
  if (unmatchedDetails.length > 0) {
    console.log("\nUsuarios sin Driver — necesitan onboarding o que el");
    console.log("operador/admin les cree el Driver:");
    for (const d of unmatchedDetails) {
      console.log(`  - ${d.email ?? "(sin email)"} | ${d.name ?? ""} | dni=${d.dni ?? "—"}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✖", err);
  process.exit(1);
});
