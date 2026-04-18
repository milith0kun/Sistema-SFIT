import mongoose from "mongoose";
import dns from "node:dns";

const MONGODB_URI = process.env.MONGODB_URI;

/** Resolver independiente con DNS públicos — bypass del DNS del ISP. */
const publicResolver = new dns.promises.Resolver();
publicResolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

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
 * Si el URI es mongodb+srv://, pre-resolvemos los SRV y TXT records con un
 * resolver que usa 8.8.8.8/1.1.1.1 directamente, y construimos una URI
 * estándar `mongodb://host1,host2,host3/`. Esto bypasea el DNS del ISP
 * del usuario sin que éste tenga que configurar nada.
 */
async function resolveUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  // Parsear: mongodb+srv://user:pass@host/db?params
  const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/);
  if (!match) return uri;

  const [, credentials, host, dbPart = "", queryPart = ""] = match;

  // Resolver SRV: _mongodb._tcp.<host>
  const srvRecords = await publicResolver.resolveSrv(`_mongodb._tcp.${host}`);
  if (!srvRecords.length) throw new Error(`Sin SRV records para ${host}`);

  // Resolver TXT: <host> → params adicionales (authSource, replicaSet, etc.)
  let txtParams = "";
  try {
    const txt = await publicResolver.resolveTxt(host);
    if (txt.length) txtParams = txt[0].join("");
  } catch {
    // sin TXT no pasa nada
  }

  const hosts = srvRecords
    .map((r) => `${r.name}:${r.port}`)
    .join(",");

  // Combinar query params: ssl=true + auto-discovered TXT + user params
  const userParams = queryPart.replace(/^\?/, "");
  const allParams = ["ssl=true", txtParams, userParams]
    .filter(Boolean)
    .join("&");

  return `mongodb://${credentials}@${hosts}${dbPart}?${allParams}`;
}

/**
 * Conexión singleton a MongoDB Atlas.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("Por favor define la variable de entorno MONGODB_URI");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = (async () => {
      const resolved = await resolveUri(MONGODB_URI);
      return mongoose.connect(resolved, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        family: 4,
      });
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
