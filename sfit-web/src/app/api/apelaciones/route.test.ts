import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Apelacion", () => ({
  Apelacion: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("@/models/Inspection", () => ({
  Inspection: {
    findById: vi.fn(),
  },
}));

import { Apelacion } from "@/models/Apelacion";
import { Inspection } from "@/models/Inspection";

const MUNI_ID = "664f0000000000000000001a";
const INSP_ID = "664f0000000000000000003c";

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
  return signAccessToken({ userId: "u1", role, municipalityId: MUNI_ID });
}

function req(method: "GET" | "POST", tok: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/apelaciones${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockApelacion = {
  _id: { toString: () => "apel1" },
  inspectionId: { result: "rechazada", date: new Date(), score: 45 },
  vehicleId: { plate: "XYZ-999", vehicleTypeKey: "transporte_publico" },
  submittedBy: { name: "Operador Flores", email: "flores@op.com" },
  reason: "La inspección fue incorrecta porque el vehículo fue revisado sin el instrumental adecuado.",
  evidence: [],
  status: "pendiente",
  resolvedBy: null,
  resolvedAt: null,
  resolution: null,
  createdAt: new Date(),
};

const mockInspection = {
  _id: INSP_ID,
  result: "rechazada",
  municipalityId: MUNI_ID,
  vehicleId: "664f0000000000000000002b",
  date: new Date(),
  score: 45,
};

describe("POST /api/apelaciones", () => {
  const validBody = {
    inspectionId: INSP_ID,
    reason: "La inspección fue incorrecta porque el vehículo fue revisado sin instrumental adecuado.",
  };

  beforeEach(() => {
    vi.mocked(Inspection.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockInspection),
    } as never);
    vi.mocked(Apelacion.findOne).mockResolvedValue(null);
    vi.mocked(Apelacion.create).mockResolvedValue({
      _id: { toString: () => "newApel" },
      toObject: () => ({ ...validBody, status: "pendiente", evidence: [] }),
    } as never);
  });

  it("crear apelación sin auth devuelve 401", async () => {
    const res = await POST(new NextRequest("http://localhost/api/apelaciones", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("crear apelación con rol incorrecto (fiscal) devuelve 403", async () => {
    const res = await POST(req("POST", token(ROLES.FISCAL), validBody));
    expect(res.status).toBe(403);
  });

  it("crear apelación con rol incorrecto (ciudadano) devuelve 403", async () => {
    const res = await POST(req("POST", token(ROLES.CIUDADANO), validBody));
    expect(res.status).toBe(403);
  });

  it("crear apelación con inspección inexistente devuelve 404", async () => {
    vi.mocked(Inspection.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const res = await POST(req("POST", token(ROLES.OPERADOR), validBody));
    expect(res.status).toBe(404);
  });

  it("crear apelación con inspección aprobada devuelve 422", async () => {
    vi.mocked(Inspection.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...mockInspection, result: "aprobada" }),
    } as never);
    const res = await POST(req("POST", token(ROLES.OPERADOR), validBody));
    expect(res.status).toBe(422);
  });

  it("crear apelación duplicada devuelve 409", async () => {
    vi.mocked(Apelacion.findOne).mockResolvedValue({ _id: "existing" } as never);
    const res = await POST(req("POST", token(ROLES.OPERADOR), validBody));
    expect(res.status).toBe(409);
  });

  it("crear apelación válida como operador devuelve 201", async () => {
    const res = await POST(req("POST", token(ROLES.OPERADOR), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newApel");
  });

  it("crear apelación con razón demasiado corta devuelve 422", async () => {
    const res = await POST(req("POST", token(ROLES.OPERADOR), { ...validBody, reason: "corto" }));
    expect(res.status).toBe(422);
  });
});

describe("GET /api/apelaciones", () => {
  beforeEach(() => {
    vi.mocked(Apelacion.find).mockReturnValue(makeChain([mockApelacion]) as never);
    vi.mocked(Apelacion.countDocuments).mockResolvedValue(1);
  });

  it("listar apelaciones sin auth devuelve 401", async () => {
    const res = await GET(new NextRequest("http://localhost/api/apelaciones"));
    expect(res.status).toBe(401);
  });

  it("listar apelaciones como ciudadano devuelve 403", async () => {
    const res = await GET(req("GET", token(ROLES.CIUDADANO)));
    expect(res.status).toBe(403);
  });

  it("listar apelaciones como fiscal devuelve lista", async () => {
    const res = await GET(req("GET", token(ROLES.FISCAL)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items[0].reason).toBeDefined();
    expect(body.data.total).toBe(1);
  });

  it("listar apelaciones como operador solo ve las suyas", async () => {
    const operToken = signAccessToken({ userId: "op1", role: ROLES.OPERADOR, municipalityId: MUNI_ID });
    await GET(req("GET", operToken));
    const callArg = vi.mocked(Apelacion.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("submittedBy", "op1");
  });

  it("filtra por status=aprobada", async () => {
    await GET(req("GET", token(), undefined, "?status=aprobada"));
    const callArg = vi.mocked(Apelacion.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("status", "aprobada");
  });
});
