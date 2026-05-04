import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import { Vehicle } from "@/models/Vehicle";

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
  return new NextRequest(`http://localhost/api/vehiculos${search}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockVehicle = {
  _id: { toString: () => "veh1" },
  municipalityId: { toString: () => MUNI_ID },
  companyId: null,
  currentDriverId: null,
  plate: "ABC-123",
  vehicleTypeKey: "transporte_publico",
  brand: "Toyota",
  model: "Coaster",
  year: 2020,
  status: "disponible",
  lastInspectionStatus: "aprobada",
  reputationScore: 90,
  soatExpiry: null,
  qrHmac: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/vehiculos", () => {
  beforeEach(() => {
    vi.mocked(Vehicle.find).mockReturnValue(makeChain([mockVehicle]) as never);
    vi.mocked(Vehicle.countDocuments).mockResolvedValue(1);
  });

  it("retorna 401 sin token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/vehiculos"));
    expect(res.status).toBe(401);
  });

  it("permite conductores (ven vehículos de su muni)", async () => {
    // El conductor consulta /api/vehiculos para identificar el bus asignado
    // a su turno (FleetEntry.vehicleId). El scope queda limitado a la muni
    // del JWT por la lógica de filter, igual que para fiscal/operador.
    const res = await GET(req("GET", token(ROLES.CONDUCTOR)));
    expect(res.status).toBe(200);
  });

  it("retorna 200 con lista de vehículos", async () => {
    const res = await GET(req("GET", token()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items[0].plate).toBe("ABC-123");
    expect(body.data.total).toBe(1);
  });

  it("filtra por tipo de vehículo", async () => {
    const res = await GET(req("GET", token(), undefined, "?type=limpieza_residuos"));
    expect(res.status).toBe(200);
    expect(vi.mocked(Vehicle.find)).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleTypeKey: "limpieza_residuos" }),
    );
  });
});

describe("POST /api/vehiculos", () => {
  const validBody = {
    plate: "XYZ-999",
    vehicleTypeKey: "transporte_publico",
    brand: "Mercedes",
    model: "Sprinter",
    year: 2022,
  };

  beforeEach(() => {
    vi.mocked(Vehicle.findOne).mockResolvedValue(null);
    vi.mocked(Vehicle.create).mockResolvedValue({
      _id: { toString: () => "newVeh" },
      toObject: () => ({ ...validBody }),
    } as never);
  });

  it("retorna 422 si faltan campos requeridos", async () => {
    const res = await POST(req("POST", token(), { plate: "ABC" }));
    expect(res.status).toBe(422);
  });

  it("retorna 409 si la placa ya existe", async () => {
    vi.mocked(Vehicle.findOne).mockResolvedValue({ _id: "existente" } as never);
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(409);
  });

  it("retorna 201 con vehículo creado", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newVeh");
  });
});
