import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, extractTokenFromHeader } from "./jwt";
import { ROLES } from "@/lib/constants";

const payload = { userId: "user123", role: ROLES.ADMIN_MUNICIPAL, municipalityId: "muni456" };

describe("signAccessToken / verifyAccessToken", () => {
  it("firma y verifica un access token correctamente", () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe("string");
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.municipalityId).toBe(payload.municipalityId);
  });

  it("lanza error con un token inválido", () => {
    expect(() => verifyAccessToken("token.invalido.xxx")).toThrow();
  });

  it("lanza error con un token de refresh usado como access", () => {
    const refreshToken = signRefreshToken(payload);
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});

describe("signRefreshToken / verifyRefreshToken", () => {
  it("firma y verifica un refresh token correctamente", () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
  });
});

describe("extractTokenFromHeader", () => {
  it("extrae el payload de un header Bearer válido", () => {
    const token = signAccessToken(payload);
    const decoded = extractTokenFromHeader(`Bearer ${token}`);
    expect(decoded?.userId).toBe(payload.userId);
  });

  it("retorna null si no hay header", () => {
    expect(extractTokenFromHeader(null)).toBeNull();
  });

  it("retorna null si el header no es Bearer", () => {
    expect(extractTokenFromHeader("Basic abc123")).toBeNull();
  });

  it("retorna null si el token es inválido", () => {
    expect(extractTokenFromHeader("Bearer token.invalido")).toBeNull();
  });
});
