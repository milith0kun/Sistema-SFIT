import { apiResponse, apiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/mongoose";

/**
 * GET /api/health
 * Endpoint de health-check para verificar que la API y MongoDB están operativos.
 */
export async function GET() {
  try {
    const mongoose = await connectDB();
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    return apiResponse({
      status: "ok",
      service: "SFIT API",
      version: "1.0.0",
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(
      `Error de conexión a la base de datos: ${error instanceof Error ? error.message : "desconocido"}`,
      500
    );
  }
}
