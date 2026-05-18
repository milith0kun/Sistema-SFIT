/**
 * Migración: simplifica `serviceScope` de 4 valores a 2.
 *
 *   urbano_distrital          → urbano
 *   urbano_provincial         → urbano
 *   interprovincial_regional  → interprovincial
 *   interregional_nacional    → interprovincial
 *
 * Cubre:
 *   - Company.serviceScope
 *   - Company.authorizations[].scope
 *   - Route.serviceScope
 *
 * Idempotente: si una entrada ya tiene `urbano` o `interprovincial`, se
 * salta. Si tiene un valor desconocido, se mapea a `urbano` por defecto.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

function mapScope(old: string | undefined): "urbano" | "interprovincial" {
  if (old === "urbano" || old === "interprovincial") return old;
  if (old === "interprovincial_regional" || old === "interregional_nacional") {
    return "interprovincial";
  }
  // urbano_distrital, urbano_provincial, undefined, cualquier otro → urbano
  return "urbano";
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // ── Companies ──────────────────────────────────────────────────────────
  const companies = await db
    .collection("companies")
    .find(
      {},
      { projection: { _id: 1, razonSocial: 1, serviceScope: 1, authorizations: 1 } },
    )
    .toArray();
  let companiesUpdated = 0;
  let authsRewritten = 0;
  for (const c of companies) {
    const doc = c as unknown as {
      _id: unknown;
      razonSocial?: string;
      serviceScope?: string;
      authorizations?: { scope?: string; [k: string]: unknown }[];
    };
    const nextScope = mapScope(doc.serviceScope);
    const nextAuths = (doc.authorizations ?? []).map((a) => ({
      ...a,
      scope: mapScope(a.scope),
    }));
    const scopeChanged = doc.serviceScope !== nextScope;
    const authsChanged =
      JSON.stringify(doc.authorizations ?? []) !== JSON.stringify(nextAuths);
    if (!scopeChanged && !authsChanged) continue;
    await db.collection("companies").updateOne(
      { _id: doc._id as never },
      { $set: { serviceScope: nextScope, authorizations: nextAuths } },
    );
    companiesUpdated += 1;
    if (authsChanged) authsRewritten += 1;
    console.log(
      `  ↻ ${doc.razonSocial ?? "?"}: scope=${doc.serviceScope ?? "—"} → ${nextScope}` +
        (authsChanged ? ` (auths actualizadas: ${nextAuths.length})` : ""),
    );
  }
  console.log(
    `Companies: ${companiesUpdated} actualizadas; ${authsRewritten} con autorizaciones reescritas\n`,
  );

  // ── Routes ─────────────────────────────────────────────────────────────
  const routes = await db
    .collection("routes")
    .find({}, { projection: { _id: 1, code: 1, serviceScope: 1 } })
    .toArray();
  let routesUpdated = 0;
  for (const r of routes) {
    const doc = r as unknown as {
      _id: unknown;
      code?: string;
      serviceScope?: string;
    };
    const nextScope = mapScope(doc.serviceScope);
    if (doc.serviceScope === nextScope) continue;
    await db
      .collection("routes")
      .updateOne({ _id: doc._id as never }, { $set: { serviceScope: nextScope } });
    routesUpdated += 1;
    console.log(`  ↻ ruta ${doc.code ?? "?"}: ${doc.serviceScope ?? "—"} → ${nextScope}`);
  }
  console.log(`Routes: ${routesUpdated} actualizadas\n`);

  // ── Resumen final ──────────────────────────────────────────────────────
  const compUrbano = await db
    .collection("companies")
    .countDocuments({ serviceScope: "urbano" });
  const compInterp = await db
    .collection("companies")
    .countDocuments({ serviceScope: "interprovincial" });
  const rUrbano = await db
    .collection("routes")
    .countDocuments({ serviceScope: "urbano" });
  const rInterp = await db
    .collection("routes")
    .countDocuments({ serviceScope: "interprovincial" });
  console.log("=== Estado final ===");
  console.log(`Companies urbano:          ${compUrbano}`);
  console.log(`Companies interprovincial: ${compInterp}`);
  console.log(`Routes urbano:             ${rUrbano}`);
  console.log(`Routes interprovincial:    ${rInterp}`);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
