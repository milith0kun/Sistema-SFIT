import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roleMatrix";

const SCOPE_PREFIX: Record<string, string> = {
  urbano: "U",
  interprovincial: "I",
};

/**
 * GET /api/rutas/suggest-code?scope=urbano|interprovincial
 *
 * Sugiere el siguiente código disponible para la modalidad indicada.
 * Urbano → U-001, Interprovincial → I-001.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("rutas", "create")]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const scope = request.nextUrl.searchParams.get("scope");
  if (scope !== "urbano" && scope !== "interprovincial") {
    return apiError("scope debe ser urbano o interprovincial", 400);
  }

  const prefix = SCOPE_PREFIX[scope] ?? "R";
  await connectDB();

  const regex = `^${prefix}-(\\d+)$`;
  const existing = await Route.find({
    code: { $regex: regex },
  })
    .select("code")
    .lean();

  let max = 0;
  for (const r of existing) {
    const m = (r.code as string).match(new RegExp(regex));
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }

  const next = String(max + 1).padStart(3, "0");
  return apiResponse({ code: `${prefix}-${next}` });
}
