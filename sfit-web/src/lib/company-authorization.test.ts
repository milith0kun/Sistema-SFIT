import { describe, it, expect } from "vitest";
import type { IAuthorization } from "@/models/Company";
import {
  isCompanyAuthorizationValid,
  getCompanyAuthorizationStatus,
} from "./company-authorization";

const NOW = new Date("2026-05-17T12:00:00Z");

function authExpiring(days: number): IAuthorization {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return {
    level: "municipal_provincial",
    scope: "urbano",
    expiresAt: d,
  } as IAuthorization;
}

describe("isCompanyAuthorizationValid", () => {
  it("sin authorizations → false", () => {
    expect(isCompanyAuthorizationValid([], NOW)).toBe(false);
    expect(isCompanyAuthorizationValid(undefined, NOW)).toBe(false);
  });

  it("autorización sin expiresAt → vigente indefinida", () => {
    const auth = { level: "regional", scope: "interprovincial" } as IAuthorization;
    expect(isCompanyAuthorizationValid([auth], NOW)).toBe(true);
  });

  it("todas vencidas → false", () => {
    expect(isCompanyAuthorizationValid([authExpiring(-10), authExpiring(-1)], NOW)).toBe(false);
  });

  it("al menos una activa → true", () => {
    expect(isCompanyAuthorizationValid([authExpiring(-10), authExpiring(60)], NOW)).toBe(true);
  });
});

describe("getCompanyAuthorizationStatus", () => {
  it("none cuando array vacío", () => {
    expect(getCompanyAuthorizationStatus([], NOW).state).toBe("none");
  });

  it("valid cuando vence en >30 días", () => {
    const status = getCompanyAuthorizationStatus([authExpiring(60)], NOW);
    expect(status.state).toBe("valid");
    expect(status.daysToExpiry).toBe(60);
  });

  it("expiring_soon cuando vence en ≤30 días", () => {
    const status = getCompanyAuthorizationStatus([authExpiring(15)], NOW);
    expect(status.state).toBe("expiring_soon");
    expect(status.daysToExpiry).toBe(15);
  });

  it("expired cuando todas vencieron", () => {
    const status = getCompanyAuthorizationStatus([authExpiring(-10), authExpiring(-5)], NOW);
    expect(status.state).toBe("expired");
    expect(status.daysToExpiry).toBe(-5);
  });

  it("escoge la más cercana a vencer entre las activas", () => {
    const status = getCompanyAuthorizationStatus([authExpiring(90), authExpiring(20), authExpiring(60)], NOW);
    expect(status.state).toBe("expiring_soon");
    expect(status.daysToExpiry).toBe(20);
  });
});
