const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET;

console.log("MONGODB_URI:", MONGODB_URI ? "OK" : "MISSING");
console.log("QR_HMAC_SECRET:", QR_HMAC_SECRET);

const VehicleSchema = new mongoose.Schema({
  plate: String,
  municipalityId: mongoose.Schema.Types.ObjectId,
  vehicleTypeKey: String,
  qrHmac: String,
}, { collection: "vehicles" });

const Vehicle = mongoose.models.Vehicle || mongoose.model("Vehicle", VehicleSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Conectado a MongoDB");

  const v = await Vehicle.findOne({ plate: "B0Z816" });
  if (!v) {
    console.log("Vehículo B0Z816 no encontrado");
    process.exit(1);
  }

  console.log("Vehículo encontrado en la DB:");
  console.log("id:", v._id.toString());
  console.log("plate:", v.plate);
  console.log("municipalityId:", v.municipalityId ? v.municipalityId.toString() : "null");
  console.log("vehicleTypeKey:", v.vehicleTypeKey);
  console.log("qrHmac (guardado):", v.qrHmac);

  // Calcular firma
  const crypto = require("crypto");
  const QR_VERSION = 1;
  const partial = {
    v: QR_VERSION,
    id: v._id.toString(),
    pl: v.plate,
    mu: v.municipalityId ? v.municipalityId.toString() : "",
    ty: v.vehicleTypeKey,
    ts: 1680000000 // un timestamp fijo para probar
  };
  const signingInput = `v${partial.v}|${partial.id}|${partial.pl}|${partial.mu}|${partial.ty}|${partial.ts}`;
  const sig = crypto.createHmac("sha256", QR_HMAC_SECRET || "").update(signingInput).digest("hex");
  console.log("Firma generada con ts=1680000000:", sig);
  console.log("Signing input:", signingInput);

  await mongoose.disconnect();
}

run().catch(console.error);
