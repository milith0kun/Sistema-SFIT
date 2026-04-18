import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getSession, requireRole } from "./guard";
import { signAccessToken } from "./jwt";
import { ROLES } from "@/lib/constants";

const muniPayload = { userId: "u1", role: ROLES.ADMIN_MUNICIPAL, municipalityId: "muni1" };
const fiscalPayload = { userId: "u2", role: ROLES.FISCAL, municipalityId: "muni1" };

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("getSession", () => {
  it("retorna el payload si el token es válido", () => {
    const token = signAccessToken(muniPayload);
    const session = getSession(makeRequest(token));
    expect(session?.userId).toBe("u1");
    expect(session?.role).toBe(ROLES.ADMIN_MUNICIPAL);
  });

  it("retorna null si no hay token", () => {
    expect(getSession(makeRequest())).toBeNull();
  });

  it("retorna null con token malformado", () => {
    expect(getSession(makeRequest("Bearer token.invalido.xxx"))).toBeNull();
  });
});

describe("requireRole", () => {
  it("retorna la sesión si el rol está permitido", () => {
    const token = signAccessToken(muniPayload);
    const result = requireRole(makeRequest(token), [ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
    expect("session" in result).toBe(true);
    if ("session" in result) expect(result.session.userId).toBe("u1");
  });

  it("retorna error:unauthorized si no hay token", () => {
    const result = requireRole(makeRequest(), [ROLES.ADMIN_MUNICIPAL]);
    expect(result).toEqual({ error: "unauthorized" });
  });

  it("retorna error:forbidden si el rol no está en la lista", () => {
    const token = signAccessToken(fiscalPayload);
    const result = requireRole(makeRequest(token), [ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN]);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("acepta super_admin si está en la lista permitida", () => {
    const superToken = signAccessToken({ userId: "sa", role: ROLES.SUPER_ADMIN });
    const result = requireRole(makeRequest(superToken), [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
    expect("session" in result).toBe(true);
  });
});
