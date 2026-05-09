/**
 * Seed de datos operativos para la empresa de transporte de prueba.
 *
 * Crea (upsert idempotente) para `Transportes SFIT Test S.A.C.` (RUC
 * 20100000001):
 *   - 6 vehículos (status `disponible`)
 *   - 6 conductores (status `apto`)
 *   - 3 rutas urbanas en Cusco con waypoints reales
 *
 * Requisito previo: `npx tsx scripts/seed-test-users.ts` debe haber corrido
 * primero (la empresa y la municipalidad/provincia se crean ahí).
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/seed-empresa-test-data.ts
 *
 * Nota sobre `polylineGeometry`: las rutas se crean sin polyline cacheada.
 * Para que el trazado siga calles (no líneas rectas atravesando manzanas),
 * el operador puede llamar al endpoint POST /api/rutas/{id}/recalcular o
 * el sistema lo recalcula en background al hacer PATCH waypoints.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const TEST_COMPANY_RUC         = "20100000001";
const TEST_PROVINCE_UBIGEO     = "0801";
const TEST_MUNICIPALITY_UBIGEO = "080101";

const loose = { strict: false, timestamps: true } as const;

const CompanyModel      = mongoose.models.Company      ?? model("Company",      new Schema({}, loose));
const VehicleModel      = mongoose.models.Vehicle      ?? model("Vehicle",      new Schema({}, loose));
const DriverModel       = mongoose.models.Driver       ?? model("Driver",       new Schema({}, loose));
const RouteModel        = mongoose.models.Route        ?? model("Route",        new Schema({}, loose));
const MunicipalityModel = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

type AnyDoc = { _id: Types.ObjectId; [k: string]: unknown };

const VEHICLES = [
  { plate: "T1A-001", brand: "Mercedes-Benz", model: "OF 1721", year: 2020, vehicleTypeKey: "omnibus"  },
  { plate: "T1A-002", brand: "Volvo",         model: "B270F",   year: 2019, vehicleTypeKey: "omnibus"  },
  { plate: "T1A-003", brand: "Hyundai",       model: "County",  year: 2021, vehicleTypeKey: "minibus"  },
  { plate: "T1A-004", brand: "Modasa",        model: "Titan",   year: 2018, vehicleTypeKey: "omnibus"  },
  { plate: "T1A-005", brand: "Toyota",        model: "Coaster", year: 2022, vehicleTypeKey: "minibus"  },
  { plate: "T1A-006", brand: "JAC",           model: "HK6601",  year: 2021, vehicleTypeKey: "microbus" },
];

const DRIVERS = [
  { name: "Carlos Quispe Mamani",     dni: "70000001", licenseNumber: "B71000001", licenseCategory: "A-IIIB" },
  { name: "Luis Huamán Condori",      dni: "70000002", licenseNumber: "B71000002", licenseCategory: "A-IIIB" },
  { name: "Juan Tito Zavala",         dni: "70000003", licenseNumber: "B71000003", licenseCategory: "A-IIIB" },
  { name: "Pedro Pumacahua Vargas",   dni: "70000004", licenseNumber: "B71000004", licenseCategory: "A-IIIB" },
  { name: "Mario Choquehuanca Ccapa", dni: "70000005", licenseNumber: "B71000005", licenseCategory: "A-IIIB" },
  { name: "Roberto Sallo Apaza",      dni: "70000006", licenseNumber: "B71000006", licenseCategory: "A-IIIB" },
];

// Coordenadas reales de Cusco — orden ida (centro → periferia).
const ROUTES = [
  {
    code: "R-01",
    name: "Centro - San Sebastián",
    direction: "ida" as const,
    waypoints: [
      { label: "Plaza de Armas",     lat: -13.51750, lng: -71.97883 },
      { label: "Av. El Sol",         lat: -13.52250, lng: -71.97400 },
      { label: "Wanchaq",            lat: -13.52830, lng: -71.96060 },
      { label: "Av. La Cultura",     lat: -13.53120, lng: -71.94400 },
      { label: "San Sebastián",      lat: -13.53580, lng: -71.89870 },
    ],
  },
  {
    code: "R-02",
    name: "Centro - San Jerónimo",
    direction: "ida" as const,
    waypoints: [
      { label: "Plaza de Armas",     lat: -13.51750, lng: -71.97883 },
      { label: "Av. El Sol",         lat: -13.52250, lng: -71.97400 },
      { label: "Wanchaq",            lat: -13.52830, lng: -71.96060 },
      { label: "San Sebastián",      lat: -13.53580, lng: -71.89870 },
      { label: "San Jerónimo",       lat: -13.54540, lng: -71.88430 },
    ],
  },
  {
    code: "R-03",
    name: "Centro - Aeropuerto",
    direction: "ida" as const,
    waypoints: [
      { label: "Plaza de Armas",     lat: -13.51750, lng: -71.97883 },
      { label: "Av. El Sol",         lat: -13.52250, lng: -71.97400 },
      { label: "Wanchaq",            lat: -13.52830, lng: -71.96060 },
      { label: "Aeropuerto Velasco", lat: -13.53580, lng: -71.93880 },
    ],
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  const company = await CompanyModel.findOne({ ruc: TEST_COMPANY_RUC }).lean<AnyDoc | null>();
  if (!company) {
    throw new Error(
      `Empresa con RUC ${TEST_COMPANY_RUC} no existe. Corre primero:\n` +
      `  npx tsx scripts/seed-test-users.ts`,
    );
  }
  const companyId = company._id;
  const municipalityId = company.municipalityId as Types.ObjectId;
  console.log(`✓ Empresa: ${(company as { razonSocial?: string }).razonSocial} (${companyId})`);

  // Verificar que la muni de la empresa existe (si no, no podemos sembrar).
  const muni = await MunicipalityModel.findById(municipalityId).lean<AnyDoc | null>();
  if (!muni) {
    throw new Error(`Municipalidad ${municipalityId} no existe.`);
  }

  // ── 1. Vehículos ─────────────────────────────────────────────────────────
  let vehicleCount = 0;
  for (const v of VEHICLES) {
    await VehicleModel.findOneAndUpdate(
      { plate: v.plate },
      {
        $set: {
          municipalityId,
          companyId,
          plate: v.plate,
          vehicleTypeKey: v.vehicleTypeKey,
          brand: v.brand,
          model: v.model,
          year: v.year,
          status: "disponible",
          lastInspectionStatus: "aprobada",
          reputationScore: 100,
          // SOAT vigente — 1 año desde hoy (suficiente para que no salga
          // como alerta "próximo a vencer" en el dashboard).
          soatExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    vehicleCount++;
  }
  console.log(`✓ ${vehicleCount} vehículos sembrados (status=disponible)`);

  // ── 2. Conductores ───────────────────────────────────────────────────────
  let driverCount = 0;
  for (const d of DRIVERS) {
    await DriverModel.findOneAndUpdate(
      { dni: d.dni },
      {
        $set: {
          municipalityId,
          companyId,
          name: d.name,
          dni: d.dni,
          licenseNumber: d.licenseNumber,
          licenseCategory: d.licenseCategory,
          status: "apto",
          continuousHours: 0,
          restHours: 8,
          reputationScore: 100,
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    driverCount++;
  }
  console.log(`✓ ${driverCount} conductores sembrados (status=apto)`);

  // ── 3. Rutas ─────────────────────────────────────────────────────────────
  let routeCount = 0;
  for (const r of ROUTES) {
    await RouteModel.findOneAndUpdate(
      { municipalityId, code: r.code },
      {
        $set: {
          municipalityId,
          companyId,
          code: r.code,
          name: r.name,
          type: "ruta",
          stops: r.waypoints.length,
          vehicleTypeKey: "omnibus",
          vehicleCount: 0,
          status: "activa",
          frequencies: ["10 min"],
          waypoints: r.waypoints.map((w, idx) => ({
            order: idx,
            lat: w.lat,
            lng: w.lng,
            label: w.label,
            districtCode: TEST_MUNICIPALITY_UBIGEO,
          })),
          serviceScope: "urbano_provincial",
          originDistrictCode: TEST_MUNICIPALITY_UBIGEO,
          destinationDistrictCode: TEST_MUNICIPALITY_UBIGEO,
          traversedDistrictCodes: [TEST_MUNICIPALITY_UBIGEO],
          direction: r.direction,
          // polylineGeometry queda null — el operador puede recalcular vía
          // POST /api/rutas/{id}/recalcular para obtener el trazado por
          // calles (Google Routes v2 snap-to-roads). Ver nota arriba.
          polylineGeometry: null,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    routeCount++;
  }
  console.log(`✓ ${routeCount} rutas sembradas (sin polylineGeometry — usar /recalcular)`);

  console.log("\n=== RESUMEN EMPRESA DE PRUEBA ===");
  console.log(`Empresa:        ${(company as { razonSocial?: string }).razonSocial}`);
  console.log(`Empresa ID:     ${companyId}`);
  console.log(`Municipalidad:  ${(muni as { name?: string }).name} (${municipalityId})`);
  console.log(`Provincia:      ${TEST_PROVINCE_UBIGEO}`);
  console.log(`Vehículos:      ${vehicleCount}`);
  console.log(`Conductores:    ${driverCount}`);
  console.log(`Rutas:          ${routeCount}`);
  console.log("\nLogin operador: operador@sfit.test / Sfit2026!");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
