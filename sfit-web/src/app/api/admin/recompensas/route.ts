import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const CreateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(5).max(2000),
  cost: z.number().int().min(1),
  category: z.enum(["descuento", "beneficio", "certificado", "otro"]),
  stock: z.number().int().min(-1).default(-1),
  imageUrl: z.string().url().optional(),
});

const ALLOWED = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL];

/**
 * GET /api/admin/recompensas
 * Lista todas las recompensas (activas e inactivas) para administradores.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ALLOWED);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const items = await Recompensa.find({}).sort({ active: -1, cost: 1 }).lean();
    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        name: r.name,
        description: r.description,
        cost: r.cost,
        category: r.category,
        stock: r.stock,
        active: r.active,
        imageUrl: r.imageUrl,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/recompensas GET]", error);
    return apiError("Error al listar recompensas", 500);
  }
}

/**
 * POST /api/admin/recompensas
 * Crea una nueva recompensa en el catálogo.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ALLOWED);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const created = await Recompensa.create(parsed.data);

    return apiResponse({
      id: String(created._id),
      name: created.name,
      description: created.description,
      cost: created.cost,
      category: created.category,
      stock: created.stock,
      active: created.active,
      imageUrl: created.imageUrl,
    }, 201);
  } catch (error) {
    console.error("[admin/recompensas POST]", error);
    return apiError("Error al crear recompensa", 500);
  }
}
