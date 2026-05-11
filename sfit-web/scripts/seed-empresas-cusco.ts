/**
 * Seed de empresas de transporte variadas en Cusco para pruebas del flujo
 * del conductor (buscar y asociarse a empresa durante onboarding).
 *
 * Crea (upsert idempotente) ~8 empresas con `serviceScope` mixto:
 *   - 5 urbano_distrital (con paraderos fijos)
 *   - 1 urbano_provincial (con paraderos, varios distritos)
 *   - 2 interprovincial_regional (sin paraderos, rutas largas)
 *
 * Pensado para que el conductor al hacer onboarding vea distintos badges
 * (azul "con paraderos" / púrpura "sin paraderos") y pueda elegir según
 * el tipo real de transporte que va a manejar.
 *
 * Requisito previo: `npx tsx scripts/seed-test-users.ts` debe haber
 * corrido antes (necesario para crear la Municipality Cusco con
 * ubigeo "080101"). Si no existe, el seed falla con error claro.
 *
 * Uso: cd sfit-web && npx tsx scripts/seed-empresas-cusco.ts
 *
 * Idempotente: re-ejecutar es seguro — usa upsert por RUC.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const CUSCO_MUNICIPALITY_UBIGEO = "080101";
const CUSCO_DEPT_CODE = "08";
const CUSCO_PROVINCE_CODE = "0801";

const loose = { strict: false, timestamps: true } as const;
const CompanyModel = mongoose.models.Company ?? model("Company", new Schema({}, loose));
const MunicipalityModel =
  mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

interface SeedCompany {
  ruc: string;
  razonSocial: string;
  serviceScope:
    | "urbano_distrital"
    | "urbano_provincial"
    | "interprovincial_regional"
    | "interregional_nacional";
  vehicleTypeKeys: string[];
  domicilio?: string;
}

// Empresas reales / verosímiles de Cusco con scope variado.
const EMPRESAS: SeedCompany[] = [
  // ── Urbanas distritales (la mayoría — rutas dentro de Cusco) ──
  {
    ruc: "20100200011",
    razonSocial: "Transportes Imperial S.A.C.",
    serviceScope: "urbano_distrital",
    vehicleTypeKeys: ["omnibus", "minibus"],
    domicilio: "Av. La Cultura 1500, Wanchaq, Cusco",
  },
  {
    ruc: "20100200012",
    razonSocial: "Empresa de Transportes El Inca S.R.L.",
    serviceScope: "urbano_distrital",
    vehicleTypeKeys: ["omnibus"],
    domicilio: "Av. Pachacútec 850, Wanchaq, Cusco",
  },
  {
    ruc: "20100200013",
    razonSocial: "Transportes Tahuantinsuyo E.I.R.L.",
    serviceScope: "urbano_distrital",
    vehicleTypeKeys: ["minibus", "microbus"],
    domicilio: "Av. Tomasa Tito Condemayta 450, San Sebastián, Cusco",
  },
  {
    ruc: "20100200014",
    razonSocial: "Servicios Cusco Bus S.A.C.",
    serviceScope: "urbano_distrital",
    vehicleTypeKeys: ["omnibus", "minibus"],
    domicilio: "Av. 28 de Julio 320, Cusco",
  },
  {
    ruc: "20100200015",
    razonSocial: "Transportes Wanchaq S.A.C.",
    serviceScope: "urbano_distrital",
    vehicleTypeKeys: ["microbus"],
    domicilio: "Av. Tullumayo 740, Wanchaq, Cusco",
  },

  // ── Urbano provincial (con paraderos, abarca toda la provincia) ──
  {
    ruc: "20100200021",
    razonSocial: "Transportes Sacsayhuamán S.R.L.",
    serviceScope: "urbano_provincial",
    vehicleTypeKeys: ["omnibus"],
    domicilio: "Av. de la Cultura 2200, San Jerónimo, Cusco",
  },

  // ── Interprovinciales (sin paraderos, rutas Cusco → otras ciudades) ──
  {
    ruc: "20100200031",
    razonSocial: "Transportes Andinos del Sur S.A.C.",
    serviceScope: "interprovincial_regional",
    vehicleTypeKeys: ["omnibus"],
    domicilio: "Av. Antonio Lorena 1180, Cusco — Terminal terrestre",
  },
  {
    ruc: "20100200032",
    razonSocial: "Expreso Cusco - Puno S.A.C.",
    serviceScope: "interprovincial_regional",
    vehicleTypeKeys: ["omnibus"],
    domicilio: "Av. Vallejo Santoni s/n, Cusco — Terminal terrestre",
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✖ Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  console.log("→ Conectando a Mongo…");
  await mongoose.connect(uri);

  // Resolver la municipalidad Cusco. Es prerequisito creado por
  // seed-test-users.ts; si no existe, abortamos con mensaje claro.
  console.log("→ Buscando municipalidad Cusco (ubigeo 080101)…");
  const muni = await MunicipalityModel.findOne({
    ubigeoCode: CUSCO_MUNICIPALITY_UBIGEO,
  }).lean<{ _id: unknown } | null>();
  if (!muni) {
    console.error(
      "✖ No existe Municipality con ubigeoCode=080101. Ejecuta primero: " +
        "npx tsx scripts/seed-test-users.ts",
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  const municipalityId = muni._id;

  console.log(`→ Upsert de ${EMPRESAS.length} empresas en Cusco…`);
  let created = 0;
  let updated = 0;
  for (const emp of EMPRESAS) {
    const existing = await CompanyModel.findOne({ ruc: emp.ruc }).lean();
    const payload = {
      municipalityId,
      ruc: emp.ruc,
      razonSocial: emp.razonSocial,
      serviceScope: emp.serviceScope,
      vehicleTypeKeys: emp.vehicleTypeKeys,
      status: "activo",
      active: true,
      reputationScore: 100,
      representanteLegal: {
        name: "Representante Legal Test",
        dni: "70000000",
      },
      documents: [],
      coverage: {
        departmentCodes: [CUSCO_DEPT_CODE],
        provinceCodes:
          emp.serviceScope.startsWith("urbano") ? [CUSCO_PROVINCE_CODE] : [],
        districtCodes:
          emp.serviceScope === "urbano_distrital"
            ? [CUSCO_MUNICIPALITY_UBIGEO]
            : [],
      },
      authorizations: [],
      ...(emp.domicilio ? { domicilio: emp.domicilio } : {}),
    };

    if (existing) {
      await CompanyModel.updateOne({ ruc: emp.ruc }, { $set: payload });
      updated++;
      console.log(`  ↻ ${emp.razonSocial} (${emp.serviceScope})`);
    } else {
      await CompanyModel.create(payload);
      created++;
      console.log(`  ✚ ${emp.razonSocial} (${emp.serviceScope})`);
    }
  }

  console.log(`✓ Listo. Creadas: ${created}, actualizadas: ${updated}.`);
  console.log(
    "  El conductor ahora puede buscar estas empresas en el onboarding " +
      "o en 'Mi empresa' y elegir según el tipo de servicio.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✖", err);
  process.exit(1);
});
