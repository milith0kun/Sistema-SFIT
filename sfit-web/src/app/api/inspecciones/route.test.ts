import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notifications/fcm", () => ({ sendPushToTokens: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit/logAction", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/webhooks/triggerWebhook", () => ({ triggerWebhook: vi.fn() }));
vi.mock("@/lib/reputation/updateReputation", () => ({ adjustVehicleReputation: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/models/User", () => ({
  User: { find: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) },
}));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: { findById: vi.fn() },
}));
vi.mock("@/models/Company", () => ({
  Company: { findById: vi.fn() },
}));
vi.mock("@/models/Municipality", () => ({
  Municipality: { findById: vi.fn() },
}));
vi.mock("@/models/Inspection", () => ({
  Inspection: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

import { Inspection } from "@/models/Inspection";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
import { Municipality } from "@/models/Municipality";

function leanChain<T>(result: T) {
  return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(result) };
}

const MUNI_ID = "664f0000000000000000001a";

function makeChain(result: unknown[]) {
  return {
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function token(role: Role = ROLES.FISCAL) {
  return signAccessToken({ userId: "fis1", role, municipalityId: MUNI_ID });
}

function req(method: "GET" | "POST", tok: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/inspecciones${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockInspection = {
  _id: { toString: () => "insp1" },
  municipalityId: { toString: () => MUNI_ID },
  vehicleId: { plate: "ABC-123", vehicleTypeKey: "transporte_publico", brand: "Toyota", model: "Coaster" },
  fiscalId: { name: "Carlos Quispe" },
  driverId: null,
  vehicleTypeKey: "transporte_publico",
  date: new Date(),
  score: 85,
  result: "aprobada",
  observations: null,
  evidenceUrls: [],
  qrCode: null,
  createdAt: new Date(),
};

describe("GET /api/inspecciones", () => {
  beforeEach(() => {
    vi.mocked(Inspection.find).mockReturnValue(makeChain([mockInspection]) as never);
    vi.mocked(Inspection.countDocuments).mockResolvedValue(1);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/inspecciones"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para ciudadanos", async () => {
    const res = await GET(req("GET", token(ROLES.CIUDADANO)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con lista de inspecciones", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items[0].score).toBe(85);
    expect(body.data.items[0].result).toBe("aprobada");
  });

  it("filtra por resultado", async () => {
    await GET(req("GET", token(), undefined, "?result=rechazada"));
    const callArg = vi.mocked(Inspection.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("result", "rechazada");
  });
});

describe("POST /api/inspecciones", () => {
  const VEH_ID = "664f0000000000000000002b";
  const validBody = {
    vehicleId: VEH_ID,
    vehicleTypeKey: "transporte_publico",
    checklistResults: [{ item: "Frenos", passed: true }],
    score: 90,
    result: "aprobada",
  };

  beforeEach(() => {
    vi.mocked(Vehicle.findById).mockReturnValue(
      leanChain({ companyId: undefined, plate: "ABC-123" }) as never
    );
    vi.mocked(Company.findById).mockReturnValue(leanChain(null) as never);
    vi.mocked(Municipality.findById).mockReturnValue(leanChain(null) as never);
    vi.mocked(Inspection.create).mockResolvedValue({
      _id: { toString: () => "newInsp" },
      toObject: () => ({ ...validBody }),
    } as never);
  });

  it("retorna 401 sin token", async () => {
    const res = await POST(new NextRequest("http://localhost/api/inspecciones", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para ciudadanos (no pueden crear inspecciones)", async () => {
    const res = await POST(req("POST", token(ROLES.CIUDADANO), validBody));
    expect(res.status).toBe(403);
  });

  it("retorna 403 para operadores (no pueden crear inspecciones)", async () => {
    const res = await POST(req("POST", token(ROLES.OPERADOR), validBody));
    expect(res.status).toBe(403);
  });

  it("retorna 422 si faltan campos requeridos", async () => {
    const res = await POST(req("POST", token(), { vehicleId: VEH_ID }));
    expect(res.status).toBe(422);
  });

  it("retorna 422 si score está fuera de rango (>100)", async () => {
    const res = await POST(req("POST", token(), { ...validBody, score: 150 }));
    expect(res.status).toBe(422);
  });

  it("retorna 422 si score está fuera de rango (<0)", async () => {
    const res = await POST(req("POST", token(), { ...validBody, score: -5 }));
    expect(res.status).toBe(422);
  });

  it("retorna 422 si result no es un valor válido", async () => {
    const res = await POST(req("POST", token(), { ...validBody, result: "invalido" }));
    expect(res.status).toBe(422);
  });

  it("retorna 422 si checklistResults está vacío", async () => {
    const res = await POST(req("POST", token(), { ...validBody, checklistResults: [] }));
    expect(res.status).toBe(422);
  });

  it("retorna 201 con inspección creada por fiscal", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newInsp");
  });
});
