/**
 * Asegura que el usuario conductor@sfit.test esté correctamente asociado a un
 * Driver record en la municipalidad de prueba (Cusco). Crea 2 FleetEntries de
 * HOY apuntando a ese Driver para que la pantalla "Mis rutas" del conductor
 * muestre datos al hacer login.
 *
 * Idempotente: si ya hay relación / entries, los actualiza en lugar de duplicar.
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/seed-conductor-test.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const UserModel       = mongoose.models.User       ?? model("User",       new Schema({}, loose));
const DriverModel     = mongoose.models.Driver     ?? model("Driver",     new Schema({}, loose));
const VehicleModel    = mongoose.models.Vehicle    ?? model("Vehicle",    new Schema({}, loose));
const RouteModel      = mongoose.models.Route      ?? model("Route",      new Schema({}, loose));
const FleetEntryModel = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida");
  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  // 1. Encontrar al usuario conductor de prueba.
  const condUser = await UserModel.findOne({ email: "conductor@sfit.test" }).lean<{ _id: Types.ObjectId; municipalityId: Types.ObjectId; provinceId?: Types.ObjectId; dni?: string }>();
  if (!condUser) {
    console.error("❌ No existe el usuario conductor@sfit.test. Corre seed-test-users primero.");
    process.exit(1);
  }
  console.log(`✓ Usuario conductor encontrado: ${condUser._id} (muni ${condUser.municipalityId})`);

  // 2. Buscar/crear Driver asociado a ese userId.
  let driver = await DriverModel.findOne({ userId: condUser._id }).lean<{ _id: Types.ObjectId; municipalityId: Types.ObjectId; companyId?: Types.ObjectId; name?: string }>();

  if (!driver) {
    // Tomar un Driver existente de la misma muni y asociarlo al userId.
    const existing = await DriverModel.findOne({
      municipalityId: condUser.municipalityId,
      userId: { $exists: false },
    }).lean<{ _id: Types.ObjectId; municipalityId: Types.ObjectId; companyId?: Types.ObjectId; name?: string }>();

    if (existing) {
      await DriverModel.updateOne({ _id: existing._id }, { $set: { userId: condUser._id } });
      driver = { ...existing, _id: existing._id };
      console.log(`✓ Driver existente ${existing.name ?? existing._id} ahora asociado a userId del conductor.`);
    } else {
      // Crear Driver de cero. Usa companyId del primer vehículo de la muni.
      const veh = await VehicleModel.findOne({ municipalityId: condUser.municipalityId, active: true })
        .lean<{ _id: Types.ObjectId; companyId?: Types.ObjectId }>();
      const created = await DriverModel.create({
        userId: condUser._id,
        municipalityId: condUser.municipalityId,
        companyId: veh?.companyId,
        name: "Conductor de Prueba",
        dni: condUser.dni ?? "00000099",
        licenseNumber: "TEST-99",
        licenseCategory: "A-IIb",
        phone: "999000999",
        status: "apto",
        continuousHours: 0,
        restHours: 8,
        reputationScore: 90,
        active: true,
      });
      driver = { _id: created._id as Types.ObjectId, municipalityId: condUser.municipalityId, companyId: veh?.companyId, name: "Conductor de Prueba" };
      console.log(`✓ Driver creado: ${created._id}`);
    }
  } else {
    console.log(`✓ Driver ya asociado: ${driver._id} (${driver.name ?? "sin nombre"})`);
  }

  // 3. Asegurar 2 FleetEntries de HOY asignados a ese Driver.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const existingTodayCount = await FleetEntryModel.countDocuments({
    driverId: driver._id,
    date: { $gte: today, $lt: tomorrow },
  });

  if (existingTodayCount >= 2) {
    console.log(`✓ Ya hay ${existingTodayCount} FleetEntries de hoy para este conductor. No creamos más.`);
  } else {
    // Tomar 2 vehículos + 2 rutas de la misma muni.
    const vehicles = await VehicleModel.find({
      municipalityId: condUser.municipalityId,
      active: true,
    }).limit(2).lean<Array<{ _id: Types.ObjectId; companyId?: Types.ObjectId }>>();

    const routes = await RouteModel.find({
      municipalityId: condUser.municipalityId,
      status: "activa",
    }).limit(2).lean<Array<{ _id: Types.ObjectId }>>();

    if (vehicles.length === 0) {
      console.log("⚠️ No hay vehículos en la muni del conductor. No se pudo crear FleetEntries.");
    } else {
      const baseDate = new Date(today);
      const toCreate = Math.max(0, 2 - existingTodayCount);
      for (let i = 0; i < toCreate; i++) {
        const dep = new Date(baseDate); dep.setHours(7 + i * 4, 0, 0, 0);
        await FleetEntryModel.create({
          municipalityId: condUser.municipalityId,
          vehicleId: vehicles[i % vehicles.length]._id,
          driverId: driver._id,
          routeId: routes[i % Math.max(1, routes.length)]?._id,
          date: today,
          departureTime: dep,
          status: i === 0 ? "disponible" : "disponible",
          checklistComplete: false,
          trackPoints: [],
          visitedStops: [],
        });
      }
      console.log(`✓ ${toCreate} FleetEntry(s) creado(s) para hoy con conductor de prueba.`);
    }
  }

  // 4. Bonus: que el super_admin también pueda probar preview-as → conductor.
  //    El preview-as mantiene el userId del super_admin, así que necesita su
  //    propio Driver record y FleetEntries para que las pantallas no salgan
  //    vacías al hacer preview.
  const superUser = await UserModel.findOne({ email: "superadmin@sfit.test" })
    .lean<{ _id: Types.ObjectId; municipalityId?: Types.ObjectId; dni?: string; name?: string }>();
  if (superUser) {
    let superDriver = await DriverModel.findOne({ userId: superUser._id })
      .lean<{ _id: Types.ObjectId; municipalityId: Types.ObjectId }>();
    if (!superDriver) {
      const muniId = superUser.municipalityId ?? condUser.municipalityId;
      const veh = await VehicleModel.findOne({ municipalityId: muniId, active: true })
        .lean<{ _id: Types.ObjectId; companyId?: Types.ObjectId }>();
      const created = await DriverModel.create({
        userId: superUser._id,
        municipalityId: muniId,
        companyId: veh?.companyId,
        name: superUser.name ?? "Super Admin (preview)",
        dni: superUser.dni ?? "71551120",
        licenseNumber: "PREVIEW-SA",
        licenseCategory: "A-IIb",
        phone: "999999999",
        status: "apto",
        continuousHours: 0,
        restHours: 8,
        reputationScore: 100,
        active: true,
      });
      superDriver = { _id: created._id as Types.ObjectId, municipalityId: muniId };
      console.log(`✓ Driver creado para super_admin (preview): ${created._id}`);
    } else {
      console.log(`✓ Driver del super_admin ya existe: ${superDriver._id}`);
    }

    // FleetEntries para super_admin (al menos 2 disponibles).
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const supExistingCount = await FleetEntryModel.countDocuments({
      driverId: superDriver._id,
      date: { $gte: today, $lt: tomorrow },
    });
    if (supExistingCount < 2) {
      const vehicles = await VehicleModel.find({
        municipalityId: superDriver.municipalityId,
        active: true,
      }).limit(2).lean<Array<{ _id: Types.ObjectId }>>();
      const routes = await RouteModel.find({
        municipalityId: superDriver.municipalityId,
        status: "activa",
      }).limit(2).lean<Array<{ _id: Types.ObjectId }>>();
      const toCreate = Math.max(0, 2 - supExistingCount);
      for (let i = 0; i < toCreate && vehicles[i % vehicles.length]; i++) {
        const dep = new Date(today); dep.setHours(7 + i * 4, 0, 0, 0);
        await FleetEntryModel.create({
          municipalityId: superDriver.municipalityId,
          vehicleId: vehicles[i % vehicles.length]._id,
          driverId: superDriver._id,
          routeId: routes[i % Math.max(1, routes.length)]?._id,
          date: today,
          departureTime: dep,
          status: "disponible",
          checklistComplete: false,
          trackPoints: [],
          visitedStops: [],
        });
      }
      console.log(`✓ ${toCreate} FleetEntry(s) creado(s) para super_admin de hoy.`);
    }
  }

  console.log("\n🎯 Logins de prueba:");
  console.log("   - conductor@sfit.test / Sfit2026!  (conductor real)");
  console.log("   - superadmin@sfit.test / 12345678  (super_admin → puede hacer preview-as conductor)");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  await mongoose.disconnect();
  process.exit(1);
});
