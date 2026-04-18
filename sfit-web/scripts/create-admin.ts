/**
 * Script para crear un Admin Municipal de pruebas.
 * Uso: npx tsx scripts/create-admin.ts email@test.com Contraseña123 "Nombre Apellido"
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import dns from "node:dns";

// Fuerza DNS públicos para bypasear ISPs que bloquean SRV de MongoDB+srv
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

config({ path: ".env.local" });

async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password || !name) {
    console.error("Uso: npx tsx scripts/create-admin.ts <email> <password> <nombre>");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const UserSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
  const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

  const hashed = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ email });
  if (existing) {
    await User.updateOne(
      { email },
      {
        $set: {
          password: hashed,
          name,
          role: "super_admin",
          status: "activo",
          provider: "credentials",
        },
      },
    );
    console.log(`✓ Actualizado: ${email} → super_admin ACTIVO`);
  } else {
    await User.create({
      email,
      password: hashed,
      name,
      role: "super_admin",
      status: "activo",
      provider: "credentials",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Creado: ${email} con rol admin_municipal ACTIVO`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
