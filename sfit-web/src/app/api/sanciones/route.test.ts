import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/Sanction", () => ({
  Sanction: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));

import { Sanction } from "@/models/Sanction";

const MUNI_ID = "664f0000000000000000001a";
const VEH_ID = "664f0000000000000000002b";

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
  return new NextRequest(`http://localhost/api/sanciones${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockSanction = {
  _id: { toString: () => "sanc1" },
  municipalityId: { toString: () => MUNI_ID },
  vehicleId: { plate: "ABC-123" },
  driverId: null,
  companyId: null,
  faultType: "Exceso de velocidad",
  amountSoles: 420,
  amountUIT: "0.5 UIT",
  status: "emitida",
  notifications: [
    { channel: "email", target: "empresa@test.com", status: "pendiente" },
  ],
  appealNotes: null,
  resolvedAt: null,
  createdAt: new Date(),
};

describe("GET /api/sanciones", () => {
  beforeEach(() => {
    vi.mocked(Sanction.find).mockReturnValue(makeChain([mockSanction]) as never);
    vi.mocked(Sanction.countDocuments).mockResolvedValue(1);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/sanciones"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para operadores", async () => {
    const res = await GET(req("GET", token(ROLES.OPERADOR)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con lista de sanciones", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items[0].faultType).toBe("Exceso de velocidad");
    expect(body.data.items[0].amountSoles).toBe(420);
  });

  it("filtra por status=apelada", async () => {
    await GET(req("GET", token(), undefined, "?status=apelada"));
    const callArg = vi.mocked(Sanction.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("status", "apelada");
  });
});

describe("POST /api/sanciones", () => {
  const validBody = {
    vehicleId: VEH_ID,
    faultType: "Falta de mantenimiento",
    amountSoles: 210,
    amountUIT: "0.25 UIT",
  };

  beforeEach(() => {
    vi.mocked(Sanction.create).mockResolvedValue({
      _id: { toString: () => "newSanc" },
      toObject: () => ({ ...validBody, status: "emitida" }),
    } as never);
  });

  it("retorna 403 para conductores", async () => {
    const res = await POST(req("POST", token(ROLES.CONDUCTOR), validBody));
    expect(res.status).toBe(403);
  });

  it("retorna 422 si faltan campos obligatorios", async () => {
    const res = await POST(req("POST", token(), { vehicleId: VEH_ID }));
    expect(res.status).toBe(422);
  });

  it("crea sanción con 3 notificaciones automáticas", async () => {
    await POST(req("POST", token(), validBody));
    const createCall = vi.mocked(Sanction.create).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect((createCall.notifications as unknown[]).length).toBe(3);
    expect(createCall.status).toBe("emitida");
  });

  it("retorna 201 con sanción creada", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newSanc");
  });
});
