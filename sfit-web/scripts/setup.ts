/**
 * Script de setup inicial para el primer deploy de SFIT.
 * Crea el super_admin, una provincia y municipalidad de prueba,
 * y el catálogo inicial de recompensas.
 *
 * Uso:
 *   cd sfit-web
 *   npx tsx scripts/setup.ts --email=admin@sfit.pe --password=Admin2026!
 *
 * Opciones:
 *   --email=<email>       Email del super_admin (requerido)
 *   --password=<pass>     Contraseña del super_admin (requerido, mín. 8 chars)
 *   --name=<nombre>       Nombre del super_admin (default: "Super Admin SFIT")
 *   --force               Forzar creación aunque ya exista un super_admin
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import dns from "node:dns";

// Bypass ISP que bloquea DNS SRV de MongoDB Atlas
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

// ── Modelos inline (sin importar la app completa) ─────────────────────────────
const loose = { strict: false, timestamps: true } as const;

const UserModel     = mongoose.models.User     ?? model("User",     new Schema({}, loose));
const ProvinceModel = mongoose.models.Province ?? model("Province", new Schema({}, loose));
const MuniModel     = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));
const RewardModel   = mongoose.models.Reward   ?? model("Reward",   new Schema({}, loose));

// ── Catálogo inicial de recompensas ───────────────────────────────────────────
const RECOMPENSAS = [
  { name: "Descuento 10% en trámites",   description: "Válido en municipalidad",          cost: 50,  category: "descuento",    stock: 100, active: true },
  { name: "Certificado ciudadano activo", description: "PDF oficial de participación",      cost: 100, category: "certificado",  stock: -1,  active: true },
  { name: "Prioridad en atención",        description: "Turno preferencial 1 día",         cost: 200, category: "beneficio",    stock: 20,  active: true },
  { name: "Reconocimiento público",       description: "Mención en boletín municipal",     cost: 500, category: "otro",         stock: -1,  active: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? "true";
  }
  return args;
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function upsert(
  Model: mongoose.Model<mongoose.Document>,
  filter: object,
  data: object,
) {
  return Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  // Validar argumentos requeridos
  if (!args.email || !args.password) {
    console.error("Error: --email y --password son requeridos.");
    console.error("Uso: npx tsx scripts/setup.ts --email=admin@sfit.pe --password=Admin2026!");
    process.exit(1);
  }

  if (args.password.length < 8) {
    console.error("Error: la contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const adminEmail    = args.email.toLowerCase().trim();
  const adminPassword = args.password;
  const adminName     = args.name ?? "Super Admin SFIT";
  const force         = args.force === "true";

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI no definida en .env.local");
    process.exit(1);
  }

  // ── Conectar ─────────────────────────────────────────────────────────────────
  await mongoose.connect(uri);
  console.log("\nConectado a MongoDB Atlas");
  console.log("=".repeat(50));

  // ── 1. Super Admin ────────────────────────────────────────────────────────────
  console.log("\n[1/3] Super Admin");

  const existingSuperAdmin = await UserModel.findOne({ role: "super_admin" });
  if (existingSuperAdmin && !force) {
    log(`Ya existe un super_admin (${existingSuperAdmin.email}). Usa --force para sobreescribir.`);
  } else {
    const hashed = await bcrypt.hash(adminPassword, 12);
    const existing = await UserModel.findOne({ email: adminEmail });

    if (existing) {
      await UserModel.updateOne(
        { email: adminEmail },
        {
          $set: {
            name: adminName,
            password: hashed,
            role: "super_admin",
            status: "activo",
            provider: "credentials",
            updatedAt: new Date(),
          },
        },
      );
      log(`Actualizado: ${adminEmail} → super_admin ACTIVO`);
    } else {
      await UserModel.create({
        name: adminName,
        email: adminEmail,
        password: hashed,
        role: "super_admin",
        status: "activo",
        provider: "credentials",
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log(`Creado: ${adminEmail} con rol super_admin`);
    }
  }

  // ── 2. Provincia y Municipalidad de prueba ────────────────────────────────────
  console.log("\n[2/3] Provincia y Municipalidad de prueba");

  const provincia = await upsert(
    ProvinceModel,
    { name: "Cusco" },
    {
      name: "Cusco",
      region: "Cusco",
      active: true,
    },
  );
  log(`Provincia: Cusco (id: ${provincia._id})`);

  const municipalidad = await upsert(
    MuniModel,
    { name: "Municipalidad Provincial del Cusco" },
    {
      name: "Municipalidad Provincial del Cusco",
      provinceId: provincia._id,
      active: true,
      config: {
        horasMaxConduccion: 8,
        limiteInspecciones: 100,
        alertaFatigaHoras: 4,
        notificacionesActivas: true,
      },
    },
  );
  log(`Municipalidad: Municipalidad Provincial del Cusco (id: ${municipalidad._id})`);

  // ── 3. Catálogo de recompensas ─────────────────────────────────────────────────
  console.log("\n[3/3] Catálogo de recompensas");

  for (const r of RECOMPENSAS) {
    await upsert(RewardModel, { name: r.name }, r);
    log(`${r.name} (${r.cost} SFITCoins)`);
  }

  // ── Resumen ───────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("Setup completado exitosamente.");
  console.log(`\n  Super Admin : ${adminEmail}`);
  console.log(`  Provincia   : Cusco`);
  console.log(`  Municipio   : Municipalidad Provincial del Cusco`);
  console.log(`  Recompensas : ${RECOMPENSAS.length} items creados/actualizados`);
  console.log("\nPara crear usuarios adicionales usa scripts/seed-test-users.ts");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nError en setup:", err.message);
  process.exit(1);
});
