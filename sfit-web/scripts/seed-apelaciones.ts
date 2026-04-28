/**
 * Seed de apelaciones de prueba para SFIT.
 *
 * Genera inspecciones apelables (rechazada/observada) y apelaciones
 * en los tres estados: pendiente, aprobada, rechazada.
 *
 * Requisitos previos:
 *   - npx tsx scripts/seed-test-users.ts
 *   - npx tsx scripts/seed-full-data.ts   (para tener vehículos y conductores)
 *
 * Uso: cd sfit-web && npx tsx scripts/seed-apelaciones.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const MUNIC_ID = new Types.ObjectId("69e38d63e52dc0303612c21f");

const loose = { strict: false, timestamps: true } as const;

const UserModel       = mongoose.models.User       ?? model("User",       new Schema({}, loose));
const VehicleModel    = mongoose.models.Vehicle    ?? model("Vehicle",    new Schema({}, loose));
const DriverModel     = mongoose.models.Driver     ?? model("Driver",     new Schema({}, loose));
const InspectionModel = mongoose.models.Inspection ?? model("Inspection", new Schema({}, loose));
const ApelacionModel  = mongoose.models.Apelacion  ?? model("Apelacion",  new Schema({}, loose));

async function getUserId(email: string): Promise<Types.ObjectId> {
  const u = await UserModel.findOne({ email }).select("_id").lean() as { _id: Types.ObjectId } | null;
  if (!u) throw new Error(`Usuario ${email} no encontrado — ejecuta seed-test-users.ts primero.`);
  return u._id;
}

async function upsert<T extends { _id: Types.ObjectId }>(
  Model: mongoose.Model<unknown>,
  filter: object,
  data: object,
): Promise<T> {
  const doc = await Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, returnDocument: "after" });
  return doc as unknown as T;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  // ── Usuarios ───────────────────────────────────────────────────────────────
  const fiscalId    = await getUserId("fiscal@sfit.test");
  const operadorId  = await getUserId("operador@sfit.test");
  const municipalId = await getUserId("municipal@sfit.test");
  console.log("Usuarios cargados");

  // ── Vehículos del seed (ABC-123, DEF-456, GHI-789, JKL-012, MNO-345, PQR-678) ─
  const plates = ["ABC-123", "DEF-456", "GHI-789", "JKL-012", "MNO-345", "PQR-678"];
  const vehicles = await VehicleModel.find({
    municipalityId: MUNIC_ID,
    plate: { $in: plates },
  }).lean() as Array<{ _id: Types.ObjectId; plate: string; vehicleTypeKey: string }>;

  if (vehicles.length === 0) {
    throw new Error("No se encontraron vehículos. Ejecuta seed-full-data.ts primero.");
  }
  const byPlate = new Map(vehicles.map((v) => [v.plate, v]));
  console.log(`Vehículos encontrados: ${vehicles.length}`);

  // Driver opcional para asociar a las inspecciones
  const someDriver = await DriverModel.findOne({ municipalityId: MUNIC_ID })
    .select("_id").lean() as { _id: Types.ObjectId } | null;
  const driverId = someDriver?._id;

  // ── Inspecciones apelables (idempotentes por vehicleId+date) ──────────────
  const checklistOmnibus = [
    { item: "SOAT vigente", passed: false, notes: "Documento vencido" },
    { item: "Revisión técnica vigente", passed: true },
    { item: "Extintor operativo", passed: false, notes: "Carga vencida" },
    { item: "Cinturones de seguridad", passed: true },
    { item: "Luces delanteras", passed: false, notes: "Faro derecho fundido" },
    { item: "Frenos en buen estado", passed: true },
  ];
  const checklistObserved = checklistOmnibus.map((c, i) => ({
    item: c.item,
    passed: i !== 1,
    notes: i === 1 ? "Próxima a vencer" : undefined,
  }));

  // Generamos 7 inspecciones (mezclando vehículos y fechas) para soportar 7 apelaciones distintas.
  // unique de Apelacion es por inspectionId, así necesitamos una inspección por apelación.
  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(10 + (n % 6), 30, 0, 0);
    return d;
  };

  const inspectionPlan: Array<{
    plate: string;
    daysAgo: number;
    result: "rechazada" | "observada";
    score: number;
    observations: string;
    checklist: typeof checklistOmnibus;
  }> = [
    { plate: "MNO-345", daysAgo: 1, result: "rechazada", score: 35, observations: "SOAT vencido. Revisión técnica vencida. No puede circular.", checklist: checklistOmnibus },
    { plate: "GHI-789", daysAgo: 2, result: "observada", score: 70, observations: "Revisión técnica próxima a vencer. Plazo de 15 días.", checklist: checklistObserved },
    { plate: "DEF-456", daysAgo: 3, result: "observada", score: 75, observations: "Extintor con carga próxima a vencer.", checklist: checklistObserved },
    { plate: "JKL-012", daysAgo: 4, result: "rechazada", score: 40, observations: "Taxímetro descalibrado. Falla en luces traseras.", checklist: checklistOmnibus },
    { plate: "ABC-123", daysAgo: 5, result: "observada", score: 78, observations: "Faro derecho fundido. Reparar antes de próxima fiscalización.", checklist: checklistObserved },
    { plate: "PQR-678", daysAgo: 7, result: "rechazada", score: 30, observations: "Múltiples fallas mecánicas. Vehículo retirado de servicio.", checklist: checklistOmnibus },
    { plate: "GHI-789", daysAgo: 10, result: "observada", score: 72, observations: "Cinturones desgastados en última fila.", checklist: checklistObserved },
  ];

  type InspDoc = { _id: Types.ObjectId; result: string; vehicleId: Types.ObjectId };
  const inspections: InspDoc[] = [];

  for (const plan of inspectionPlan) {
    const veh = byPlate.get(plan.plate);
    if (!veh) {
      console.warn(`  - Vehículo ${plan.plate} no encontrado, saltando…`);
      continue;
    }
    const date = daysAgo(plan.daysAgo);
    const insp = await upsert<InspDoc>(InspectionModel,
      { municipalityId: MUNIC_ID, vehicleId: veh._id, date },
      {
        vehicleId: veh._id,
        driverId,
        fiscalId,
        municipalityId: MUNIC_ID,
        date,
        vehicleTypeKey: veh.vehicleTypeKey,
        checklistResults: plan.checklist,
        score: plan.score,
        result: plan.result,
        observations: plan.observations,
        evidenceUrls: [],
      });
    inspections.push(insp);
  }
  console.log(`Inspecciones apelables creadas/actualizadas: ${inspections.length}`);

  // ── Apelaciones ────────────────────────────────────────────────────────────
  // 3 pendientes, 2 aprobadas, 2 rechazadas
  type ApPlan = {
    inspIdx: number;
    reason: string;
    evidence?: string[];
    status: "pendiente" | "aprobada" | "rechazada";
    resolvedBy?: Types.ObjectId;
    resolvedDaysAgo?: number;
    resolution?: string;
  };

  const apelacionPlan: ApPlan[] = [
    {
      inspIdx: 0,
      reason: "El SOAT estaba vigente al momento de la inspección. Adjunto comprobante físico y constancia digital del seguro emitida por La Positiva. Solicitamos reevaluación urgente.",
      evidence: ["https://example.com/evidencia/soat-mno345.pdf", "https://example.com/evidencia/comprobante-pago.jpg"],
      status: "pendiente",
    },
    {
      inspIdx: 1,
      reason: "La revisión técnica fue renovada el día anterior a la inspección. Se adjunta certificado emitido por el centro autorizado CITV Cusco.",
      evidence: ["https://example.com/evidencia/citv-ghi789.pdf"],
      status: "pendiente",
    },
    {
      inspIdx: 2,
      reason: "El extintor fue recargado la semana pasada. Adjunto factura del proveedor y foto del precinto nuevo. La observación es incorrecta.",
      evidence: ["https://example.com/evidencia/factura-extintor.pdf"],
      status: "pendiente",
    },
    {
      inspIdx: 3,
      reason: "El taxímetro fue calibrado oficialmente la semana anterior. Solicitamos verificación con calibrador certificado de INACAL.",
      evidence: ["https://example.com/evidencia/calibracion-taximetro.pdf", "https://example.com/evidencia/foto-precinto.jpg"],
      status: "aprobada",
      resolvedBy: fiscalId,
      resolvedDaysAgo: 1,
      resolution: "Se verificó el certificado de calibración INACAL. La observación queda anulada y la inspección se reclasifica como aprobada.",
    },
    {
      inspIdx: 4,
      reason: "El faro derecho fue reparado el mismo día de la inspección, posteriormente al levantamiento del acta. Adjunto boleta del taller mecánico.",
      evidence: ["https://example.com/evidencia/boleta-taller.pdf"],
      status: "aprobada",
      resolvedBy: municipalId,
      resolvedDaysAgo: 2,
      resolution: "Se aceptan los descargos. Se exige nueva inspección visual en próxima fiscalización para confirmar el cambio.",
    },
    {
      inspIdx: 5,
      reason: "La unidad ya estaba programada para mantenimiento mayor. Solicitamos reconsideración del retiro de servicio para reducir el plazo.",
      evidence: [],
      status: "rechazada",
      resolvedBy: fiscalId,
      resolvedDaysAgo: 3,
      resolution: "Las fallas mecánicas detectadas comprometen la seguridad de pasajeros. El retiro de servicio se mantiene hasta nueva inspección integral.",
    },
    {
      inspIdx: 6,
      reason: "Los cinturones reportados están dentro de la tolerancia de uso del fabricante. Adjuntamos especificación técnica.",
      evidence: ["https://example.com/evidencia/especificacion-cinturones.pdf"],
      status: "rechazada",
      resolvedBy: municipalId,
      resolvedDaysAgo: 4,
      resolution: "El desgaste excede los criterios mínimos del Reglamento Nacional de Tránsito. Reemplazo obligatorio en plazo de 7 días.",
    },
  ];

  let createdCount = 0;
  for (const ap of apelacionPlan) {
    const insp = inspections[ap.inspIdx];
    if (!insp) {
      console.warn(`  - Apelación saltada: no existe inspección idx ${ap.inspIdx}`);
      continue;
    }
    const data: Record<string, unknown> = {
      inspectionId:   insp._id,
      vehicleId:      insp.vehicleId,
      municipalityId: MUNIC_ID,
      submittedBy:    operadorId,
      reason:         ap.reason,
      evidence:       ap.evidence ?? [],
      status:         ap.status,
    };
    if (ap.status !== "pendiente") {
      data.resolvedBy = ap.resolvedBy;
      data.resolvedAt = ap.resolvedDaysAgo != null ? daysAgo(ap.resolvedDaysAgo) : new Date();
      data.resolution = ap.resolution;
    } else {
      // Limpia campos de resolución por si ya existía resuelta
      data.resolvedBy = null;
      data.resolvedAt = null;
      data.resolution = null;
    }

    await upsert(ApelacionModel, { inspectionId: insp._id }, data);
    createdCount++;
  }
  console.log(`Apelaciones creadas/actualizadas: ${createdCount}`);

  // ── Resumen ────────────────────────────────────────────────────────────────
  const total = await ApelacionModel.countDocuments({ municipalityId: MUNIC_ID });
  const pendientes = await ApelacionModel.countDocuments({ municipalityId: MUNIC_ID, status: "pendiente" });
  const aprobadas  = await ApelacionModel.countDocuments({ municipalityId: MUNIC_ID, status: "aprobada" });
  const rechazadas = await ApelacionModel.countDocuments({ municipalityId: MUNIC_ID, status: "rechazada" });
  console.log("\nResumen apelaciones en BD:");
  console.log(`  Total      : ${total}`);
  console.log(`  Pendientes : ${pendientes}`);
  console.log(`  Aprobadas  : ${aprobadas}`);
  console.log(`  Rechazadas : ${rechazadas}`);

  await mongoose.disconnect();
  console.log("\nSeed de apelaciones completado.");
}

main().catch((err: unknown) => {
  console.error("Error en seed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
