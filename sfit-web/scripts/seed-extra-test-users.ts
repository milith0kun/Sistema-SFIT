/**
 * Seed de usuarios EXTRA para pruebas multi-conductor / multi-ciudadano.
 *
 * Crea (upsert idempotente):
 *   - conductor2@sfit.test  + Driver document + vehículo asignado
 *   - conductor3@sfit.test  + Driver document + vehículo asignado
 *   - ciudadano2@sfit.test  (con municipalityId)
 *   - ciudadano3@sfit.test  (con municipalityId)
 *
 * Sin el documento Driver, el endpoint /api/flota/[id]/location
 * (PATCH del conductor) responde 403 porque hace
 * `Driver.findOne({userId: session.userId})` y no encuentra match.
 *
 * Uso: npx tsx scripts/seed-extra-test-users.ts
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const TEST_MUNICIPALITY_UBIGEO = "080101"; // Cusco-Cusco
const PASSWORD = "Sfit2026!";

interface SeedConductor {
  email: string;
  name: string;
  dni: string;
  licenseNumber: string;
  phone: string;
}

interface SeedCiudadano {
  email: string;
  name: string;
}

const CONDUCTORES: SeedConductor[] = [
  {
    email: "conductor2@sfit.test",
    name: "Conductor 2 SFIT",
    dni: "70000002",
    licenseNumber: "Q70000002",
    phone: "984000002",
  },
  {
    email: "conductor3@sfit.test",
    name: "Conductor 3 SFIT",
    dni: "70000003",
    licenseNumber: "Q70000003",
    phone: "984000003",
  },
  {
    email: "conductor4@sfit.test",
    name: "Conductor 4 SFIT",
    dni: "70000004",
    licenseNumber: "Q70000004",
    phone: "984000004",
  },
];

const CIUDADANOS: SeedCiudadano[] = [
  { email: "ciudadano2@sfit.test", name: "Ciudadano 2 SFIT" },
  { email: "ciudadano3@sfit.test", name: "Ciudadano 3 SFIT" },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const loose = { strict: false } as const;
  const Province = mongoose.models.Province ??
    mongoose.model("Province", new mongoose.Schema({}, { ...loose, collection: "provinces" }));
  const Municipality = mongoose.models.Municipality ??
    mongoose.model("Municipality", new mongoose.Schema({}, { ...loose, collection: "municipalities" }));
  const User = mongoose.models.User ??
    mongoose.model("User", new mongoose.Schema({}, { ...loose, collection: "users" }));
  const Driver = mongoose.models.Driver ??
    mongoose.model("Driver", new mongoose.Schema({}, { ...loose, collection: "drivers" }));
  const Vehicle = mongoose.models.Vehicle ??
    mongoose.model("Vehicle", new mongoose.Schema({}, { ...loose, collection: "vehicles" }));

  const muniDoc = await Municipality.findOne({ ubigeoCode: TEST_MUNICIPALITY_UBIGEO }) as any;
  if (!muniDoc) throw new Error(`Falta municipalidad UBIGEO ${TEST_MUNICIPALITY_UBIGEO}`);
  const provinceDoc = await Province.findById(muniDoc.provinceId) as any;

  const municipalityId = muniDoc._id;
  const provinceId = provinceDoc?._id ?? muniDoc.provinceId;

  console.log(`✓ Municipalidad: ${muniDoc.name} (${municipalityId})`);

  const hashed = await bcrypt.hash(PASSWORD, 12);

  // ── Conductores ──────────────────────────────────────────────
  for (const c of CONDUCTORES) {
    const user = await User.findOneAndUpdate(
      { email: c.email },
      {
        $set: {
          name: c.name,
          email: c.email,
          password: hashed,
          provider: "credentials",
          role: "conductor",
          status: "activo",
          municipalityId,
          provinceId,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    console.log(`✓ User conductor → ${c.email}`);

    // Driver document — la tabla pivot del rol; sin esto el endpoint
    // /api/flota/[id]/location PATCH responde 403.
    await Driver.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          name: c.name,
          dni: c.dni,
          licenseNumber: c.licenseNumber,
          licenseCategory: "A-IIB",
          phone: c.phone,
          municipalityId,
          status: "apto",
          active: true,
          continuousHours: 0,
          restHours: 8,
          reputationScore: 100,
          userId: user._id,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    console.log(`  ↳ Driver doc creado/actualizado`);
  }

  // ── Ciudadanos ───────────────────────────────────────────────
  for (const c of CIUDADANOS) {
    await User.findOneAndUpdate(
      { email: c.email },
      {
        $set: {
          name: c.name,
          email: c.email,
          password: hashed,
          provider: "credentials",
          role: "ciudadano",
          status: "activo",
          municipalityId,
          provinceId,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    console.log(`✓ User ciudadano → ${c.email}`);
  }

  // ── Tabla resumen ────────────────────────────────────────────
  console.log("\n=== USUARIOS EXTRA DE PRUEBA ===\n");
  console.log("| Email                    | Password    | Rol         |");
  console.log("|--------------------------|-------------|-------------|");
  for (const c of CONDUCTORES) {
    console.log(`| ${c.email.padEnd(24)} | ${PASSWORD.padEnd(11)} | conductor   |`);
  }
  for (const c of CIUDADANOS) {
    console.log(`| ${c.email.padEnd(24)} | ${PASSWORD.padEnd(11)} | ciudadano   |`);
  }
  console.log(`\nTodos en municipalidad ${muniDoc.name} (${municipalityId})`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
