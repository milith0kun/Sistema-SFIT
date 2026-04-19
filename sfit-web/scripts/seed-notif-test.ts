/**
 * Inserta una notificación de prueba para el super_admin (174449@unsaac.edu.pe)
 * Uso: npx tsx scripts/seed-notif-test.ts
 */
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const MONGODB_URI =
  "mongodb+srv://milith0dev_db_user:1997281qA@cluster0.cpt00yd.mongodb.net/sfit?retryWrites=true&w=majority&appName=Cluster0";

const UserSchema = new mongoose.Schema({ email: String, role: String }, { strict: false });
const NotifSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    type:     { type: String, enum: ["info","success","warning","error","action_required"], default: "info" },
    category: { type: String, enum: ["sistema","aprobacion","sancion","fatiga","reporte","canje","asignacion","otro"], default: "otro" },
    link:     String,
    metadata: mongoose.Schema.Types.Mixed,
    readAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("✔ Conectado a MongoDB Atlas");

  const User = mongoose.models.User ?? mongoose.model("User", UserSchema, "users");
  const Notification = mongoose.models.Notification ?? mongoose.model("Notification", NotifSchema, "notifications");

  const user = await User.findOne({ email: "174449@unsaac.edu.pe" });
  if (!user) {
    console.error("✘ Usuario 174449@unsaac.edu.pe no encontrado. ¿Aún no ha iniciado sesión?");
    process.exit(1);
  }
  console.log(`✔ Usuario encontrado: _id=${user._id}  rol=${user.role}`);

  const notifs = [
    {
      userId: user._id,
      title: "Bienvenido al panel SFIT",
      body: "Tu cuenta de super administrador está activa. Puedes gestionar todas las entidades del sistema.",
      type: "success",
      category: "sistema",
      link: "/dashboard",
    },
    {
      userId: user._id,
      title: "Nueva inspección registrada",
      body: "Se registró una inspección en la ruta R-01 · Empresa TransSur. Revisa el detalle en Inspecciones.",
      type: "info",
      category: "reporte",
      link: "/inspecciones",
    },
    {
      userId: user._id,
      title: "Sanción pendiente de revisión",
      body: "El conductor Luis Quispe tiene una sanción grave con apelación activa. Requiere acción.",
      type: "action_required",
      category: "aprobacion",
      link: "/apelaciones",
    },
    {
      userId: user._id,
      title: "Conductor en zona de fatiga",
      body: "El conductor Carlos Mamani superó el límite de horas permitidas en la ruta R-03.",
      type: "warning",
      category: "fatiga",
      link: "/conductores",
    },
  ];

  const result = await Notification.insertMany(notifs);
  console.log(`✔ ${result.length} notificaciones insertadas:`);
  result.forEach((n) => console.log(`   · [${n.type}] ${n.title}`));

  await mongoose.disconnect();
  console.log("✔ Listo.");
}

main().catch((e) => { console.error(e); process.exit(1); });
