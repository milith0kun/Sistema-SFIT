import { describe, it, expect, vi } from "vitest";
import { canAccessProvince, scopedMunicipalityFilter, canAccessMunicipality } from "./rbac";
import { ROLES } from "@/lib/constants";
import type { JwtPayload } from "./jwt";

vi.mock("@/models/Municipality", () => ({
  Municipality: {
    findById: vi.fn(),
  },
}));

import { Municipality } from "@/models/Municipality";

const sa: JwtPayload = { userId: "sa", role: ROLES.SUPER_ADMIN };
const provincial: JwtPayload = { userId: "prov", role: ROLES.ADMIN_PROVINCIAL, provinceId: "prov1" };
const municipal: JwtPayload = { userId: "muni", role: ROLES.ADMIN_MUNICIPAL, municipalityId: "muni1" };
const fiscal: JwtPayload = { userId: "fis", role: ROLES.FISCAL, municipalityId: "muni1" };

describe("canAccessProvince", () => {
  it("super_admin accede a cualquier provincia", () => {
    expect(canAccessProvince(sa, "cualquier_provincia")).toBe(true);
  });

  it("admin_provincial accede solo a su provincia", () => {
    expect(canAccessProvince(provincial, "prov1")).toBe(true);
    expect(canAccessProvince(provincial, "otra_prov")).toBe(false);
  });

  it("admin_municipal no accede a nivel provincial", () => {
    expect(canAccessProvince(municipal, "prov1")).toBe(false);
  });

  it("retorna false si provinceId está vacío", () => {
    expect(canAccessProvince(sa, "")).toBe(false);
  });
});

describe("scopedMunicipalityFilter", () => {
  it("super_admin obtiene filtro vacío (todas)", () => {
    expect(scopedMunicipalityFilter(sa)).toEqual({});
  });

  it("admin_provincial obtiene filtro por provinceId", () => {
    expect(scopedMunicipalityFilter(provincial)).toEqual({ provinceId: "prov1" });
  });

  it("admin_provincial sin provinceId obtiene filtro imposible", () => {
    const noProv: JwtPayload = { userId: "p", role: ROLES.ADMIN_PROVINCIAL };
    expect(scopedMunicipalityFilter(noProv)).toEqual({ _id: null });
  });

  it("admin_municipal obtiene filtro por su municipalityId", () => {
    expect(scopedMunicipalityFilter(municipal)).toEqual({ _id: "muni1" });
  });

  it("rol sin municipalityId obtiene filtro imposible", () => {
    const noMuni: JwtPayload = { userId: "x", role: ROLES.FISCAL };
    expect(scopedMunicipalityFilter(noMuni)).toEqual({ _id: null });
  });
});

describe("canAccessMunicipality", () => {
  it("super_admin accede a cualquier municipalidad", async () => {
    expect(await canAccessMunicipality(sa, "cualquier_id")).toBe(true);
  });

  it("admin_municipal accede a su municipalidad", async () => {
    expect(await canAccessMunicipality(municipal, "muni1")).toBe(true);
  });

  it("admin_municipal no accede a otra municipalidad", async () => {
    expect(await canAccessMunicipality(municipal, "muni2")).toBe(false);
  });

  it("fiscal accede a su municipalidad", async () => {
    expect(await canAccessMunicipality(fiscal, "muni1")).toBe(true);
  });

  it("admin_provincial accede si la muni pertenece a su provincia", async () => {
    vi.mocked(Municipality.findById).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ provinceId: "prov1" }),
    } as never);
    expect(await canAccessMunicipality(provincial, "muni_x")).toBe(true);
  });

  it("admin_provincial no accede si la muni es de otra provincia", async () => {
    vi.mocked(Municipality.findById).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ provinceId: "otra_prov" }),
    } as never);
    expect(await canAccessMunicipality(provincial, "muni_y")).toBe(false);
  });

  it("retorna false si municipalityId está vacío", async () => {
    expect(await canAccessMunicipality(sa, "")).toBe(false);
  });
});
