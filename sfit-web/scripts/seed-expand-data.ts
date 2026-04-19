/**
 * Seed de expansión para el Super Admin — múltiples provincias,
 * municipalidades, y datos históricos para estadísticas y gráficos.
 *
 * Ejecutar DESPUÉS de seed-test-users.ts y seed-full-data.ts:
 *   npx tsx scripts/seed-expand-data.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const ProvinceModel      = mongoose.models.Province      ?? model("Province",      new Schema({}, loose));
const MunicipalityModel  = mongoose.models.Municipality  ?? model("Municipality",  new Schema({}, loose));
const UserModel          = mongoose.models.User          ?? model("User",          new Schema({}, loose));
const CompanyModel       = mongoose.models.Company       ?? model("Company",       new Schema({}, loose));
const VehicleTypeModel   = mongoose.models.VehicleType   ?? model("VehicleType",   new Schema({}, loose));
const VehicleModel       = mongoose.models.Vehicle       ?? model("Vehicle",       new Schema({}, loose));
const DriverModel        = mongoose.models.Driver        ?? model("Driver",        new Schema({}, loose));
const InspectionModel    = mongoose.models.Inspection    ?? model("Inspection",    new Schema({}, loose));
const CitizenReportModel = mongoose.models.CitizenReport ?? model("CitizenReport", new Schema({}, loose));
const SanctionModel      = mongoose.models.Sanction      ?? model("Sanction",      new Schema({}, loose));
const ApelacionModel     = mongoose.models.Apelacion     ?? model("Apelacion",     new Schema({}, loose));
const AuditLogModel      = mongoose.models.AuditLog      ?? model("AuditLog",      new Schema({}, loose));
const NotificationModel  = mongoose.models.Notification  ?? model("Notification",  new Schema({}, loose));
const RecompensaModel    = mongoose.models.Recompensa    ?? model("Recompensa",    new Schema({}, loose));

async function up<T extends mongoose.Document>(
  Model: mongoose.Model<T>,
  filter: object,
  data: object
) {
  return Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, lean: true });
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number, offsetHours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(offsetHours, rnd(0, 59), 0, 0);
  return d;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Provincias adicionales ────────────────────────────────────────────────────
const EXTRA_PROVINCES = [
  { id: new Types.ObjectId("69e38d63e52dc0303612c220"), name: "Arequipa",     region: "Arequipa"   },
  { id: new Types.ObjectId("69e38d63e52dc0303612c221"), name: "Puno",         region: "Puno"       },
  { id: new Types.ObjectId("69e38d63e52dc0303612c222"), name: "Apurímac",     region: "Apurímac"   },
  { id: new Types.ObjectId("69e38d63e52dc0303612c223"), name: "Madre de Dios",region: "Madre de Dios" },
];

// ── Municipalidades adicionales ───────────────────────────────────────────────
const EXTRA_MUNICIPALITIES = [
  { id: new Types.ObjectId("69e38d63e52dc0303612c230"), name: "Municipalidad de Arequipa",     prov: 0 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c231"), name: "Municipalidad de Camaná",       prov: 0 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c232"), name: "Municipalidad de Juliaca",      prov: 1 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c233"), name: "Municipalidad de Puno",         prov: 1 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c234"), name: "Municipalidad de Abancay",      prov: 2 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c235"), name: "Municipalidad de Andahuaylas",  prov: 2 },
  { id: new Types.ObjectId("69e38d63e52dc0303612c236"), name: "Municipalidad de Puerto Maldonado", prov: 3 },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");
  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  // ── Usuarios base ─────────────────────────────────────────────────────────
  const superAdminDoc = await UserModel.findOne({ email: "superadmin@sfit.test" }).lean() as any;
  const fiscalDoc     = await UserModel.findOne({ email: "fiscal@sfit.test" }).lean() as any;
  const ciudadanoDoc  = await UserModel.findOne({ email: "ciudadano@sfit.test" }).lean() as any;
  if (!superAdminDoc) throw new Error("Ejecuta seed-test-users.ts primero");

  const superAdminId = superAdminDoc._id as Types.ObjectId;
  const fiscalId     = fiscalDoc._id     as Types.ObjectId;
  const ciudadanoId  = ciudadanoDoc._id  as Types.ObjectId;

  // ── Provincias ────────────────────────────────────────────────────────────
  for (const p of EXTRA_PROVINCES) {
    await up(ProvinceModel, { _id: p.id }, { _id: p.id, name: p.name, region: p.region, active: true });
  }
  console.log(`✅ ${EXTRA_PROVINCES.length} provincias extra creadas`);

  // ── Municipalidades ───────────────────────────────────────────────────────
  for (const m of EXTRA_MUNICIPALITIES) {
    const prov = EXTRA_PROVINCES[m.prov];
    await up(MunicipalityModel, { _id: m.id }, {
      _id: m.id, name: m.name,
      provinceId: prov.id, active: true,
    });
  }
  console.log(`✅ ${EXTRA_MUNICIPALITIES.length} municipalidades extra creadas`);

  // ── Tipos de vehículo para cada municipalidad ─────────────────────────────
  for (const mun of EXTRA_MUNICIPALITIES) {
    for (const [key, name] of [["omnibus", "Omnibus"], ["minibus", "Minibus"], ["taxi", "Taxi"]] as const) {
      await up(VehicleTypeModel, { municipalityId: mun.id, key }, {
        key, name, municipalityId: mun.id,
        description: `${name} de transporte urbano`,
        checklistItems: ["SOAT vigente", "Revisión técnica vigente", "Extintor operativo"],
        inspectionFields: [
          { key: "soat",        label: "SOAT vigente",             type: "boolean" },
          { key: "rev_tecnica", label: "Revisión técnica vigente", type: "boolean" },
          { key: "extintor",    label: "Extintor operativo",       type: "boolean" },
        ],
        reportCategories: ["velocidad_excesiva", "cobro_excesivo", "mal_estado"],
        isCustom: false, active: true,
      });
    }
  }
  console.log("✅ Tipos de vehículo para nuevas municipalidades creados");

  // ── Empresas, conductores y vehículos por municipalidad ──────────────────
  const munVehicleIds: Record<string, Types.ObjectId[]> = {};
  const munFiscalIds:  Record<string, Types.ObjectId>   = {};

  for (const [mi, mun] of EXTRA_MUNICIPALITIES.entries()) {
    const munKey = mun.id.toString();

    // Fiscal local (admin_municipal)
    const fiscalEmail = `fiscal.${mi}@sfit.test`;
    const fiscalLocal = await up(UserModel, { email: fiscalEmail }, {
      email: fiscalEmail, name: `Fiscal ${mun.name}`,
      role: "fiscal", status: "activo",
      municipalityId: mun.id, provinceId: EXTRA_PROVINCES[mun.prov].id,
      password: "$2a$12$placeholder", // no se usa para login
    }) as any;
    munFiscalIds[munKey] = fiscalLocal._id;

    // Empresa
    const comp = await up(CompanyModel,
      { municipalityId: mun.id, ruc: `206${(mi + 1).toString().padStart(8, "0")}` },
      {
        razonSocial: `Trans ${mun.name.replace("Municipalidad de ", "")} SAC`,
        ruc: `206${(mi + 1).toString().padStart(8, "0")}`,
        municipalityId: mun.id,
        representanteLegal: { name: `Gerente ${mi + 1}`, dni: `295${(10000 + mi).toString()}`, phone: `98400${(100 + mi)}` },
        vehicleTypeKeys: ["omnibus", "minibus"],
        documents: [], active: true, reputationScore: rnd(72, 96),
      }) as any;

    // Conductor
    const drv = await up(DriverModel,
      { municipalityId: mun.id, dni: `295200${(mi + 1).toString().padStart(2, "0")}` },
      {
        name: `Conductor ${mi + 1} ${mun.name.replace("Municipalidad de ", "")}`,
        dni: `295200${(mi + 1).toString().padStart(2, "0")}`,
        licenseNumber: `L${mi + 1}00001`, licenseCategory: "A-IIb",
        companyId: comp._id, municipalityId: mun.id,
        phone: `98420${(1000 + mi)}`,
        status: mi % 5 === 3 ? "riesgo" : "apto",
        continuousHours: mi % 5 === 3 ? 9 : 0,
        restHours: 8, reputationScore: rnd(60, 98), active: true,
      }) as any;

    // 2 vehículos por municipalidad
    const plates = [`V${(mi + 1).toString().padStart(2, "0")}A-001`, `V${(mi + 1).toString().padStart(2, "0")}B-002`];
    const vehIds: Types.ObjectId[] = [];
    for (const [vi, plate] of plates.entries()) {
      const status = vi === 0 ? "en_ruta" : "disponible";
      const veh = await up(VehicleModel,
        { municipalityId: mun.id, plate },
        {
          plate, vehicleTypeKey: vi === 0 ? "omnibus" : "minibus",
          companyId: comp._id, municipalityId: mun.id,
          brand: pick(["Mercedes-Benz", "Volvo", "Toyota", "Scania", "Hyundai"]),
          model: pick(["OF-1721", "B9R", "Hiace", "K410", "Accent"]),
          year: rnd(2018, 2023),
          status, reputationScore: rnd(65, 98),
          soatExpiry: new Date("2026-12-31"),
          lastInspectionStatus: vi === 0 ? "aprobada" : "pendiente",
          active: true,
        }) as any;
      vehIds.push(veh._id);
    }
    munVehicleIds[munKey] = vehIds;
    munFiscalIds[munKey]  = fiscalLocal._id;
  }
  console.log("✅ Empresas, conductores, vehículos para nuevas municipalidades");

  // ── Datos históricos (últimos 60 días) ────────────────────────────────────
  console.log("⏳ Generando datos históricos (60 días)...");

  const allMunicipalities = [
    { id: new Types.ObjectId("69e38d63e52dc0303612c21f"), name: "Prueba SFIT" },
    ...EXTRA_MUNICIPALITIES.map(m => ({ id: m.id, name: m.name })),
  ];

  const inspResults  = ["aprobada", "observada", "rechazada"] as const;
  const reportCats   = ["velocidad_excesiva", "cobro_excesivo", "mal_estado", "conducta_inapropiada"] as const;
  const reportStatus = ["pendiente", "revision", "validado", "cerrado"] as const;
  const faultTypes   = ["soat_vencido", "exceso_velocidad", "revision_tecnica_vencida", "conduccion_peligrosa"] as const;
  const sanctStatus  = ["emitida", "notificada", "confirmada", "anulada"] as const;

  let inspCount = 0, reportCount = 0, sanctCount = 0;

  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    for (const mun of allMunicipalities) {
      const munKey    = mun.id.toString();
      const vehIds    = munVehicleIds[munKey] ?? [new Types.ObjectId("69e38d63e52dc0303612c21f")];
      const localFiscId = munFiscalIds[munKey] ?? fiscalId;
      const munId     = mun.id;

      // 0-2 inspecciones por día por municipalidad
      const nInsp = dayOffset > 30 ? rnd(0, 1) : rnd(0, 2);
      for (let k = 0; k < nInsp; k++) {
        const result = pick(inspResults);
        const date   = daysAgo(dayOffset, rnd(7, 17));
        await InspectionModel.findOneAndUpdate(
          { municipalityId: munId, "date": date },
          { $setOnInsert: {
            vehicleId: pick([...vehIds, new Types.ObjectId()]),
            fiscalId: localFiscId,
            municipalityId: munId,
            date,
            vehicleTypeKey: pick(["omnibus", "minibus", "taxi"]),
            checklistResults: [
              { item: "SOAT vigente",             passed: result !== "rechazada" },
              { item: "Revisión técnica vigente", passed: result === "aprobada" },
              { item: "Extintor operativo",       passed: true },
            ],
            score: result === "aprobada" ? rnd(85, 100) : result === "observada" ? rnd(60, 84) : rnd(20, 59),
            result,
            observations: result !== "aprobada" ? "Se detectaron observaciones." : "Vehículo en regla.",
            evidenceUrls: [],
          }},
          { upsert: true }
        );
        inspCount++;
      }

      // 0-1 reportes ciudadanos cada 2 días
      if (dayOffset % 2 === 0) {
        const rDate = daysAgo(dayOffset, rnd(8, 20));
        await CitizenReportModel.findOneAndUpdate(
          { municipalityId: munId, createdAt: rDate },
          { $setOnInsert: {
            vehicleId: pick([...vehIds, new Types.ObjectId()]),
            citizenId: ciudadanoId,
            municipalityId: munId,
            vehicleTypeKey: pick(["omnibus", "minibus", "taxi"]),
            category: pick(reportCats),
            description: "Reporte ciudadano de prueba generado automáticamente.",
            status: pick(reportStatus),
            citizenReputationLevel: rnd(2, 5),
            fraudScore: rnd(5, 40),
            fraudLayers: [],
            assignedFiscalId: localFiscId,
            createdAt: rDate,
          }},
          { upsert: true }
        );
        reportCount++;
      }

      // 0-1 sanciones cada 3 días
      if (dayOffset % 3 === 0) {
        const sDate = daysAgo(dayOffset, rnd(9, 16));
        await SanctionModel.findOneAndUpdate(
          { municipalityId: munId, createdAt: sDate },
          { $setOnInsert: {
            vehicleId: pick([...vehIds, new Types.ObjectId()]),
            municipalityId: munId,
            faultType: pick(faultTypes),
            amountSoles: pick([200, 350, 500, 750, 1000]),
            amountUIT: "0.2 UIT",
            status: pick(sanctStatus),
            notifications: [],
            issuedBy: localFiscId,
            createdAt: sDate,
          }},
          { upsert: true }
        );
        sanctCount++;
      }
    }
  }
  console.log(`✅ Histórico: ${inspCount} inspecciones, ${reportCount} reportes, ${sanctCount} sanciones`);

  // ── Apelaciones ───────────────────────────────────────────────────────────
  const sanctionSamples = await SanctionModel.find({}).limit(5).lean() as any[];
  for (const [i, s] of sanctionSamples.entries()) {
    await up(ApelacionModel,
      { sanctionId: s._id },
      {
        sanctionId:     s._id,
        municipalityId: s.municipalityId,
        vehicleId:      s.vehicleId,
        submittedBy:    ciudadanoId,
        reason: pick([
          "La infracción fue registrada incorrectamente. El vehículo contaba con todos los documentos en regla.",
          "El SOAT fue renovado el mismo día pero el sistema no lo registró.",
          "El conductor presentó revisión técnica vigente al momento de la inspección.",
          "Error en la placa registrada; el vehículo inspeccionado no es de mi propiedad.",
        ]),
        status: pick(["pendiente", "en_revision", "aceptada", "rechazada"]),
        submittedAt: daysAgo(rnd(2, 20), rnd(9, 17)),
        attachments: [],
      }
    );
  }
  console.log("✅ Apelaciones creadas");

  // ── Audit Logs ────────────────────────────────────────────────────────────
  const auditActions = [
    { action: "LOGIN",             resource: "User",        detail: "Inicio de sesión exitoso" },
    { action: "USER_STATUS_CHANGE",resource: "User",        detail: "Estado cambiado a activo" },
    { action: "INSPECTION_CREATE", resource: "Inspection",  detail: "Inspección creada" },
    { action: "SANCTION_ISSUE",    resource: "Sanction",    detail: "Sanción emitida" },
    { action: "REPORT_VALIDATE",   resource: "CitizenReport",detail: "Reporte validado" },
    { action: "VEHICLE_STATUS",    resource: "Vehicle",     detail: "Estado de vehículo actualizado" },
    { action: "COMPANY_UPDATE",    resource: "Company",     detail: "Empresa actualizada" },
    { action: "ROLE_CHANGE",       resource: "User",        detail: "Rol de usuario modificado" },
  ];

  for (let i = 0; i < 40; i++) {
    const a = pick(auditActions);
    await AuditLogModel.create({
      action:     a.action,
      resource:   a.resource,
      detail:     a.detail,
      performedBy: superAdminId,
      ip:          `10.0.${rnd(0, 10)}.${rnd(1, 254)}`,
      userAgent:   "Mozilla/5.0 (Next.js Dashboard)",
      createdAt:   daysAgo(rnd(0, 30), rnd(7, 20)),
    });
  }
  console.log("✅ 40 audit logs creados");

  // ── Notificaciones para super admin ──────────────────────────────────────
  const notifTypes = [
    { title: "Nueva municipalidad registrada",   body: "Municipalidad de Arequipa se unió al sistema.",  type: "info"    },
    { title: "Usuario pendiente de aprobación",  body: "Hay 3 usuarios esperando activación.",           type: "warning" },
    { title: "Inspección crítica registrada",    body: "Vehículo MNO-345 no pasó la inspección.",        type: "error"   },
    { title: "Sanción confirmada",               body: "Sanción por SOAT vencido confirmada.",           type: "success" },
    { title: "Reporte ciudadano validado",       body: "Reporte de cobro excesivo fue validado.",        type: "info"    },
    { title: "Sistema actualizado",              body: "Versión 1.4 desplegada exitosamente.",           type: "success" },
    { title: "Conductor en estado de riesgo",    body: "Pedro Quispe acumula 10h continuas.",            type: "warning" },
  ];

  for (const [i, n] of notifTypes.entries()) {
    await up(NotificationModel,
      { userId: superAdminId, title: n.title },
      {
        userId:    superAdminId,
        title:     n.title,
        body:      n.body,
        type:      n.type,
        category:  n.type === "warning" ? "alerta" : "sistema",
        read:      i > 3,
        createdAt: daysAgo(rnd(0, 7), rnd(8, 18)),
      }
    );
  }
  console.log("✅ Notificaciones creadas");

  // ── Recompensas (catálogo) ────────────────────────────────────────────────
  const recompensas = [
    { titulo: "Descuento en peaje",       coins: 500,  stock: 100, category: "descuento" },
    { titulo: "Bono de S/10 en comida",   coins: 1000, stock: 50,  category: "bono"      },
    { titulo: "Pasaje gratuito",          coins: 750,  stock: 200, category: "transporte" },
    { titulo: "Voucher de farmacia",      coins: 1200, stock: 30,  category: "salud"     },
    { titulo: "Descuento en cine",        coins: 600,  stock: 80,  category: "ocio"      },
  ];
  for (const r of recompensas) {
    await up(RecompensaModel,
      { titulo: r.titulo },
      { ...r, active: true, canjeados: rnd(0, 20) }
    );
  }
  console.log("✅ Catálogo de recompensas creado");

  // ── Resumen final ─────────────────────────────────────────────────────────
  const pCount = await ProvinceModel.countDocuments();
  const mCount = await MunicipalityModel.countDocuments();
  const uCount = await UserModel.countDocuments();
  const cCount = await CompanyModel.countDocuments();
  const vCount = await VehicleModel.countDocuments();
  const iCount = await InspectionModel.countDocuments();
  const sCount = await SanctionModel.countDocuments();
  const rCount = await CitizenReportModel.countDocuments();

  console.log(`
╔══════════════════════════════════════════╗
║        RESUMEN DE BASE DE DATOS          ║
╠══════════════════════════════════════════╣
║  Provincias:          ${pCount.toString().padStart(4)}               ║
║  Municipalidades:     ${mCount.toString().padStart(4)}               ║
║  Usuarios:            ${uCount.toString().padStart(4)}               ║
║  Empresas:            ${cCount.toString().padStart(4)}               ║
║  Vehículos:           ${vCount.toString().padStart(4)}               ║
║  Inspecciones:        ${iCount.toString().padStart(4)}               ║
║  Sanciones:           ${sCount.toString().padStart(4)}               ║
║  Reportes:            ${rCount.toString().padStart(4)}               ║
╚══════════════════════════════════════════╝`);

  await mongoose.disconnect();
  console.log("\n🎉 Seed de expansión completado.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
