import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/CitizenReport", () => ({
  CitizenReport: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
}));

import { CitizenReport } from "@/models/CitizenReport";

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

function token(role: Role = ROLES.ADMIN_MUNICIPAL) {
  return signAccessToken({ userId: "u1", role, municipalityId: MUNI_ID });
}

function req(method: "GET" | "POST", tok: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/reportes${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockReport = {
  _id: { toString: () => "rep1" },
  municipalityId: { toString: () => MUNI_ID },
  vehicleId: { plate: "ABC-123", vehicleTypeKey: "transporte_publico" },
  citizenId: { name: "María Torres" },
  category: "Exceso de velocidad",
  vehicleTypeKey: "transporte_publico",
  citizenReputationLevel: "regular",
  status: "pendiente",
  description: "El vehículo iba a exceso de velocidad por la av. principal.",
  evidenceUrl: null,
  fraudScore: 75,
  fraudLayers: [{ layer: "Identidad", passed: true, detail: "Verificado" }],
  createdAt: new Date(),
};

describe("GET /api/reportes", () => {
  beforeEach(() => {
    vi.mocked(CitizenReport.find).mockReturnValue(makeChain([mockReport]) as never);
    vi.mocked(CitizenReport.countDocuments).mockResolvedValue(1);
    vi.mocked(CitizenReport.aggregate).mockResolvedValue([{ _id: "pendiente", count: 1 }]);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/reportes"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para operadores", async () => {
    const res = await GET(req("GET", token(ROLES.OPERADOR)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con reportes y statusCounts", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items[0].category).toBe("Exceso de velocidad");
    expect(body.data.statusCounts).toEqual({ pendiente: 1 });
  });

  it("filtra por status=pendiente", async () => {
    await GET(req("GET", token(), undefined, "?status=pendiente"));
    const callArg = vi.mocked(CitizenReport.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("status", "pendiente");
  });
});

describe("POST /api/reportes", () => {
  const validBody = {
    category: "Conductor agresivo",
    description: "El conductor insultó a los pasajeros durante el recorrido.",
  };

  beforeEach(() => {
    vi.mocked(CitizenReport.create).mockResolvedValue({
      _id: { toString: () => "newRep" },
      toObject: () => ({ ...validBody, fraudLayers: [] }),
    } as never);
  });

  it("retorna 422 si la descripción es demasiado corta", async () => {
    const res = await POST(req("POST", token(ROLES.CIUDADANO), { category: "X", description: "corto" }));
    expect(res.status).toBe(422);
  });

  it("crea reporte con 5 fraudLayers automáticos", async () => {
    const res = await POST(req("POST", token(ROLES.CIUDADANO), validBody));
    expect(res.status).toBe(201);
    const createCall = vi.mocked(CitizenReport.create).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect((createCall.fraudLayers as unknown[]).length).toBe(5);
  });

  it("retorna 201 con reporte creado", async () => {
    const res = await POST(req("POST", token(ROLES.CIUDADANO), validBody));
    const body = await res.json();
    expect(body.data.id).toBe("newRep");
  });
});
