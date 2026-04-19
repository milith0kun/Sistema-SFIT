/**
 * Seed del catálogo inicial de recompensas SFIT.
 * Uso: cd sfit-web && npx tsx scripts/seed-recompensas.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

// ── Modelo inline con strict:false ───────────────────────────────────────────

const loose = { strict: false, timestamps: true } as const;

const RewardModel =
  mongoose.models.Reward ?? model("Reward", new Schema({}, loose));

// ── Catálogo inicial ─────────────────────────────────────────────────────────

const recompensas = [
  {
    name: "Descuento 10% en trámites",
    description: "Válido en municipalidad",
    cost: 50,
    category: "descuento",
    stock: 100,
    active: true,
  },
  {
    name: "Certificado ciudadano activo",
    description: "PDF oficial de participación",
    cost: 100,
    category: "certificado",
    stock: -1, // ilimitado
    active: true,
  },
  {
    name: "Prioridad en atención",
    description: "Turno preferencial 1 día",
    cost: 200,
    category: "beneficio",
    stock: 20,
    active: true,
  },
  {
    name: "Reconocimiento público",
    description: "Mención en boletín municipal",
    cost: 500,
    category: "otro",
    stock: -1, // ilimitado
    active: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsert(
  Model: mongoose.Model<any>,
  filter: object,
  data: object
) {
  return Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: "after" });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  for (const recompensa of recompensas) {
    await upsert(RewardModel, { name: recompensa.name }, recompensa);
    console.log(`  ✓ ${recompensa.name} (cost: ${recompensa.cost} SFITCoins)`);
  }

  console.log(`\n✅ ${recompensas.length} recompensas creadas/actualizadas.`);

  await mongoose.disconnect();
  console.log("🎉 Seed de recompensas completado exitosamente.");
}

main().catch((err) => {
  console.error("❌ Error en seed:", err.message);
  process.exit(1);
});
