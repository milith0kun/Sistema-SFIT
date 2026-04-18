import mongoose from "mongoose";
import dns from "node:dns";

const MONGODB_URI = process.env.MONGODB_URI;

// Fuerza Node a usar DNS de Google/Cloudflare (ignora el DNS del ISP).
// Esto resuelve el problema de ISPs que bloquean SRV lookups de MongoDB+srv
// sin necesidad de que el usuario cambie el DNS de su sistema.
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Conexión singleton a MongoDB Atlas.
 * Reutiliza la conexión en desarrollo (HMR) y en producción.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "Por favor define la variable de entorno MONGODB_URI"
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4, // Preferir IPv4 (más confiable detrás de NATs ISP)
    };

    cached.promise = mongoose.connect(MONGODB_URI, options).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
