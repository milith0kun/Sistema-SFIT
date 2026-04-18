import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/Driver", () => ({
  Driver: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import { Driver } from "@/models/Driver";

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
  const url = `http://localhost/api/conductores${search}`;
  return new NextRequest(url, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockDriver = {
  _id: { toString: () => "drv1" },
  municipalityId: { toString: () => MUNI_ID },
  companyId: null,
  name: "Ana García",
  dni: "12345678",
  licenseNumber: "Q12345",
  licenseCategory: "A-IIIb",
  phone: "999888777",
  status: "apto",
  continuousHours: 3,
  restHours: 8,
  reputationScore: 95,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/conductores", () => {
  beforeEach(() => {
    vi.mocked(Driver.find).mockReturnValue(makeChain([mockDriver]) as never);
    vi.mocked(Driver.countDocuments).mockResolvedValue(1);
    vi.mocked(Driver.aggregate).mockResolvedValue([{ _id: "apto", count: 1 }]);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/conductores"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 con rol no permitido (ciudadano)", async () => {
    const res = await GET(req("GET", token(ROLES.CIUDADANO)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con lista de conductores para admin_municipal", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe("Ana García");
    expect(body.data.statusCounts).toEqual({ apto: 1 });
  });

  it("retorna 200 con lista vacía cuando no hay conductores", async () => {
    vi.mocked(Driver.find).mockReturnValue(makeChain([]) as never);
    vi.mocked(Driver.countDocuments).mockResolvedValue(0);
    vi.mocked(Driver.aggregate).mockResolvedValue([]);
    const res = await GET(req("GET", token()));
    const body = await res.json();
    expect(body.data.items).toHaveLength(0);
    expect(body.data.total).toBe(0);
  });

  it("acepta filtro por status en la query", async () => {
    const res = await GET(req("GET", token(), undefined, "?status=apto"));
    expect(res.status).toBe(200);
    expect(vi.mocked(Driver.find)).toHaveBeenCalledWith(
      expect.objectContaining({ status: "apto" }),
    );
  });
});

describe("POST /api/conductores", () => {
  const validBody = {
    name: "Pedro López",
    dni: "87654321",
    licenseNumber: "B98765",
    licenseCategory: "A-IIb",
  };

  beforeEach(() => {
    vi.mocked(Driver.findOne).mockResolvedValue(null);
    vi.mocked(Driver.create).mockResolvedValue({
      _id: { toString: () => "newDrv" },
      toObject: () => ({ ...validBody }),
    } as never);
  });

  it("retorna 401 sin token", async () => {
    const res = await POST(new NextRequest("http://localhost/api/conductores", {
      method: "POST", body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(401);
  });

  it("retorna 422 con body inválido (sin campos requeridos)", async () => {
    const res = await POST(req("POST", token(), { name: "X" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
  });

  it("retorna 409 si el DNI ya existe", async () => {
    vi.mocked(Driver.findOne).mockResolvedValue({ _id: "existing" } as never);
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(409);
  });

  it("retorna 201 con conductor creado", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("newDrv");
  });
});
