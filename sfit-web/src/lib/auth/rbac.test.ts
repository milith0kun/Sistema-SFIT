import { describe, it, expect } from "vitest";
import { canAccessProvince, scopedMunicipalityFilter, canAccessMunicipality } from "./rbac";
import { ROLES } from "@/lib/constants";
import type { JwtPayload } from "./jwt";

const sa: JwtPayload = { userId: "sa", role: ROLES.SUPER_ADMIN };
const municipal: JwtPayload = { userId: "muni", role: ROLES.ADMIN_MUNICIPAL, municipalityId: "muni1" };
const fiscal: JwtPayload = { userId: "fis", role: ROLES.FISCAL, municipalityId: "muni1" };

describe("canAccessProvince", () => {
  it("super_admin accede a cualquier provincia", () => {
    expect(canAccessProvince(sa, "cualquier_provincia")).toBe(true);
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

  it("admin_municipal accede a CUALQUIER municipalidad (mono-muni administrativo)", async () => {
    // Cotabambas Provincial administra los 6 distritos como un solo
    // tenant; las munis distritales sembradas son zonificación operativa.
    expect(await canAccessMunicipality(municipal, "muni2")).toBe(true);
  });

  it("fiscal accede a su municipalidad", async () => {
    expect(await canAccessMunicipality(fiscal, "muni1")).toBe(true);
  });

  it("recurso sin municipalityId: super_admin sí accede (global)", async () => {
    expect(await canAccessMunicipality(sa, "")).toBe(true);
  });

  it("recurso sin municipalityId: admin_municipal sí accede (legacy en mono-muni)", async () => {
    // Post cleanup municipal el sistema opera sobre una sola muni; los
    // recursos sin muni son implícitamente de la muni activa del admin.
    expect(await canAccessMunicipality(municipal, "")).toBe(true);
  });
});
