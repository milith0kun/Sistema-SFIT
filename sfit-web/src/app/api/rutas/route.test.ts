import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/Route", () => ({
  Route: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import { Route } from "@/models/Route";

const MUNI_ID = "664f0000000000000000001a";

function makeChain(result: unknown[]) {
  return {
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function token(role: Role = ROLES.ADMIN_MUNICIPAL) {
  return signAccessToken({ userId: "u1", role, municipalityId: MUNI_ID });
}

function req(method: "GET" | "POST", tok: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/rutas${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockRuta = {
  _id: { toString: () => "ruta1" },
  municipalityId: { toString: () => MUNI_ID },
  code: "R-01",
  name: "Ruta Centro - Terminal",
  type: "ruta",
  stops: 12,
  length: "8.5 km",
  area: null,
  vehicleTypeKey: "transporte_publico",
  companyId: null,
  vehicleCount: 5,
  status: "activa",
  frequencies: ["06:00", "06:30"],
  createdAt: new Date(),
};

describe("GET /api/rutas", () => {
  beforeEach(() => {
    vi.mocked(Route.find).mockReturnValue(makeChain([mockRuta]) as never);
    vi.mocked(Route.countDocuments).mockResolvedValue(1);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/rutas"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para ciudadanos", async () => {
    const res = await GET(req("GET", token(ROLES.CIUDADANO)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con lista de rutas", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items[0].code).toBe("R-01");
    expect(body.data.items[0].type).toBe("ruta");
  });

  it("filtra por tipo zona", async () => {
    const mockZona = { ...mockRuta, _id: { toString: () => "zona1" }, type: "zona", code: "Z-01" };
    vi.mocked(Route.find).mockReturnValue(makeChain([mockZona]) as never);
    const res = await GET(req("GET", token(), undefined, "?type=zona"));
    expect(res.status).toBe(200);
    const callArg = vi.mocked(Route.find).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("type", "zona");
  });
});

describe("POST /api/rutas", () => {
  const validBody = {
    code: "R-05",
    name: "Ruta Mercado - Hospital",
    type: "ruta",
    vehicleTypeKey: "transporte_publico",
    stops: 8,
    length: "5.2 km",
  };

  beforeEach(() => {
    vi.mocked(Route.findOne).mockResolvedValue(null);
    vi.mocked(Route.create).mockResolvedValue({
      _id: { toString: () => "newRuta" },
      toObject: () => ({ ...validBody }),
    } as never);
  });

  it("retorna 422 sin campos requeridos", async () => {
    const res = await POST(req("POST", token(), { code: "R-05" }));
    expect(res.status).toBe(422);
  });

  it("retorna 409 si el código de ruta ya existe", async () => {
    vi.mocked(Route.findOne).mockResolvedValue({ _id: "existente" } as never);
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(409);
  });

  it("retorna 201 con ruta creada", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newRuta");
  });
});
