import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/Trip", () => ({
  Trip: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { Trip } from "@/models/Trip";

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
  return new NextRequest(`http://localhost/api/viajes${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockTrip = {
  _id: { toString: () => "trip1" },
  municipalityId: { toString: () => MUNI_ID },
  vehicleId: { plate: "ABC-123" },
  driverId: { name: "Juan Pérez" },
  routeId: null,
  startTime: new Date(),
  endTime: null,
  km: 15,
  passengers: 20,
  status: "completado",
  createdAt: new Date(),
};

describe("GET /api/viajes", () => {
  beforeEach(() => {
    vi.mocked(Trip.find).mockReturnValue(makeChain([mockTrip]) as never);
    vi.mocked(Trip.countDocuments).mockResolvedValue(1);
    vi.mocked(Trip.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/viajes"));
    expect(res.status).toBe(401);
  });

  it("retorna 403 para ciudadanos", async () => {
    const res = await GET(req("GET", token(ROLES.CIUDADANO)));
    expect(res.status).toBe(403);
  });

  it("retorna 200 con viajes del período", async () => {
    const res = await GET(req("GET", token(), undefined, "?period=hoy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].km).toBe(15);
  });

  it("aplica filtro de fecha para period=hoy", async () => {
    await GET(req("GET", token(), undefined, "?period=hoy"));
    const callArg = vi.mocked(Trip.find).mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(callArg).toHaveProperty("startTime");
  });

  it("retorna todos los viajes sin filtro de período", async () => {
    const res = await GET(req("GET", token(), undefined, "?period=todos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(1);
  });
});

describe("POST /api/viajes", () => {
  const VEH_ID = "664f0000000000000000002b";
  const DRV_ID = "664f0000000000000000003c";

  beforeEach(() => {
    vi.mocked(Trip.create).mockResolvedValue({
      _id: { toString: () => "newTrip" },
      toObject: () => ({ status: "en_curso" }),
    } as never);
  });

  it("retorna 403 para fiscal (no puede crear viajes)", async () => {
    const res = await POST(req("POST", token(ROLES.FISCAL), { vehicleId: VEH_ID, driverId: DRV_ID }));
    expect(res.status).toBe(403);
  });

  it("retorna 422 sin body requerido", async () => {
    const res = await POST(req("POST", token(ROLES.OPERADOR), {}));
    expect(res.status).toBe(422);
  });

  it("retorna 201 con viaje creado por operador", async () => {
    const res = await POST(req("POST", token(ROLES.OPERADOR), { vehicleId: VEH_ID, driverId: DRV_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newTrip");
  });
});
