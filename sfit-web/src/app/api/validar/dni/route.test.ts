import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(() => ({
    userId: "u1",
    role: "super_admin",
    municipalityId: "m1",
    provinceId: null,
  })),
}));

vi.mock("@/lib/apiperu/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiperu/client")>(
    "@/lib/apiperu/client",
  );
  return {
    ...actual,
    consultarDni: vi.fn(),
  };
});

import { consultarDni, ApiPeruError } from "@/lib/apiperu/client";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/validar/dni", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/validar/dni", () => {
  const ORIGINAL_ENV = process.env.ENABLE_DNI_MOCK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.ENABLE_DNI_MOCK = ORIGINAL_ENV;
  });

  it("respuesta RENIEC exitosa incluye source: 'reniec'", async () => {
    vi.mocked(consultarDni).mockResolvedValue({
      nombres: "Juan",
      apellido_paterno: "Pérez",
      apellido_materno: "García",
      nombre_completo: "Juan Pérez García",
    });
    const res = await POST(req({ dni: "12345678" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.source).toBe("reniec");
    expect(body.data.nombre_completo).toBe("Juan Pérez García");
  });

  it("ENABLE_DNI_MOCK=false → falla apiperu por origin → devuelve 502 (sin mock)", async () => {
    process.env.ENABLE_DNI_MOCK = "false";
    vi.mocked(consultarDni).mockRejectedValue(
      new ApiPeruError("origin", "Origen no autorizado"),
    );
    const res = await POST(req({ dni: "12345678" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/origen|autorizado/i);
  });

  it("ENABLE_DNI_MOCK=true → falla apiperu por origin → devuelve mock con source: 'mock'", async () => {
    process.env.ENABLE_DNI_MOCK = "true";
    vi.mocked(consultarDni).mockRejectedValue(
      new ApiPeruError("origin", "Origen no autorizado"),
    );
    const res = await POST(req({ dni: "12345678" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.source).toBe("mock");
    expect(body.data.nombre_completo).toBe("USUARIO MOCK DE PRUEBA");
  });

  it("ENABLE_DNI_MOCK=true → notfound real → devuelve 404 (NO se mockea)", async () => {
    process.env.ENABLE_DNI_MOCK = "true";
    vi.mocked(consultarDni).mockRejectedValue(
      new ApiPeruError("notfound", "DNI no existe"),
    );
    const res = await POST(req({ dni: "00000000" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("DNI con formato inválido devuelve 400", async () => {
    const res = await POST(req({ dni: "abc" }));
    expect(res.status).toBe(400);
  });
});
