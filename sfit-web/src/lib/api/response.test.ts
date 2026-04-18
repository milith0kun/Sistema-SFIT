import { describe, it, expect } from "vitest";
import {
  apiResponse,
  apiError,
  apiValidationError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
} from "./response";

describe("apiResponse", () => {
  it("retorna status 200 por defecto con success:true", async () => {
    const res = apiResponse({ name: "test" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { name: "test" } });
  });

  it("acepta status personalizado", async () => {
    const res = apiResponse({ id: "abc" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("apiError", () => {
  it("retorna status 400 por defecto con success:false", async () => {
    const res = apiError("Algo salió mal");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Algo salió mal" });
  });

  it("acepta status personalizado", async () => {
    const res = apiError("Error interno", 500);
    expect(res.status).toBe(500);
  });
});

describe("apiValidationError", () => {
  it("retorna 422 con los errores de validación", async () => {
    const res = apiValidationError({ name: ["Requerido"], dni: ["Demasiado corto"] });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors.name).toContain("Requerido");
    expect(body.errors.dni).toContain("Demasiado corto");
  });
});

describe("apiUnauthorized", () => {
  it("retorna 401 con mensaje por defecto", async () => {
    const res = apiUnauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("No autorizado");
  });

  it("acepta mensaje personalizado", async () => {
    const res = apiUnauthorized("Sesión expirada");
    const body = await res.json();
    expect(body.error).toBe("Sesión expirada");
  });
});

describe("apiForbidden", () => {
  it("retorna 403", async () => {
    const res = apiForbidden();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Acceso denegado");
  });
});

describe("apiNotFound", () => {
  it("retorna 404", async () => {
    const res = apiNotFound("Conductor no encontrado");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Conductor no encontrado");
  });
});
