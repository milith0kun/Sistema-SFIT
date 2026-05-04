import jwt from "jsonwebtoken";
import type { Role } from "@/lib/constants";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export interface JwtPayload {
  userId: string;
  role: Role;
  municipalityId?: string;
  provinceId?: string;
  /** Región del usuario; aplica a admin_regional y se denormaliza para roles inferiores. */
  regionId?: string;
}

/** Access token: 2 horas (RF-01-08) */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "2h" });
}

/** Refresh token: 7 días (RF-01-08) */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

/** Extrae el payload del access token del header Authorization */
export function extractTokenFromHeader(
  authHeader: string | null
): JwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return verifyAccessToken(authHeader.slice(7));
  } catch {
    return null;
  }
}
