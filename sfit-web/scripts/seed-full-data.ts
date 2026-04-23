/**
 * Seed completo de datos de prueba para SFIT.
 * Uso: cd sfit-web && npx tsx scripts/seed-full-data.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const PROVINCE_ID = new Types.ObjectId("69e38d63e52dc0303612c21e");
const MUNIC_ID    = new Types.ObjectId("69e38d63e52dc0303612c21f");

// ── Modelos inline con strict:false (evitar importar toda la app) ─────────────

const loose = { strict: false, timestamps: true } as const;

const UserModel        = mongoose.models.User        ?? model("User",        new Schema({}, loose));
const VehicleTypeModel = mongoose.models.VehicleType ?? model("VehicleType", new Schema({}, loose));
const CompanyModel     = mongoose.models.Company     ?? model("Company",     new Schema({}, loose));
const DriverModel      = mongoose.models.Driver      ?? model("Driver",      new Schema({}, loose));
const VehicleModel     = mongoose.models.Vehicle     ?? model("Vehicle",     new Schema({}, loose));
const RouteModel       = mongoose.models.Route       ?? model("Route",       new Schema({}, loose));
const FleetEntryModel  = mongoose.models.FleetEntry  ?? model("FleetEntry",  new Schema({}, loose));
const TripModel        = mongoose.models.Trip        ?? model("Trip",        new Schema({}, loose));
const InspectionModel  = mongoose.models.Inspection  ?? model("Inspection",  new Schema({}, loose));
const CitizenReportModel = mongoose.models.CitizenReport ?? model("CitizenReport", new Schema({}, loose));
const SanctionModel    = mongoose.models.Sanction    ?? model("Sanction",    new Schema({}, loose));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsert(Model: mongoose.Model<any>, filter: object, data: object) {
  return Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: "after" });
}

async function getUserId(email: string): Promise<Types.ObjectId> {
  const u = await UserModel.findOne({ email }).select("_id").lean() as any;
  if (!u) throw new Error(`Usuario ${email} no encontrado — ejecuta seed-test-users.ts primero.`);
  return u._id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  const fiscalId    = await getUserId("fiscal@sfit.test");
  const operadorId  = await getUserId("operador@sfit.test");
  const conductorId = await getUserId("conductor@sfit.test");
  const ciudadanoId = await getUserId("ciudadano@sfit.test");
  console.log("✅ Usuarios cargados");

  // ── VehicleTypes ──────────────────────────────────────────────────────────
  const vtOmnibus = await upsert(VehicleTypeModel,
    { municipalityId: MUNIC_ID, key: "omnibus" },
    {
      key: "omnibus", name: "Omnibus", description: "Bus de transporte urbano de gran capacidad",
      municipalityId: MUNIC_ID,
      checklistItems: ["SOAT vigente", "Revisión técnica vigente", "Extintor operativo",
        "Cinturones de seguridad", "Luces delanteras", "Frenos en buen estado"],
      inspectionFields: [
        { key: "soat", label: "SOAT vigente", type: "boolean" },
        { key: "rev_tecnica", label: "Revisión técnica vigente", type: "boolean" },
        { key: "extintor", label: "Extintor operativo", type: "boolean" },
        { key: "cinturones", label: "Cinturones de seguridad", type: "boolean" },
        { key: "luces", label: "Luces delanteras", type: "boolean" },
        { key: "frenos", label: "Frenos en buen estado", type: "boolean" },
      ],
      reportCategories: ["velocidad_excesiva", "cobro_excesivo", "mal_estado", "conducta_inapropiada"],
      isCustom: false, active: true,
    });

  const vtMinibus = await upsert(VehicleTypeModel,
    { municipalityId: MUNIC_ID, key: "minibus" },
    {
      key: "minibus", name: "Minibus", description: "Minibús de transporte urbano",
      municipalityId: MUNIC_ID,
      checklistItems: ["SOAT vigente", "Revisión técnica vigente", "Extintor operativo",
        "Luces delanteras", "Frenos en buen estado"],
      inspectionFields: [
        { key: "soat", label: "SOAT vigente", type: "boolean" },
        { key: "rev_tecnica", label: "Revisión técnica vigente", type: "boolean" },
        { key: "extintor", label: "Extintor operativo", type: "boolean" },
        { key: "luces", label: "Luces delanteras", type: "boolean" },
        { key: "frenos", label: "Frenos en buen estado", type: "boolean" },
      ],
      reportCategories: ["velocidad_excesiva", "cobro_excesivo", "mal_estado"],
      isCustom: false, active: true,
    });

  const vtTaxi = await upsert(VehicleTypeModel,
    { municipalityId: MUNIC_ID, key: "taxi" },
    {
      key: "taxi", name: "Taxi", description: "Taxi de servicio individual",
      municipalityId: MUNIC_ID,
      checklistItems: ["SOAT vigente", "Revisión técnica vigente", "Taxímetro calibrado"],
      inspectionFields: [
        { key: "soat", label: "SOAT vigente", type: "boolean" },
        { key: "rev_tecnica", label: "Revisión técnica vigente", type: "boolean" },
        { key: "taximetro", label: "Taxímetro calibrado", type: "boolean" },
      ],
      reportCategories: ["cobro_excesivo", "conducta_inapropiada", "mal_estado"],
      isCustom: false, active: true,
    });
  console.log("✅ Tipos de vehículo creados");

  // ── Companies ─────────────────────────────────────────────────────────────
  const comp1 = await upsert(CompanyModel,
    { municipalityId: MUNIC_ID, ruc: "20601234567" },
    {
      razonSocial: "Trans Cusco SAC", ruc: "20601234567",
      municipalityId: MUNIC_ID,
      representanteLegal: { name: "Aurelio Mamani Quispe", dni: "29501234", phone: "984000001" },
      vehicleTypeKeys: ["omnibus", "minibus"],
      documents: [], active: true, reputationScore: 85,
    });

  const comp2 = await upsert(CompanyModel,
    { municipalityId: MUNIC_ID, ruc: "20607654321" },
    {
      razonSocial: "Inka Express EIRL", ruc: "20607654321",
      municipalityId: MUNIC_ID,
      representanteLegal: { name: "Flor Huanca Ccoa", dni: "29505678", phone: "984000002" },
      vehicleTypeKeys: ["minibus"],
      documents: [], active: true, reputationScore: 92,
    });

  const comp3 = await upsert(CompanyModel,
    { municipalityId: MUNIC_ID, ruc: "20601111222" },
    {
      razonSocial: "Taxis Unidos SRL", ruc: "20601111222",
      municipalityId: MUNIC_ID,
      representanteLegal: { name: "Rodrigo Ttito Villa", dni: "29509999", phone: "984000003" },
      vehicleTypeKeys: ["taxi"],
      documents: [], active: true, reputationScore: 78,
    });
  console.log("✅ Empresas creadas");

  // ── Drivers ───────────────────────────────────────────────────────────────
  const drv1 = await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511001" },
    {
      name: "Carlos Mamani Quispe", dni: "29511001",
      licenseNumber: "Q15001234", licenseCategory: "A-IIb",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      phone: "984111001", status: "apto",
      continuousHours: 0, restHours: 8, reputationScore: 95, active: true,
    });

  const drv2 = await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511002" },
    {
      name: "Juan Huanca Flores", dni: "29511002",
      licenseNumber: "Q15005678", licenseCategory: "A-IIb",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      phone: "984111002", status: "apto",
      continuousHours: 0, restHours: 8, reputationScore: 88, active: true,
    });

  const drv3 = await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511003" },
    {
      name: "Rosa Ccopa Villena", dni: "29511003",
      licenseNumber: "Q15009999", licenseCategory: "A-IIa",
      companyId: comp2._id, municipalityId: MUNIC_ID,
      phone: "984111003", status: "apto",
      continuousHours: 0, restHours: 8, reputationScore: 91, active: true,
    });

  const drv4 = await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511004" },
    {
      name: "Pedro Quispe Condori", dni: "29511004",
      licenseNumber: "Q15002222", licenseCategory: "A-I",
      companyId: comp3._id, municipalityId: MUNIC_ID,
      phone: "984111004", status: "riesgo",
      continuousHours: 10, restHours: 4, reputationScore: 62, active: true,
    });

  await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511005" },
    {
      name: "Luis Ttito Corimanya", dni: "29511005",
      licenseNumber: "Q15003333", licenseCategory: "A-IIb",
      companyId: comp2._id, municipalityId: MUNIC_ID,
      phone: "984111005", status: "no_apto",
      continuousHours: 0, restHours: 8, reputationScore: 45, active: false,
    });

  // Conductor de prueba vinculado al usuario conductor@sfit.test
  await upsert(DriverModel,
    { municipalityId: MUNIC_ID, dni: "29511099" },
    {
      name: "Conductor SFIT", dni: "29511099",
      userId: conductorId,
      licenseNumber: "Q15009900", licenseCategory: "A-IIb",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      phone: "984111099", status: "apto",
      continuousHours: 0, restHours: 8, reputationScore: 100, active: true,
    });
  // Actualizar el User conductor con su DNI y municipalityId correcto
  await UserModel.findByIdAndUpdate(conductorId, {
    $set: { dni: "29511099", municipalityId: MUNIC_ID, provinceId: PROVINCE_ID },
  });
  // Asegurar que fiscal y operador también apunten al municipio de prueba
  await UserModel.findByIdAndUpdate(fiscalId, {
    $set: { municipalityId: MUNIC_ID, provinceId: PROVINCE_ID },
  });
  await UserModel.findByIdAndUpdate(operadorId, {
    $set: { municipalityId: MUNIC_ID, provinceId: PROVINCE_ID },
  });
  console.log("✅ Conductores creados");

  // ── Vehicles ──────────────────────────────────────────────────────────────
  const soatOk   = new Date("2026-12-31");
  const soatVenc = new Date("2025-06-30");

  const veh1 = await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "ABC-123" },
    {
      plate: "ABC-123", vehicleTypeKey: "omnibus",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      brand: "Mercedes-Benz", model: "OF-1721", year: 2019,
      status: "disponible", reputationScore: 90,
      soatExpiry: soatOk, lastInspectionStatus: "aprobada", active: true,
    });

  const veh2 = await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "DEF-456" },
    {
      plate: "DEF-456", vehicleTypeKey: "omnibus",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      brand: "Volvo", model: "B9R", year: 2021,
      status: "en_ruta", reputationScore: 87,
      soatExpiry: soatOk, lastInspectionStatus: "aprobada", active: true,
    });

  const veh3 = await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "GHI-789" },
    {
      plate: "GHI-789", vehicleTypeKey: "minibus",
      companyId: comp2._id, municipalityId: MUNIC_ID,
      brand: "Toyota", model: "Hiace", year: 2020,
      status: "disponible", reputationScore: 74,
      soatExpiry: soatOk, lastInspectionStatus: "observada", active: true,
    });

  const veh4 = await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "JKL-012" },
    {
      plate: "JKL-012", vehicleTypeKey: "taxi",
      companyId: comp3._id, municipalityId: MUNIC_ID,
      brand: "Hyundai", model: "Accent", year: 2022,
      status: "disponible", reputationScore: 82,
      soatExpiry: soatOk, lastInspectionStatus: "pendiente", active: true,
    });

  const veh5 = await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "MNO-345" },
    {
      plate: "MNO-345", vehicleTypeKey: "minibus",
      companyId: comp2._id, municipalityId: MUNIC_ID,
      brand: "Nissan", model: "Urvan", year: 2018,
      status: "fuera_de_servicio", reputationScore: 40,
      soatExpiry: soatVenc, lastInspectionStatus: "rechazada", active: false,
    });

  await upsert(VehicleModel,
    { municipalityId: MUNIC_ID, plate: "PQR-678" },
    {
      plate: "PQR-678", vehicleTypeKey: "omnibus",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      brand: "Scania", model: "K410", year: 2023,
      status: "disponible", reputationScore: 98,
      soatExpiry: soatOk, lastInspectionStatus: "pendiente", active: true,
    });
  console.log("✅ Vehículos creados");

  // ── Routes ────────────────────────────────────────────────────────────────
  const rt1 = await upsert(RouteModel,
    { municipalityId: MUNIC_ID, code: "R001" },
    {
      code: "R001", name: "Centro - San Sebastián", type: "ruta",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      vehicleTypeKey: "omnibus", stops: 12, length: "8.5 km",
      vehicleCount: 3, status: "activa", frequencies: ["10 min"],
      waypoints: [
        { order: 0, lat: -13.5165, lng: -71.9782, label: "Plaza de Armas" },
        { order: 1, lat: -13.5188, lng: -71.9757, label: "Av. El Sol" },
        { order: 2, lat: -13.5218, lng: -71.9694, label: "Estadio Universitario" },
        { order: 3, lat: -13.5248, lng: -71.9619, label: "Av. La Cultura - UNSAAC" },
        { order: 4, lat: -13.5279, lng: -71.9553, label: "Ttio" },
        { order: 5, lat: -13.5305, lng: -71.9513, label: "Vía de Evitamiento" },
        { order: 6, lat: -13.5330, lng: -71.9478, label: "San Sebastián Plaza" },
      ],
    });

  const rt2 = await upsert(RouteModel,
    { municipalityId: MUNIC_ID, code: "R002" },
    {
      code: "R002", name: "Centro - San Jerónimo", type: "ruta",
      companyId: comp2._id, municipalityId: MUNIC_ID,
      vehicleTypeKey: "minibus", stops: 9, length: "6.2 km",
      vehicleCount: 2, status: "activa", frequencies: ["15 min"],
      waypoints: [
        { order: 0, lat: -13.5165, lng: -71.9782, label: "Plaza de Armas" },
        { order: 1, lat: -13.5185, lng: -71.9748, label: "Av. El Sol - Correos" },
        { order: 2, lat: -13.5210, lng: -71.9640, label: "Av. La Cultura" },
        { order: 3, lat: -13.5240, lng: -71.9560, label: "Larapa" },
        { order: 4, lat: -13.5298, lng: -71.9490, label: "San Jerónimo Plaza" },
      ],
    });

  const rt3 = await upsert(RouteModel,
    { municipalityId: MUNIC_ID, code: "R003" },
    {
      code: "R003", name: "Wanchaq - Poroy", type: "ruta",
      companyId: comp1._id, municipalityId: MUNIC_ID,
      vehicleTypeKey: "omnibus", stops: 15, length: "12.0 km",
      vehicleCount: 2, status: "activa", frequencies: ["20 min"],
      waypoints: [
        { order: 0, lat: -13.5219, lng: -71.9603, label: "Wanchaq" },
        { order: 1, lat: -13.5181, lng: -71.9719, label: "Limacpampa" },
        { order: 2, lat: -13.5165, lng: -71.9782, label: "Plaza de Armas" },
        { order: 3, lat: -13.5148, lng: -71.9812, label: "Saphy" },
        { order: 4, lat: -13.5102, lng: -71.9852, label: "Santa Ana" },
        { order: 5, lat: -13.4982, lng: -72.0082, label: "Cachimayo" },
        { order: 6, lat: -13.4861, lng: -72.0282, label: "Poroy" },
      ],
    });
  console.log("✅ Rutas creadas");

  // ── FleetEntries (hoy) ────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const fe1 = await upsert(FleetEntryModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id, date: today },
    {
      vehicleId: veh1._id, driverId: drv1._id, routeId: rt1._id,
      municipalityId: MUNIC_ID, date: today,
      departureTime: "07:00", km: 45,
      status: "disponible", checklistComplete: true,
      registeredBy: operadorId,
    });

  const fe2 = await upsert(FleetEntryModel,
    { municipalityId: MUNIC_ID, vehicleId: veh3._id, date: today },
    {
      vehicleId: veh3._id, driverId: drv3._id, routeId: rt2._id,
      municipalityId: MUNIC_ID, date: today,
      departureTime: "09:00", km: 22,
      status: "disponible", checklistComplete: true,
      registeredBy: operadorId,
    });

  const fe3 = await upsert(FleetEntryModel,
    { municipalityId: MUNIC_ID, vehicleId: veh2._id, date: today },
    {
      vehicleId: veh2._id, driverId: drv2._id, routeId: rt3._id,
      municipalityId: MUNIC_ID, date: today,
      departureTime: "06:30", km: 60,
      status: "en_ruta", checklistComplete: true,
      registeredBy: operadorId,
    });
  console.log("✅ Asignaciones de flota creadas");

  // ── Trips ─────────────────────────────────────────────────────────────────
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const start1 = new Date(yesterday); start1.setHours(7, 0);
  const end1   = new Date(yesterday); end1.setHours(7, 45);
  const start2 = new Date(yesterday); start2.setHours(9, 0);
  const end2   = new Date(yesterday); end2.setHours(9, 30);
  const start3 = new Date(yesterday); start3.setHours(14, 0);
  const end3   = new Date(yesterday); end3.setHours(14, 50);
  const start4 = new Date(today);     start4.setHours(8, 0);

  await upsert(TripModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id, startTime: start1 },
    {
      vehicleId: veh1._id, driverId: drv1._id, routeId: rt1._id, fleetEntryId: fe1._id,
      municipalityId: MUNIC_ID, startTime: start1, endTime: end1,
      km: 8.5, passengers: 42, status: "completado",
    });

  await upsert(TripModel,
    { municipalityId: MUNIC_ID, vehicleId: veh3._id, startTime: start2 },
    {
      vehicleId: veh3._id, driverId: drv3._id, routeId: rt2._id, fleetEntryId: fe2._id,
      municipalityId: MUNIC_ID, startTime: start2, endTime: end2,
      km: 6.2, passengers: 18, status: "completado",
    });

  await upsert(TripModel,
    { municipalityId: MUNIC_ID, vehicleId: veh2._id, startTime: start3 },
    {
      vehicleId: veh2._id, driverId: drv2._id, routeId: rt3._id, fleetEntryId: fe3._id,
      municipalityId: MUNIC_ID, startTime: start3, endTime: end3,
      km: 12.0, passengers: 37, status: "completado",
    });

  await upsert(TripModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id, startTime: start4 },
    {
      vehicleId: veh1._id, driverId: drv1._id, routeId: rt1._id, fleetEntryId: fe1._id,
      municipalityId: MUNIC_ID, startTime: start4,
      km: 0, passengers: 30, status: "en_curso",
    });
  console.log("✅ Viajes creados");

  // ── Inspections ───────────────────────────────────────────────────────────
  const insp1Date = new Date(yesterday); insp1Date.setHours(10, 0);
  const insp2Date = new Date(yesterday); insp2Date.setHours(11, 0);
  const insp3Date = new Date(today);     insp3Date.setHours(9, 0);

  const allPass  = (items: string[]) => items.map(item => ({ item, passed: true }));
  const withFail = (items: string[], failIdx: number[]) =>
    items.map((item, i) => ({ item, passed: !failIdx.includes(i) }));

  const checklistOmnibus = [
    "SOAT vigente", "Revisión técnica vigente", "Extintor operativo",
    "Cinturones de seguridad", "Luces delanteras", "Frenos en buen estado",
  ];

  await upsert(InspectionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id, date: insp1Date },
    {
      vehicleId: veh1._id, driverId: drv1._id, fiscalId: fiscalId,
      municipalityId: MUNIC_ID, date: insp1Date,
      vehicleTypeKey: "omnibus",
      checklistResults: allPass(checklistOmnibus),
      score: 100, result: "aprobada",
      observations: "Vehículo en óptimas condiciones.", evidenceUrls: [],
    });

  await upsert(InspectionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh3._id, date: insp2Date },
    {
      vehicleId: veh3._id, driverId: drv3._id, fiscalId: fiscalId,
      municipalityId: MUNIC_ID, date: insp2Date,
      vehicleTypeKey: "minibus",
      checklistResults: withFail(checklistOmnibus.slice(0, 5), [1]),
      score: 80, result: "observada",
      observations: "Revisión técnica próxima a vencer. Plazo de 15 días.", evidenceUrls: [],
    });

  await upsert(InspectionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh5._id, date: insp3Date },
    {
      vehicleId: veh5._id, driverId: drv4._id, fiscalId: fiscalId,
      municipalityId: MUNIC_ID, date: insp3Date,
      vehicleTypeKey: "minibus",
      checklistResults: withFail(checklistOmnibus.slice(0, 5), [0, 1, 3]),
      score: 40, result: "rechazada",
      observations: "SOAT vencido. Revisión técnica vencida. No puede circular.", evidenceUrls: [],
    });
  console.log("✅ Inspecciones creadas");

  // ── CitizenReports ────────────────────────────────────────────────────────
  await upsert(CitizenReportModel,
    { municipalityId: MUNIC_ID, vehicleId: veh3._id, citizenId: ciudadanoId,
      createdAt: new Date(yesterday.getTime() + 15.5 * 3600000) },
    {
      vehicleId: veh3._id, citizenId: ciudadanoId,
      municipalityId: MUNIC_ID, vehicleTypeKey: "minibus",
      category: "velocidad_excesiva",
      description: "El minibus GHI-789 iba a exceso de velocidad por la Av. El Sol.",
      status: "pendiente", citizenReputationLevel: 3,
      fraudScore: 30, fraudLayers: [], assignedFiscalId: fiscalId,
    });

  await upsert(CitizenReportModel,
    { municipalityId: MUNIC_ID, vehicleId: veh5._id, citizenId: ciudadanoId,
      createdAt: new Date(yesterday.getTime() + 18 * 3600000) },
    {
      vehicleId: veh5._id, citizenId: ciudadanoId,
      municipalityId: MUNIC_ID, vehicleTypeKey: "minibus",
      category: "mal_estado",
      description: "Vehículo MNO-345 con humo negro excesivo y puertas en mal estado.",
      status: "revision", citizenReputationLevel: 3,
      fraudScore: 20, fraudLayers: [], assignedFiscalId: fiscalId,
    });

  await upsert(CitizenReportModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id, citizenId: ciudadanoId,
      createdAt: new Date(today.getTime() + 7.75 * 3600000) },
    {
      vehicleId: veh1._id, citizenId: ciudadanoId,
      municipalityId: MUNIC_ID, vehicleTypeKey: "omnibus",
      category: "cobro_excesivo",
      description: "ABC-123 cobró S/3.00 en ruta que cuesta S/1.00.",
      status: "validado", citizenReputationLevel: 3,
      fraudScore: 10, fraudLayers: [], assignedFiscalId: fiscalId,
    });
  console.log("✅ Reportes ciudadanos creados");

  // ── Sanctions ─────────────────────────────────────────────────────────────
  await upsert(SanctionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh3._id,
      createdAt: new Date(yesterday.getTime() + 11.5 * 3600000) },
    {
      vehicleId: veh3._id, driverId: drv3._id, companyId: comp2._id,
      municipalityId: MUNIC_ID,
      faultType: "revision_tecnica_vencida",
      amountSoles: 500, amountUIT: "0.2 UIT",
      status: "emitida", notifications: [], issuedBy: fiscalId,
    });

  await upsert(SanctionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh5._id,
      createdAt: new Date(yesterday.getTime() + 16 * 3600000) },
    {
      vehicleId: veh5._id, driverId: drv4._id, companyId: comp3._id,
      municipalityId: MUNIC_ID,
      faultType: "soat_vencido",
      amountSoles: 1000, amountUIT: "0.4 UIT",
      status: "notificada", notifications: [
        { channel: "email", target: "pquispe@example.com", status: "enviado", sentAt: new Date() },
      ],
      issuedBy: fiscalId,
    });

  await upsert(SanctionModel,
    { municipalityId: MUNIC_ID, vehicleId: veh1._id,
      createdAt: new Date(today.getTime() + 9.5 * 3600000) },
    {
      vehicleId: veh1._id, driverId: drv1._id, companyId: comp1._id,
      municipalityId: MUNIC_ID,
      faultType: "exceso_velocidad",
      amountSoles: 200, amountUIT: "0.08 UIT",
      status: "confirmada", notifications: [], issuedBy: fiscalId,
    });
  console.log("✅ Sanciones creadas");

  await mongoose.disconnect();
  console.log("\n🎉 Seed completado exitosamente.");
}

main().catch((err) => {
  console.error("❌ Error en seed:", err.message);
  process.exit(1);
});
