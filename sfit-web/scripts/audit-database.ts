/**
 * Auditoría completa de la base de datos SFIT.
 *
 * Conecta a MongoDB Atlas, cuenta documentos en cada colección,
 * muestra muestras de datos y detecta referencias huérfanas.
 *
 * Uso: npx tsx scripts/audit-database.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;

// Todas las colecciones del sistema SFIT
const COLLECTIONS = [
  // Catálogo base
  "regions",
  "provinces",
  "municipalities",
  "vehicletypes",
  // Usuarios y auth
  "users",
  // Empresas y conductores
  "companies",
  "drivers",
  "drivermemberships",
  "transportauthorizations",
  "authorizedvehicles",
  // Vehículos y flota
  "vehicles",
  "fleetentries",
  // Rutas y viajes
  "routes",
  "routecaptures",
  "trips",
  "passengers",
  "citizenTripRegistrations",
  // Inspecciones y reportes
  "inspections",
  "citizenreports",
  "reportapoyos",
  // Sanciones y apelaciones
  "sanctions",
  "apelacions",
  // Gamificación
  "sfitcoins",
  // Notificaciones
  "notifications",
  // Otros
  "locationpings",
  "uploadedfiles",
  "auditlogs",
  "webhooks",
] as const;

interface CollectionStats {
  name: string;
  count: number;
  sampleIds: string[];
  sampleFields: Record<string, unknown>[];
}

async function auditCollection(
  db: mongoose.mongo.Db,
  name: string
): Promise<CollectionStats> {
  const col = db.collection(name);
  const count = await col.countDocuments();

  const samples = await col.find().limit(3).toArray();
  const sampleIds = samples.map((s) => s._id?.toString() ?? "?");
  const sampleFields = samples.map((s) => {
    const { _id, __v, password, refreshToken, ...rest } = s;
    // Truncar strings largos
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === "string" && v.length > 80) {
        cleaned[k] = v.slice(0, 80) + "…";
      } else if (Array.isArray(v) && v.length > 3) {
        cleaned[k] = `[${v.length} items]`;
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  });

  return { name, count, sampleIds, sampleFields };
}

async function checkOrphans(db: mongoose.mongo.Db) {
  const issues: string[] = [];

  // Users → companyId → companies
  const usersWithCompany = await db
    .collection("users")
    .find({ companyId: { $exists: true, $ne: null } })
    .toArray();
  const companyIds = new Set(
    (await db.collection("companies").find().toArray()).map((c) =>
      c._id.toString()
    )
  );
  for (const u of usersWithCompany) {
    if (u.companyId && !companyIds.has(u.companyId.toString())) {
      issues.push(
        `User ${u._id} (${u.email}) → companyId ${u.companyId} NO EXISTE`
      );
    }
  }

  // Users → municipalityId → municipalities
  const munIds = new Set(
    (await db.collection("municipalities").find().toArray()).map((m) =>
      m._id.toString()
    )
  );
  const usersWithMun = await db
    .collection("users")
    .find({ municipalityId: { $exists: true, $ne: null } })
    .toArray();
  for (const u of usersWithMun) {
    if (u.municipalityId && !munIds.has(u.municipalityId.toString())) {
      issues.push(
        `User ${u._id} (${u.email}) → municipalityId ${u.municipalityId} NO EXISTE`
      );
    }
  }

  // Vehicles → companyId → companies
  const vehicles = await db.collection("vehicles").find().toArray();
  for (const v of vehicles) {
    if (v.companyId && !companyIds.has(v.companyId.toString())) {
      issues.push(
        `Vehicle ${v._id} (placa: ${v.plate}) → companyId ${v.companyId} NO EXISTE`
      );
    }
  }

  // Drivers → userId → users
  const userIds = new Set(
    (await db.collection("users").find().toArray()).map((u) =>
      u._id.toString()
    )
  );
  const drivers = await db.collection("drivers").find().toArray();
  for (const d of drivers) {
    if (d.userId && !userIds.has(d.userId.toString())) {
      issues.push(
        `Driver ${d._id} (doc: ${d.documentNumber}) → userId ${d.userId} NO EXISTE`
      );
    }
  }

  // Routes → municipalityId → municipalities
  const routes = await db.collection("routes").find().toArray();
  for (const r of routes) {
    if (r.municipalityId && !munIds.has(r.municipalityId.toString())) {
      issues.push(
        `Route ${r._id} (${r.code}) → municipalityId ${r.municipalityId} NO EXISTE`
      );
    }
  }

  // Trips → routeId → routes
  const routeIds = new Set(routes.map((r) => r._id.toString()));
  const trips = await db.collection("trips").find().toArray();
  for (const t of trips) {
    if (t.routeId && !routeIds.has(t.routeId.toString())) {
      issues.push(
        `Trip ${t._id} → routeId ${t.routeId} NO EXISTE`
      );
    }
    if (t.vehicleId) {
      const vehicleExists = vehicles.some(
        (v) => v._id.toString() === t.vehicleId.toString()
      );
      if (!vehicleExists) {
        issues.push(
          `Trip ${t._id} → vehicleId ${t.vehicleId} NO EXISTE`
        );
      }
    }
  }

  return issues;
}

async function main() {
  console.log("🔍 AUDITORÍA DE BASE DE DATOS SFIT");
  console.log("═".repeat(60));

  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 15000,
    family: 4,
  });

  const db = mongoose.connection.db!;
  console.log(`\n✅ Conectado a: ${db.databaseName}\n`);

  // 1. Conteo de documentos
  console.log("📊 CONTEO DE DOCUMENTOS POR COLECCIÓN");
  console.log("─".repeat(60));

  const stats: CollectionStats[] = [];
  for (const colName of COLLECTIONS) {
    try {
      const s = await auditCollection(db, colName);
      stats.push(s);
    } catch {
      stats.push({
        name: colName,
        count: -1,
        sampleIds: [],
        sampleFields: [],
      });
    }
  }

  // Ordenar por cantidad descendente
  stats.sort((a, b) => b.count - a.count);

  const maxNameLen = Math.max(...stats.map((s) => s.name.length));
  for (const s of stats) {
    const icon = s.count === 0 ? "⬜" : s.count > 100 ? "🔴" : s.count > 10 ? "🟡" : "🟢";
    const pad = s.name.padEnd(maxNameLen);
    console.log(`  ${icon} ${pad}  ${s.count === -1 ? "ERROR" : s.count.toLocaleString()}`);
  }

  const total = stats.reduce((sum, s) => sum + (s.count > 0 ? s.count : 0), 0);
  console.log(`\n  TOTAL: ${total.toLocaleString()} documentos`);

  // 2. Colecciones con datos (detalles)
  const withData = stats.filter((s) => s.count > 0);
  if (withData.length > 0) {
    console.log("\n\n📋 DETALLES DE COLECCIONES CON DATOS");
    console.log("═".repeat(60));

    for (const s of withData) {
      console.log(`\n▸ ${s.name} (${s.count} docs)`);
      if (s.sampleFields.length > 0) {
        const sample = s.sampleFields[0];
        const keys = Object.keys(sample);
        console.log(`  Campos: ${keys.join(", ")}`);
        console.log(`  Muestra: ${JSON.stringify(sample, null, 2).split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n")}`);
      }
    }
  }

  // 3. Colecciones vacías
  const empty = stats.filter((s) => s.count === 0);
  if (empty.length > 0) {
    console.log("\n\n⬜ COLECCIONES VACÍAS");
    console.log("─".repeat(60));
    for (const s of empty) {
      console.log(`  ${s.name}`);
    }
  }

  // 4. Verificación de integridad referencial
  console.log("\n\n🔗 VERIFICACIÓN DE INTEGRIDAD REFERENCIAL");
  console.log("─".repeat(60));

  const orphanIssues = await checkOrphans(db);
  if (orphanIssues.length === 0) {
    console.log("  ✅ Sin problemas de referencias huérfanas detectados.");
  } else {
    console.log(`  ⚠️  ${orphanIssues.length} problemas encontrados:\n`);
    for (const issue of orphanIssues) {
      console.log(`  ❌ ${issue}`);
    }
  }

  // 5. Resumen de limpieza
  console.log("\n\n📝 RESUMEN PARA LIMPIEZA");
  console.log("═".repeat(60));
  console.log("Colecciones con datos que podrían necesitar limpieza:");
  for (const s of withData) {
    const label =
      s.name === "users"
        ? " ← Ya limpiaste este"
        : "";
    console.log(`  • ${s.name}: ${s.count} docs${label}`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Auditoría completada.");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
