/**
 * Backup completo de MongoDB Atlas → JSON files locales.
 *
 * Conecta con el driver mongodb (sin dependencias extra), itera todas las
 * colecciones de la base activa y serializa cada documento a JSON. Usa
 * EJSON canonical para preservar tipos BSON (ObjectId, Date, Decimal128).
 *
 * Output: sfit-web/backups/<timestamp>/<collection>.jsonl
 *   - jsonl = un documento JSON por línea (resistente a archivos enormes)
 *   - manifest.json = metadatos del backup (timestamp, db, colecciones, conteos)
 *
 * Uso: npx tsx scripts/backup-db.ts
 *
 * Restore: la contraparte se hará con `restore-db.ts` (no incluido aquí).
 */

import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { config } from "dotenv";
import dns from "node:dns";
import fs from "node:fs/promises";
import path from "node:path";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI no está definido en .env.local");
  process.exit(1);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const client = new MongoClient(MONGODB_URI!, { serverSelectionTimeoutMS: 30000 });
  console.log("🔌 Conectando a MongoDB Atlas...");
  await client.connect();

  const dbName = client.db().databaseName;
  console.log(`✅ Conectado a la base: ${dbName}`);

  const ts = timestamp();
  const backupDir = path.join(process.cwd(), "backups", `${ts}-pre-cleanup`);
  await fs.mkdir(backupDir, { recursive: true });
  console.log(`📁 Directorio de backup: ${backupDir}`);

  const db = client.db();
  const collections = await db.listCollections().toArray();
  console.log(`📦 Encontradas ${collections.length} colecciones`);

  const manifest: {
    timestamp: string;
    database: string;
    collections: { name: string; count: number; bytes: number }[];
  } = {
    timestamp: new Date().toISOString(),
    database: dbName,
    collections: [],
  };

  for (const c of collections) {
    const col = db.collection(c.name);
    const cursor = col.find({});
    const file = path.join(backupDir, `${c.name}.jsonl`);
    const handle = await fs.open(file, "w");
    let count = 0;
    let bytes = 0;
    try {
      for await (const doc of cursor) {
        const line = EJSON.stringify(doc) + "\n";
        await handle.write(line);
        count += 1;
        bytes += Buffer.byteLength(line, "utf8");
      }
    } finally {
      await handle.close();
    }
    manifest.collections.push({ name: c.name, count, bytes });
    console.log(`  ✓ ${c.name}: ${count} docs (${(bytes / 1024).toFixed(1)} KB)`);
  }

  await fs.writeFile(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  await client.close();

  const totalDocs = manifest.collections.reduce((s, c) => s + c.count, 0);
  const totalBytes = manifest.collections.reduce((s, c) => s + c.bytes, 0);
  console.log(`\n✅ Backup completo:`);
  console.log(`   ${manifest.collections.length} colecciones · ${totalDocs} docs · ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📁 ${backupDir}`);
}

main().catch((err) => {
  console.error("❌ Backup falló:", err);
  process.exit(1);
});
