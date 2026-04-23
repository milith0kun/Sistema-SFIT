import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { awardCoins, getBalance } from "@/lib/coins/awardCoins";

const RedeemSchema = z.object({
  recompensaId: z.string().min(1, "ID requerido"),
});

/** Catálogo estático de respaldo cuando no hay registros en la base de datos. */
const STATIC_CATALOG = [
  {
    id: "static-001",
    name: "Cupón de transporte público",
    description: "Descuento en pasaje de transporte público municipal. Válido por 30 días.",
    cost: 200,
    category: "descuento",
    stock: -1,
    imageUrl: null,
  },
  {
    id: "static-002",
    name: "Certificado de ciudadano responsable",
    description: "Certificado digital que acredita tu participación activa en la fiscalización del transporte municipal.",
    cost: 100,
    category: "certificado",
    stock: -1,
    imageUrl: null,
  },
  {
    id: "static-003",
    name: "Reconocimiento ciudadano del mes",
    description: "Mención especial en el portal municipal como ciudadano destacado del mes en fiscalización.",
    cost: 500,
    category: "beneficio",
    stock: 5,
    imageUrl: null,
  },
  {
    id: "static-004",
    name: "Descuento en trámites municipales",
    description: "10% de descuento en tasas administrativas municipales para trámites en línea.",
    cost: 300,
    category: "descuento",
    stock: -1,
    imageUrl: null,
  },
];

/**
 * GET /api/ciudadano/recompensas
 * Lista el catálogo de recompensas activas.
 * Si no hay registros en BD, devuelve el catálogo estático de respaldo.
 * Auth: cualquier rol.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const dbItems = await Recompensa.find({ active: true })
      .sort({ cost: 1 })
      .lean();

    if (dbItems.length > 0) {
      const CAT_DEFAULTS: Record<string, { name: string; description: string; cost: number }> = {
        descuento:   { name: "Cupón de descuento",          description: "Descuento en servicios municipales.",             cost: 50  },
        bono:        { name: "Bono ciudadano",               description: "Bono de reconocimiento por participación.",       cost: 100 },
        transporte:  { name: "Beneficio de transporte",      description: "Acceso a beneficios en transporte público.",      cost: 200 },
        salud:       { name: "Beneficio de salud",           description: "Acceso a servicios de salud municipal.",          cost: 150 },
        ocio:        { name: "Beneficio cultural",           description: "Acceso a eventos culturales municipales.",        cost: 80  },
        certificado: { name: "Certificado ciudadano",        description: "Certificado de participación ciudadana.",         cost: 100 },
        beneficio:   { name: "Beneficio especial",           description: "Beneficio exclusivo para ciudadanos activos.",    cost: 300 },
      };
      return apiResponse({
        items: dbItems.map((r) => {
          const def = CAT_DEFAULTS[r.category as string] ?? { name: "Recompensa", description: "Recompensa ciudadana.", cost: 100 };
          return {
            id:          String(r._id),
            name:        (r.name        as string | undefined) ?? def.name,
            description: (r.description as string | undefined) ?? def.description,
            cost:        (r.cost        as number | undefined) ?? def.cost,
            category:    (r.category    as string | undefined) ?? "beneficio",
            stock:       (r.stock       as number | undefined) ?? -1,
            imageUrl:    (r.imageUrl    as string | null | undefined) ?? null,
          };
        }),
        source: "db",
      });
    }

    // Fallback al catálogo estático si la colección está vacía
    return apiResponse({ items: STATIC_CATALOG, source: "static" });
  } catch (error) {
    console.error("[ciudadano/recompensas GET]", error);
    // Si falla la conexión a BD, devolver catálogo estático
    return apiResponse({ items: STATIC_CATALOG, source: "static" });
  }
}

/**
 * POST /api/ciudadano/recompensas
 * Canjea una recompensa descontando coins del usuario autenticado.
 * Body: { recompensaId: string }
 * Auth: cualquier rol.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = RedeemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("recompensaId requerido", 400);
    }

    const { recompensaId } = parsed.data;

    // Resolver recompensa: puede ser un ObjectId de BD o un ID estático de catálogo
    let rewardName: string;
    let rewardCost: number;
    let rewardIdForTx: string | undefined;

    await connectDB();

    if (isValidObjectId(recompensaId)) {
      const recompensa = await Recompensa.findById(recompensaId);
      if (!recompensa || !recompensa.active) {
        return apiError("Recompensa no encontrada o inactiva", 404);
      }
      if (recompensa.stock !== -1 && recompensa.stock <= 0) {
        return apiError("Recompensa sin stock disponible", 409);
      }
      rewardName = recompensa.name;
      rewardCost = recompensa.cost;
      rewardIdForTx = String(recompensa._id);

      // Verificar balance suficiente
      const currentBalance = await getBalance(session.userId);
      if (currentBalance < rewardCost) {
        return apiError(
          `Saldo insuficiente. Necesitas ${rewardCost} coins, tienes ${currentBalance}.`,
          422,
        );
      }

      // Descontar stock si no es ilimitado
      if (recompensa.stock !== -1) {
        recompensa.stock -= 1;
        await recompensa.save();
      }
    } else {
      // ID estático del catálogo de respaldo
      const staticItem = STATIC_CATALOG.find((r) => r.id === recompensaId);
      if (!staticItem) {
        return apiError("Recompensa no encontrada", 404);
      }
      if (staticItem.stock !== -1 && staticItem.stock <= 0) {
        return apiError("Recompensa sin stock disponible", 409);
      }
      rewardName = staticItem.name;
      rewardCost = staticItem.cost;
      rewardIdForTx = undefined;

      // Verificar balance suficiente
      const currentBalance = await getBalance(session.userId);
      if (currentBalance < rewardCost) {
        return apiError(
          `Saldo insuficiente. Necesitas ${rewardCost} coins, tienes ${currentBalance}.`,
          422,
        );
      }
    }

    // Crear transacción negativa
    await awardCoins(session.userId, -rewardCost, "canje_recompensa", rewardIdForTx);

    const newBalance = await getBalance(session.userId);

    return apiResponse({
      message: "Canje exitoso",
      recompensa: { id: recompensaId, name: rewardName, cost: rewardCost },
      newBalance,
    });
  } catch (error) {
    console.error("[ciudadano/recompensas POST]", error);
    return apiError("Error al canjear recompensa", 500);
  }
}
