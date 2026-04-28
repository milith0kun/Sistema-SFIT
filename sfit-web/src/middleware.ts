import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/reset-password", "/design-system"];
const PUBLIC_API = ["/api/auth", "/api/public", "/api/health"];

// ── Rate limiting (in-memory, production only) ──────────────────────────────
// Each entry: { count, reset (epoch ms) }
const rateLimitMap = new Map<string, { count: number; reset: number }>();

const RATE_LIMIT_RULES: Array<{ prefix: string; maxRequests: number; windowMs: number }> = [
  { prefix: "/api/auth/", maxRequests: 10, windowMs: 60_000 },
  { prefix: "/api/ocr/",  maxRequests: 5,  windowMs: 60_000 },
];

/** Returns a 429 response if the IP has exceeded the limit, otherwise null. */
function checkRateLimit(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  const { pathname } = request.nextUrl;
  const rule = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `${rule.prefix}:${ip}`;
  const now = Date.now();

  // Periodically clean up expired entries to prevent unbounded Map growth.
  // We do a lightweight pass only when the map grows beyond a threshold.
  if (rateLimitMap.size > 10_000) {
    for (const [k, entry] of rateLimitMap) {
      if (entry.reset <= now) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);

  if (!entry || entry.reset <= now) {
    // Start a new window
    rateLimitMap.set(key, { count: 1, reset: now + rule.windowMs });
    return null;
  }

  if (entry.count >= rule.maxRequests) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.reset - now) / 1000)),
          "X-RateLimit-Limit": String(rule.maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  entry.count += 1;
  return null;
}

/**
 * El middleware corre en Edge runtime — sin acceso a bibliotecas Node como
 * `jsonwebtoken`. Aquí sólo verificamos que el token EXISTA como cookie o
 * header. La validación criptográfica ocurre en los API routes y en los
 * server components (que sí corren en Node runtime).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rate limiting (production only, checked before auth)
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const isPublicApi = PUBLIC_API.some((r) => pathname.startsWith(r));

  if (isPublicRoute || isPublicApi) return NextResponse.next();

  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies.get("sfit_access_token")?.value;
  const token = authHeader?.replace("Bearer ", "") ?? cookieToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
