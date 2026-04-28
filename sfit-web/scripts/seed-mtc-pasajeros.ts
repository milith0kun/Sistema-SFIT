/**
 * Seed catálogo MTC — Parque Habilitado de Transporte de Pasajeros 2022-2024.
 *
 * Origen: https://www.datosabiertos.gob.pe/dataset/transporte-terrestre-de-
 * pasajeros-nacional-e-internacional-2022-2024-ministerio-de
 *
 * Carga 71k filas → ~7,160 empresas autorizadas (`TransportAuthorization`)
 * y ~29,643 vehículos habilitados (`AuthorizedVehicle`). Cada placa duplicada
 * se conserva con el corte más reciente.
 *
 * Política de actualización (idempotente):
 *   - `runId` único por ejecución.
 *   - Cada upsert escribe `source.lastSeenRunId = runId`.
 *   - Al final, registros con dataset igual y `lastSeenRunId !== runId`
 *     se marcan `active = false` (revocados o ya no en la última versión).
 *
 * Uso:
 *   cd sfit-web
 *   npx tsx scripts/seed-mtc-pasajeros.ts                # nacional
 *   npx tsx scripts/seed-mtc-pasajeros.ts --depto=08     # solo Cusco
 *   npx tsx scripts/seed-mtc-pasajeros.ts --depto=08,15  # Cusco + Lima
 *   npx tsx scripts/seed-mtc-pasajeros.ts --limit=500    # smoke test
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import dns from "node:dns";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

import { TransportAuthorization } from "@/models/TransportAuthorization";
import { AuthorizedVehicle } from "@/models/AuthorizedVehicle";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const DATASET_ID = "mtc-pasajeros-2022-2024";
const SOURCE_URL =
  "https://www.datosabiertos.gob.pe/sites/default/files/Parque_Habilitado_Transporte_Pasajeros_2022-2024.xlsx";
const CACHE_DIR  = join(process.cwd(), ".cache", "mtc");
const CACHE_FILE = join(CACHE_DIR, "pasajeros_2022_2024.xlsx");

// ── Args CLI ────────────────────────────────────────────────────────────────

/**
 * El filtro `--depto=` acepta tanto código UBIGEO de 2 dígitos (`08`, `15`)
 * como nombre textual del departamento (`CUSCO`, `LIMA`). El XLSX trae
 * ambas cosas en columnas distintas: `UBIGEO` (numérico) y `DEPARTAMENTO`
 * (texto). Hacemos match contra cualquiera para no perder filas que vengan
 * sin UBIGEO (las que no son de Lima vienen casi todas con UBIGEO null).
 */
function parseDeptoFilter(): { codes: Set<string>; names: Set<string> } | null {
  const arg = process.argv.find((a) => a.startsWith("--depto="));
  if (!arg) return null;
  const tokens = (arg.split("=")[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const t of tokens) {
    if (/^\d{2}$/.test(t)) codes.add(t);
    else names.add(stripAccents(t).toUpperCase());
  }
  return { codes, names };
}

function parseLimit(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return null;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Descarga (con cache) ────────────────────────────────────────────────────

async function ensureFile(): Promise<void> {
  if (existsSync(CACHE_FILE)) return;
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Descargando dataset desde ${SOURCE_URL}…`);
  const res = await fetch(SOURCE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} al descargar el XLSX`);
  await pipeline(
    res.body as unknown as NodeJS.ReadableStream,
    createWriteStream(CACHE_FILE),
  );
  console.log(`  guardado en ${CACHE_FILE}`);
}

// ── Normalización de valores ────────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v).trim();
}
function asNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function asInt(v: unknown): number | undefined {
  const n = asNumber(v);
  return n === undefined ? undefined : Math.trunc(n);
}
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function normalizeLabel(v: unknown): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  return stripAccents(s).toUpperCase().replace(/\s+/g, " ").trim();
}
function yyyymmddToDate(v: unknown): Date | null {
  const n = asInt(v);
  if (!n || n < 19000101 || n > 22000101) return null;
  const y = Math.floor(n / 10000);
  const m = Math.floor((n % 10000) / 100);
  const d = n % 100;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function ubigeoTo6(v: unknown): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return undefined;
  return digits.padStart(6, "0").slice(-6);
}

// ── Tipos ───────────────────────────────────────────────────────────────────

interface RawRow {
  ruc: string;
  razonSocial: string;
  vigenciaHasta: Date | null;
  placa: string;
  anioFabr?: number;
  nChasis?: string;
  nMotor?: string;
  marca?: string;
  clase?: string;
  ambitoOpera?: string;
  ambitoTerritorial?: string;
  naturalezaServicio?: string;
  tipoServicio?: string;
  actividadServicio?: string;
  nLlantas?: number;
  nAsientos?: number;
  nEjes?: number;
  cargaUtil?: number;
  pesoSeco?: number;
  pesoBruto?: number;
  largo?: number;
  ancho?: number;
  altura?: number;
  departmentName?: string;
  provinceName?: string;
  districtName?: string;
  ubigeoCode?: string;
  departmentCode?: string;
  provinceCode?: string;
  fechaCorte?: number;
}

function rowHash(r: RawRow): string {
  const h = createHash("md5");
  h.update(JSON.stringify({
    p: r.placa, r: r.ruc, c: r.fechaCorte,
    cl: r.clase, an: r.anioFabr, nc: r.nChasis, nm: r.nMotor,
    ts: r.tipoServicio, ac: r.actividadServicio, na: r.naturalezaServicio,
    u: r.ubigeoCode, vh: r.vigenciaHasta?.getTime(),
  }));
  return h.digest("hex");
}

// ── Lectura del XLSX ────────────────────────────────────────────────────────

function readSheet(filter: { codes: Set<string>; names: Set<string> } | null, limit: number | null): RawRow[] {
  console.log("Leyendo XLSX…");
  const wb = XLSX.readFile(CACHE_FILE, { cellDates: false, cellNF: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Hoja no encontrada en el XLSX");

  // Normalizamos los headers para ser tolerantes al espacio sucio que trae
  // el archivo (`'ANIO_ FABR'`, `'N_ EJES'`, etc.).
  const aoa = XLSX.utils.sheet_to_json<Array<unknown>>(ws, {
    header: 1, raw: true, defval: null,
  });
  if (aoa.length < 2) throw new Error("Hoja vacía");
  const headerRow = aoa[0].map((h) => String(h ?? "").replace(/\s+/g, "").toUpperCase());
  const idx = (name: string): number => {
    const i = headerRow.indexOf(name);
    if (i < 0) throw new Error(`Columna esperada no encontrada: ${name}`);
    return i;
  };

  const COLS = {
    RUC:        idx("RUC"),
    RAZON:      idx("RAZON_SOCIAL"),
    VIG:        idx("VIGENCIA_HASTA"),
    PLACA:      idx("PLACA"),
    ANIO:       idx("ANIO_FABR"),
    CHASIS:     idx("N_CHASIS"),
    MOTOR:      idx("N_MOTOR"),
    MARCA:      idx("MARCA"),
    CLASE:      idx("CLASE"),
    AMB_OP:     idx("AMB_OPERA"),
    AMB_TER:    idx("AMB_TERRIT"),
    NAT:        idx("NATUR_SERVICIO"),
    TIPO:       idx("TIPO_SERVICIO"),
    ACT:        idx("ACTIV_SERVICIO"),
    LLANTAS:    idx("N_LLANTAS"),
    ASIENT:     idx("N_ASIENT"),
    EJES:       idx("N_EJES"),
    CARGA:      idx("CARGA_UTIL"),
    PSECO:      idx("P_SECO"),
    PBRUTO:     idx("P_BRUTO"),
    LONG:       idx("LONG"),
    ANCHO:      idx("ANCHO"),
    ALT:        idx("ALTURA"),
    DEP:        idx("DEPARTAMENTO"),
    PROV:       idx("PROVINCIA"),
    DIST:       idx("DISTRITO"),
    UBIGEO:     idx("UBIGEO"),
    CORTE:      idx("FECHA_CORTE"),
  };

  const out: RawRow[] = [];
  let skipped = 0;

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    const ruc   = asString(r[COLS.RUC]);
    const razon = asString(r[COLS.RAZON]);
    const placa = asString(r[COLS.PLACA])?.toUpperCase();
    if (!ruc || !razon || !placa) { skipped++; continue; }

    const ubigeo = ubigeoTo6(r[COLS.UBIGEO]);
    const departmentCode = ubigeo?.slice(0, 2);
    const provinceCode   = ubigeo?.slice(0, 4);
    const departmentName = normalizeLabel(r[COLS.DEP]);
    const provinceName   = normalizeLabel(r[COLS.PROV]);
    const districtName   = normalizeLabel(r[COLS.DIST]);

    if (filter) {
      const matchByCode = !!departmentCode && filter.codes.has(departmentCode);
      const matchByName = !!departmentName && filter.names.has(departmentName);
      if (!matchByCode && !matchByName) continue;
    }

    out.push({
      ruc, razonSocial: razon, placa,
      vigenciaHasta:    yyyymmddToDate(r[COLS.VIG]),
      anioFabr:         asInt(r[COLS.ANIO]),
      nChasis:          asString(r[COLS.CHASIS]),
      nMotor:           asString(r[COLS.MOTOR]),
      marca:            normalizeLabel(r[COLS.MARCA]),
      clase:            normalizeLabel(r[COLS.CLASE]),
      ambitoOpera:        normalizeLabel(r[COLS.AMB_OP]),
      ambitoTerritorial:  normalizeLabel(r[COLS.AMB_TER]),
      naturalezaServicio: normalizeLabel(r[COLS.NAT]),
      tipoServicio:       normalizeLabel(r[COLS.TIPO]),
      actividadServicio:  normalizeLabel(r[COLS.ACT]),
      nLlantas:  asInt(r[COLS.LLANTAS]),
      nAsientos: asInt(r[COLS.ASIENT]),
      nEjes:     asInt(r[COLS.EJES]),
      cargaUtil: asNumber(r[COLS.CARGA]),
      pesoSeco:  asNumber(r[COLS.PSECO]),
      pesoBruto: asNumber(r[COLS.PBRUTO]),
      largo:     asNumber(r[COLS.LONG]),
      ancho:     asNumber(r[COLS.ANCHO]),
      altura:    asNumber(r[COLS.ALT]),
      departmentName, provinceName, districtName,
      ubigeoCode:     ubigeo,
      departmentCode, provinceCode,
      fechaCorte: asInt(r[COLS.CORTE]),
    });

    if (limit && out.length >= limit) break;
  }
  console.log(`  ${out.length.toLocaleString()} filas tras filtros (skipped por datos faltantes: ${skipped})`);
  return out;
}

// ── Pipeline de upserts ─────────────────────────────────────────────────────

async function seedAuthorizations(rows: RawRow[], runId: string): Promise<Map<string, mongoose.Types.ObjectId>> {
  console.log("Pase 1/2 — empresas autorizadas (TransportAuthorization)");
  const grouped = new Map<string, RawRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.ruc) ?? [];
    list.push(r);
    grouped.set(r.ruc, list);
  }
  console.log(`  ${grouped.size.toLocaleString()} RUCs únicos`);

  const idByRuc = new Map<string, mongoose.Types.ObjectId>();
  let processed = 0;
  const ops: mongoose.AnyBulkWriteOperation[] = [];

  for (const [ruc, list] of grouped) {
    const last = list.reduce((a, b) => ((a.fechaCorte ?? 0) >= (b.fechaCorte ?? 0) ? a : b));
    const coverageDepartments     = [...new Set(list.map((r) => r.departmentCode).filter((x): x is string => !!x))].sort();
    const coverageDepartmentNames = [...new Set(list.map((r) => r.departmentName).filter((x): x is string => !!x))].sort();
    const tiposServicio = [...new Set(list.map((r) => r.tipoServicio).filter((x): x is string => !!x))].sort();
    const ambitos       = [...new Set(list.map((r) => r.ambitoTerritorial).filter((x): x is string => !!x))].sort();
    const vigenciaHasta = list.reduce<Date | null>((acc, r) => {
      if (!r.vigenciaHasta) return acc;
      return !acc || r.vigenciaHasta > acc ? r.vigenciaHasta : acc;
    }, null);

    ops.push({
      updateOne: {
        filter: { ruc, mode: "terrestre_pasajeros" },
        update: {
          $set: {
            razonSocial: last.razonSocial,
            vigenciaHasta,
            coverageDepartments,
            coverageDepartmentNames,
            tiposServicio,
            ambitos,
            vehicleCount: list.length,
            active: true,
            "source.dataset": DATASET_ID,
            "source.fechaCorte": last.fechaCorte,
            "source.lastSeenRunId": runId,
          },
          $setOnInsert: { ruc, mode: "terrestre_pasajeros" },
        },
        upsert: true,
      },
    });

    if (ops.length >= 500) {
      await TransportAuthorization.bulkWrite(ops, { ordered: false });
      ops.length = 0;
    }
    processed++;
    if (processed % 1000 === 0) console.log(`  ${processed.toLocaleString()} / ${grouped.size.toLocaleString()}`);
  }
  if (ops.length > 0) await TransportAuthorization.bulkWrite(ops, { ordered: false });

  // Recoger IDs en una sola consulta para luego enlazar vehículos.
  const docs = await TransportAuthorization
    .find({ ruc: { $in: [...grouped.keys()] }, mode: "terrestre_pasajeros" })
    .select("_id ruc")
    .lean();
  for (const d of docs) idByRuc.set(d.ruc, d._id as mongoose.Types.ObjectId);

  console.log(`  upsert OK · ${idByRuc.size.toLocaleString()} authorizations indexadas`);
  return idByRuc;
}

async function seedVehicles(
  rows: RawRow[],
  idByRuc: Map<string, mongoose.Types.ObjectId>,
  runId: string,
): Promise<void> {
  console.log("Pase 2/2 — vehículos habilitados (AuthorizedVehicle)");

  // De-duplicar por placa, conservando la fila con FECHA_CORTE más reciente.
  const byPlaca = new Map<string, RawRow>();
  for (const r of rows) {
    const prev = byPlaca.get(r.placa);
    if (!prev || (r.fechaCorte ?? 0) > (prev.fechaCorte ?? 0)) byPlaca.set(r.placa, r);
  }
  console.log(`  ${byPlaca.size.toLocaleString()} placas únicas`);

  let processed = 0;
  const ops: mongoose.AnyBulkWriteOperation[] = [];

  for (const r of byPlaca.values()) {
    const authorizationId = idByRuc.get(r.ruc);
    if (!authorizationId) continue; // no debería pasar — el RUC fue insertado en el pase 1

    ops.push({
      updateOne: {
        filter: { placa: r.placa, mode: "terrestre_pasajeros" },
        update: {
          $set: {
            authorizationId,
            ruc: r.ruc,
            clase: r.clase,
            marca: r.marca,
            anioFabr: r.anioFabr,
            nChasis: r.nChasis,
            nMotor: r.nMotor,
            ambitoOpera: r.ambitoOpera,
            ambitoTerritorial: r.ambitoTerritorial,
            naturalezaServicio: r.naturalezaServicio,
            tipoServicio: r.tipoServicio,
            actividadServicio: r.actividadServicio,
            nLlantas: r.nLlantas,
            nAsientos: r.nAsientos,
            nEjes: r.nEjes,
            cargaUtil: r.cargaUtil,
            pesoSeco: r.pesoSeco,
            pesoBruto: r.pesoBruto,
            largo: r.largo,
            ancho: r.ancho,
            altura: r.altura,
            ubigeoCode: r.ubigeoCode,
            departmentCode: r.departmentCode,
            provinceCode: r.provinceCode,
            departmentName: r.departmentName,
            provinceName: r.provinceName,
            districtName: r.districtName,
            vigenciaHasta: r.vigenciaHasta,
            fechaCorte: r.fechaCorte,
            active: true,
            "source.dataset": DATASET_ID,
            "source.rowHash": rowHash(r),
            "source.lastSeenRunId": runId,
          },
          $setOnInsert: { placa: r.placa, mode: "terrestre_pasajeros" },
        },
        upsert: true,
      },
    });

    if (ops.length >= 500) {
      await AuthorizedVehicle.bulkWrite(ops, { ordered: false });
      ops.length = 0;
    }
    processed++;
    if (processed % 5000 === 0) console.log(`  ${processed.toLocaleString()} / ${byPlaca.size.toLocaleString()}`);
  }
  if (ops.length > 0) await AuthorizedVehicle.bulkWrite(ops, { ordered: false });
  console.log(`  upsert OK · ${processed.toLocaleString()} vehículos`);
}

async function deactivateStale(runId: string, scoped: boolean): Promise<void> {
  // Si corremos con --depto solo desactivamos dentro del scope para no marcar
  // como inactivos los registros del resto del país que no se procesaron.
  if (scoped) {
    console.log("(seed con --depto: omitimos la desactivación masiva)");
    return;
  }
  console.log("Marcando como inactivos los registros que ya no están en el dataset…");
  const [a, v] = await Promise.all([
    TransportAuthorization.updateMany(
      { "source.dataset": DATASET_ID, "source.lastSeenRunId": { $ne: runId } },
      { $set: { active: false } },
    ),
    AuthorizedVehicle.updateMany(
      { "source.dataset": DATASET_ID, "source.lastSeenRunId": { $ne: runId } },
      { $set: { active: false } },
    ),
  ]);
  console.log(`  authorizations desactivadas: ${a.modifiedCount}`);
  console.log(`  vehicles desactivados:       ${v.modifiedCount}`);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  const filter = parseDeptoFilter();
  const limit  = parseLimit();
  const runId  = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`Run ${runId}`);
  if (filter) {
    const parts = [...filter.codes, ...filter.names];
    console.log(`Filtro depto: ${parts.join(", ")}`);
  } else {
    console.log("Sin filtro de depto: nacional completo");
  }
  if (limit) console.log(`Límite de filas: ${limit.toLocaleString()}`);

  await ensureFile();

  console.log("Conectando a MongoDB Atlas…");
  await mongoose.connect(uri);

  try {
    const rows = readSheet(filter, limit);
    if (rows.length === 0) { console.log("Nada que procesar."); return; }

    const idByRuc = await seedAuthorizations(rows, runId);
    await seedVehicles(rows, idByRuc, runId);
    await deactivateStale(runId, !!filter || !!limit);

    console.log("Hecho.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
