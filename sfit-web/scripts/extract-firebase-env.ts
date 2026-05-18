/**
 * Lee `secrets/firebase-admin.json` y añade/actualiza las 3 vars de Firebase
 * Admin en `.env.local`. La `private_key` se escapa con `\n` literales para
 * que dotenv la parsee correctamente.
 *
 * No imprime la key. Idempotente: vuelve a correr es seguro.
 */
import fs from "node:fs";
import path from "node:path";

const saFile = path.join(process.cwd(), "secrets", "firebase-admin.json");
if (!fs.existsSync(saFile)) {
  console.error(`No encontré ${saFile}.`);
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saFile, "utf8")) as {
  project_id: string;
  client_email: string;
  private_key: string;
};

const escapedKey = sa.private_key.replace(/\n/g, "\\n");
const envFile = path.join(process.cwd(), ".env.local");
const original = fs.existsSync(envFile)
  ? fs.readFileSync(envFile, "utf8")
  : "";

function upsertVar(text: string, key: string, value: string): string {
  const line = key.startsWith("FIREBASE_PRIVATE_KEY")
    ? `${key}="${value}"`
    : `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  const sep = text && !text.endsWith("\n") ? "\n" : "";
  return `${text}${sep}${line}\n`;
}

let next = original;
next = upsertVar(next, "FIREBASE_PROJECT_ID", sa.project_id);
next = upsertVar(next, "FIREBASE_CLIENT_EMAIL", sa.client_email);
next = upsertVar(next, "FIREBASE_PRIVATE_KEY", escapedKey);

if (next === original) {
  console.log("Las 3 vars FIREBASE_* ya estaban con los valores correctos.");
} else {
  fs.writeFileSync(envFile, next, "utf8");
  console.log(`Vars FIREBASE_* escritas en ${path.relative(process.cwd(), envFile)}`);
}
