/**
 * Seed de solicitudes de aprobación pendientes (RF-01-04).
 *
 * Genera usuarios con `status: pendiente` y `requestedRole` para que
 * super_admin / admin_provincial / admin_municipal puedan revisarlos en
 * /admin/users.
 *
 * Requisito previo: npx tsx scripts/seed-test-users.ts
 *   (necesita la Provincia y Municipalidad de prueba)
 *
 * Uso: cd sfit-web && npx tsx scripts/seed-aprobaciones.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import bcrypt from "bcryptjs";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const PROVINCE_NAME     = "Provincia de Prueba SFIT";
const MUNICIPALITY_NAME = "Municipalidad de Prueba SFIT";
const PASSWORD          = "Sfit2026!";

const loose = { strict: false, timestamps: true } as const;
const UserModel         = mongoose.models.User         ?? model("User",         new Schema({}, loose));
const ProvinceModel     = mongoose.models.Province     ?? model("Province",     new Schema({}, loose));
const MunicipalityModel = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

type RequestedRole = "fiscal" | "operador" | "conductor" | "ciudadano";

interface PendingPlan {
  email: string;
  name: string;
  requestedRole: RequestedRole;
  dni: string;
  phone: string;
  image?: string;
  daysAgo: number; // antigüedad de la solicitud
  scoped: boolean; // si pertenece al municipio de prueba
}

const PENDING_USERS: PendingPlan[] = [
  {
    email: "maria.quispe.pend@sfit.test",
    name: "María Quispe Mamani",
    requestedRole: "ciudadano",
    dni: "29611001",
    phone: "984200001",
    daysAgo: 0,
    scoped: false,
  },
  {
    email: "carlos.huanca.pend@sfit.test",
    name: "Carlos Huanca Flores",
    requestedRole: "ciudadano",
    dni: "29611002",
    phone: "984200002",
    daysAgo: 1,
    scoped: false,
  },
  {
    email: "rosa.ttito.pend@sfit.test",
    name: "Rosa Ttito Villena",
    requestedRole: "conductor",
    dni: "29611003",
    phone: "984200003",
    daysAgo: 1,
    scoped: true,
  },
  {
    email: "pedro.condori.pend@sfit.test",
    name: "Pedro Condori Quispe",
    requestedRole: "conductor",
    dni: "29611004",
    phone: "984200004",
    daysAgo: 2,
    scoped: true,
  },
  {
    email: "luis.ccopa.pend@sfit.test",
    name: "Luis Ccopa Mendoza",
    requestedRole: "operador",
    dni: "29611005",
    phone: "984200005",
    daysAgo: 3,
    scoped: true,
  },
  {
    email: "ana.mamani.pend@sfit.test",
    name: "Ana Mamani Sullca",
    requestedRole: "operador",
    dni: "29611006",
    phone: "984200006",
    daysAgo: 4,
    scoped: true,
  },
  {
    email: "jose.flores.pend@sfit.test",
    name: "José Flores Apaza",
    requestedRole: "fiscal",
    dni: "29611007",
    phone: "984200007",
    daysAgo: 5,
    scoped: true,
  },
  {
    email: "carmen.villa.pend@sfit.test",
    name: "Carmen Villa Cusihuamán",
    requestedRole: "fiscal",
    dni: "29611008",
    phone: "984200008",
    daysAgo: 7,
    scoped: true,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  // ── Provincia + municipio de prueba ────────────────────────────────────────
  const province = await ProvinceModel.findOne({ name: PROVINCE_NAME }).lean() as { _id: Types.ObjectId } | null;
  if (!province) throw new Error(`Provincia "${PROVINCE_NAME}" no existe — ejecuta seed-test-users.ts primero.`);

  const municipality = await MunicipalityModel.findOne({
    provinceId: province._id,
    name: MUNICIPALITY_NAME,
  }).lean() as { _id: Types.ObjectId } | null;
  if (!municipality) throw new Error(`Municipalidad "${MUNICIPALITY_NAME}" no existe — ejecuta seed-test-users.ts primero.`);

  console.log(`Provincia: ${province._id}`);
  console.log(`Municipalidad: ${municipality._id}`);

  // ── Hash compartido (RNF-04: bcrypt 12 rounds) ─────────────────────────────
  const hashed = await bcrypt.hash(PASSWORD, 12);

  // ── Upsert usuarios pendientes ─────────────────────────────────────────────
  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const p of PENDING_USERS) {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - p.daysAgo);
    createdAt.setHours(9 + (p.daysAgo % 8), 30, 0, 0);

    const set: Record<string, unknown> = {
      name: p.name,
      email: p.email,
      password: hashed,
      provider: "credentials",
      role: "ciudadano",            // rol inicial (default); se reasigna al aprobar
      requestedRole: p.requestedRole,
      status: "pendiente",
      dni: p.dni,
      phone: p.phone,
      provinceId: province._id,
      updatedAt: now,
    };
    if (p.scoped) set.municipalityId = municipality._id;
    if (p.image)  set.image = p.image;

    const before = await UserModel.findOne({ email: p.email }).select("_id").lean();
    await UserModel.findOneAndUpdate(
      { email: p.email },
      {
        $set: set,
        $setOnInsert: { createdAt },
        $unset: { rejectionReason: "" }, // limpiar rechazos previos si re-seedeás
      },
      { upsert: true, new: true },
    );
    if (before) updated++; else created++;
    const tag = before ? "actualizado" : "creado    ";
    console.log(`  ${tag} | ${p.requestedRole.padEnd(9)} | ${p.email}`);
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const total = await UserModel.countDocuments({ status: "pendiente" });
  const porRol = await UserModel.aggregate([
    { $match: { status: "pendiente" } },
    { $group: { _id: "$requestedRole", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log("\n=== RESUMEN APROBACIONES PENDIENTES ===");
  console.log(`Creados      : ${created}`);
  console.log(`Actualizados : ${updated}`);
  console.log(`Total en BD  : ${total}`);
  console.log("\nPor rol solicitado:");
  for (const r of porRol) {
    console.log(`  ${String(r._id ?? "(sin rol)").padEnd(12)} → ${r.count}`);
  }
  console.log(`\nPassword común: ${PASSWORD}`);
  console.log("Revisa en /admin/users con superadmin@sfit.test");

  await mongoose.disconnect();
  console.log("\nSeed de aprobaciones completado.");
}

main().catch((err: unknown) => {
  console.error("Error en seed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
