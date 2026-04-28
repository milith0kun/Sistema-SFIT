/**
 * Seed de usuarios de prueba — 1 por cada uno de los 7 roles de SFIT.
 *
 * Crea (upsert idempotente):
 *   - 1 Provincia de prueba
 *   - 1 Municipalidad de prueba
 *   - 7 usuarios (uno por rol) con bcrypt 12 rounds (RNF-04)
 *
 * Uso: npx tsx scripts/seed-test-users.ts
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import dns from "node:dns";

// Bypass DNS del ISP para SRV de MongoDB+srv (patrón de create-admin.ts)
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

config({ path: ".env.local" });

// Provincia y municipalidad de pruebas resueltas desde el catálogo UBIGEO real.
// Cusco-Cusco-Cusco (provincia 0801, distrito 080101). Se asume que el catálogo
// UBIGEO ya fue sembrado: `npx tsx scripts/seed-ubigeo.ts`.
const TEST_PROVINCE_UBIGEO     = "0801";
const TEST_MUNICIPALITY_UBIGEO = "080101";

const PASSWORD = "Sfit2026!";

type Role =
  | "super_admin"
  | "admin_provincial"
  | "admin_municipal"
  | "fiscal"
  | "operador"
  | "conductor"
  | "ciudadano";

interface SeedUser {
  email: string;
  name: string;
  role: Role;
  scope: "global" | "province" | "municipality";
}

const USERS: SeedUser[] = [
  {
    email: "superadmin@sfit.test",
    name: "Super Administrador SFIT",
    role: "super_admin",
    scope: "global",
  },
  {
    email: "provincial@sfit.test",
    name: "Administrador Provincial SFIT",
    role: "admin_provincial",
    scope: "province",
  },
  {
    email: "municipal@sfit.test",
    name: "Administrador Municipal SFIT",
    role: "admin_municipal",
    scope: "municipality",
  },
  {
    email: "fiscal@sfit.test",
    name: "Fiscal Inspector SFIT",
    role: "fiscal",
    scope: "municipality",
  },
  {
    email: "operador@sfit.test",
    name: "Operador de Empresa SFIT",
    role: "operador",
    scope: "municipality",
  },
  {
    email: "conductor@sfit.test",
    name: "Conductor SFIT",
    role: "conductor",
    scope: "municipality",
  },
  {
    email: "ciudadano@sfit.test",
    name: "Ciudadano SFIT",
    role: "ciudadano",
    scope: "global",
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  // Schemas flexibles para no depender de los modelos TS compilados.
  const ProvinceSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "provinces" },
  );
  const MunicipalitySchema = new mongoose.Schema(
    {},
    { strict: false, collection: "municipalities" },
  );
  const UserSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "users" },
  );

  const Province =
    mongoose.models.Province ?? mongoose.model("Province", ProvinceSchema);
  const Municipality =
    mongoose.models.Municipality ??
    mongoose.model("Municipality", MunicipalitySchema);
  const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

  // 1. Resolver provincia UBIGEO real (Cusco — 0801) y activarla.
  const provinceDoc = await Province.findOne({
    ubigeoCode: TEST_PROVINCE_UBIGEO,
  });
  if (!provinceDoc) {
    throw new Error(
      `No se encontró la provincia UBIGEO ${TEST_PROVINCE_UBIGEO}. ` +
      `Ejecuta primero: npx tsx scripts/seed-ubigeo.ts`,
    );
  }
  if (!provinceDoc.active) {
    provinceDoc.active = true;
    await provinceDoc.save();
  }
  const provinceId = provinceDoc._id;
  console.log(`✓ Provincia UBIGEO ${TEST_PROVINCE_UBIGEO}: ${provinceDoc.name} (${provinceId})`);

  // 2. Resolver municipalidad UBIGEO real (Cusco distrito — 080101) y activarla.
  const muniDoc = await Municipality.findOne({
    ubigeoCode: TEST_MUNICIPALITY_UBIGEO,
  });
  if (!muniDoc) {
    throw new Error(
      `No se encontró la municipalidad UBIGEO ${TEST_MUNICIPALITY_UBIGEO}. ` +
      `Ejecuta primero: npx tsx scripts/seed-ubigeo.ts`,
    );
  }
  if (!muniDoc.active) {
    muniDoc.active = true;
    await muniDoc.save();
  }
  const municipalityId = muniDoc._id;
  console.log(`✓ Municipalidad UBIGEO ${TEST_MUNICIPALITY_UBIGEO}: ${muniDoc.name} (${municipalityId})`);

  // 3. Usuarios — bcrypt 12 rounds (RNF-04)
  const hashed = await bcrypt.hash(PASSWORD, 12);

  for (const u of USERS) {
    const set: Record<string, unknown> = {
      name: u.name,
      email: u.email,
      password: hashed,
      provider: "credentials",
      role: u.role,
      status: "activo",
      updatedAt: new Date(),
    };

    if (u.scope === "province" || u.scope === "municipality") {
      set.provinceId = provinceId;
    }
    if (u.scope === "municipality") {
      set.municipalityId = municipalityId;
    }

    await User.findOneAndUpdate(
      { email: u.email },
      {
        $set: set,
        $setOnInsert: { createdAt: new Date() },
        $unset: {
          requestedRole: "",
          rejectionReason: "",
        },
      },
      { upsert: true, new: true },
    );
    console.log(`✓ Usuario ${u.role.padEnd(18)} → ${u.email}`);
  }

  // 4. Tabla resumen
  console.log("\n=== CREDENCIALES DE PRUEBA SFIT ===\n");
  console.log(
    "| Email".padEnd(32) +
      "| Password".padEnd(14) +
      "| Rol".padEnd(22) +
      "|",
  );
  console.log("|" + "-".repeat(30) + "|" + "-".repeat(12) + "|" + "-".repeat(20) + "|");
  for (const u of USERS) {
    console.log(
      "| " +
        u.email.padEnd(28) +
        "| " +
        PASSWORD.padEnd(10) +
        " | " +
        u.role.padEnd(18) +
        " |",
    );
  }
  console.log("\nProvincia ID:     " + provinceId);
  console.log("Municipalidad ID: " + municipalityId);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
