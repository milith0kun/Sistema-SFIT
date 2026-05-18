/**
 * Diagnóstico: lista todos los VehicleType agrupados por key + name para
 * encontrar duplicados, keys legacy y "Omnibus duplicado".
 *
 * No modifica nada. Solo lee.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const all = await db
    .collection("vehicletypes")
    .find({}, { projection: { key: 1, name: 1, isCustom: 1, active: 1, municipalityId: 1 } })
    .toArray();
  console.log(`Total VehicleType en BD: ${all.length}\n`);

  const byKey = new Map<string, { name: string; count: number; isCustom: boolean; active: number }>();
  for (const v of all) {
    const k = (v as unknown as { key: string }).key;
    const entry = byKey.get(k) ?? { name: (v as unknown as { name: string }).name, count: 0, isCustom: (v as unknown as { isCustom: boolean }).isCustom ?? false, active: 0 };
    entry.count += 1;
    if ((v as unknown as { active: boolean }).active) entry.active += 1;
    byKey.set(k, entry);
  }

  console.log("Por key:");
  for (const [k, v] of [...byKey.entries()].sort()) {
    const flag = v.isCustom ? "CUSTOM" : "PREDEF";
    const keyStr = String(k ?? "(undefined)").padEnd(35);
    console.log(`  [${flag}] ${keyStr} name="${v.name}"  count=${v.count}  activos=${v.active}`);
  }

  const byName = new Map<string, string[]>();
  for (const [k, v] of byKey) {
    const arr = byName.get(v.name) ?? [];
    arr.push(k);
    byName.set(v.name, arr);
  }
  console.log("\nNombres duplicados (mismo name, distintas keys):");
  for (const [n, ks] of byName) {
    if (ks.length > 1) console.log(`  "${n}" → ${ks.join(", ")}`);
  }

  // Empresas con vehicleTypeKeys: verificar keys huérfanas
  const companies = await db
    .collection("companies")
    .find({}, { projection: { razonSocial: 1, vehicleTypeKeys: 1 } })
    .toArray();
  const allKnownKeys = new Set(byKey.keys());
  console.log("\nEmpresas con keys huérfanas:");
  let orphanCount = 0;
  for (const c of companies) {
    const keys = ((c as unknown as { vehicleTypeKeys?: string[] }).vehicleTypeKeys ?? []);
    const orphans = keys.filter((k) => !allKnownKeys.has(k));
    if (orphans.length > 0) {
      orphanCount += 1;
      console.log(`  ${(c as unknown as { razonSocial: string }).razonSocial}: ${orphans.join(", ")}`);
    }
  }
  if (orphanCount === 0) console.log("  ninguna");

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
