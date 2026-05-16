/**
 * Restore de un backup hecho con `backup-db.ts`.
 *
 * Lee los `.jsonl` de `sfit-web/backups/<dir>/` y los reinserta en MongoDB
 * Atlas usando EJSON para preservar tipos BSON (ObjectId, Date, Decimal128).
 *
 * Por defecto NO borra colecciones existentes — agrega o actualiza por _id
 * usando bulkWrite con replaceOne+upsert. Para forzar drop antes de restaurar:
 *
 *   npx tsx scripts/restore-db.ts --dir backups/2026-05-16_010233-pre-cleanup --drop
 *
 * Uso normal:
 *   npx tsx scripts/restore-db.ts --dir backups/2026-05-16_010233-pre-cleanup
 */

import { MongoClient, type AnyBulkWriteOperation } from "mongodb";
import { EJSON } from "bson";
import { config } from "dotenv";
import dns from "node:dns";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createReadStream } from "node:fs";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI no está definido en .env.local");
  process.exit(1);
}

function parseArgs(): { dir: string; drop: boolean } {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  if (dirIdx === -1 || !args[dirIdx + 1]) {
    console.error("❌ Debes pasar --dir <ruta del backup>");
    process.exit(1);
  }
  return {
    dir: args[dirIdx + 1],
    drop: args.includes("--drop"),
  };
}

async function* readJsonl(file: string): AsyncIterable<Record<string, unknown>> {
  const rl = readline.createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield EJSON.parse(line) as Record<string, unknown>;
  }
}

async function main() {
  const { dir, drop } = parseArgs();
  const backupDir = path.resolve(process.cwd(), dir);
  const manifestPath = path.join(backupDir, "manifest.json");

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    timestamp: string;
    database: string;
    collections: { name: string; count: number }[];
  };

  console.log(`📦 Backup origen: ${backupDir}`);
  console.log(`   tomado el ${manifest.timestamp} desde la base "${manifest.database}"`);
  console.log(`   ${manifest.collections.length} colecciones · ${manifest.collections.reduce((s, c) => s + c.count, 0)} docs`);
  console.log(`   modo: ${drop ? "DROP + RESTORE" : "UPSERT (no destructivo)"}`);

  const client = new MongoClient(MONGODB_URI!, { serverSelectionTimeoutMS: 30000 });
  console.log("\n🔌 Conectando a MongoDB Atlas...");
  await client.connect();
  const db = client.db();
  console.log(`✅ Conectado a la base destino: ${db.databaseName}`);

  for (const c of manifest.collections) {
    const file = path.join(backupDir, `${c.name}.jsonl`);
    try {
      await fs.access(file);
    } catch {
      console.warn(`  ⚠️  ${c.name}: archivo no encontrado, saltando`);
      continue;
    }

    const col = db.collection(c.name);

    if (drop) {
      try {
        await col.drop();
      } catch {
        // ignore — collection may not exist
      }
    }

    if (c.count === 0) {
      console.log(`  ✓ ${c.name}: vacío en el backup, saltando`);
      continue;
    }

    const ops: AnyBulkWriteOperation[] = [];
    let total = 0;
    for await (const doc of readJsonl(file)) {
      ops.push({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      });
      if (ops.length >= 500) {
        await col.bulkWrite(ops, { ordered: false });
        total += ops.length;
        ops.length = 0;
      }
    }
    if (ops.length > 0) {
      await col.bulkWrite(ops, { ordered: false });
      total += ops.length;
    }
    console.log(`  ✓ ${c.name}: ${total} docs restaurados`);
  }

  await client.close();
  console.log(`\n✅ Restore completo`);
}

main().catch((err) => {
  console.error("❌ Restore falló:", err);
  process.exit(1);
});
