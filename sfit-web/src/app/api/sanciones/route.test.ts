import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { signAccessToken } from "@/lib/auth/jwt";
import { ROLES, type Role } from "@/lib/constants";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ canAccessMunicipality: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/reputation/updateReputation", () => ({
  adjustVehicleReputation: vi.fn(),
  adjustDriverReputation: vi.fn(),
}));
vi.mock("@/lib/email/email_service", () => ({ sendEmail: vi.fn() }));
vi.mock("@/models/Sanction", () => ({
  Sanction: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: { findById: vi.fn() },
}));
vi.mock("@/models/Driver", () => ({
  Driver: { findById: vi.fn() },
}));
vi.mock("@/models/Company", () => ({
  Company: { findById: vi.fn() },
}));
vi.mock("@/models/User", () => ({
  User: { findOne: vi.fn() },
}));

import { Sanction } from "@/models/Sanction";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

const MUNI_ID = "664f0000000000000000001a";
const VEH_ID = "664f0000000000000000002b";
const DRV_ID = "664f0000000000000000003c";
const CMP_ID = "664f0000000000000000004d";

function leanChain<T>(result: T) {
  return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(result) };
}

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
    vi.mocked(Vehicle.findById).mockReturnValue(
      leanChain({ _id: VEH_ID, plate: "ABC-123", companyId: CMP_ID, currentDriverId: DRV_ID }) as never
    );
    vi.mocked(Driver.findById).mockReturnValue(
      leanChain({ name: "Juan", phone: "+51999111222", userId: "user_drv" }) as never
    );
    vi.mocked(Company.findById).mockReturnValue(
      leanChain({ razonSocial: "Trans Test SAC", representanteLegal: { phone: "+51988888888" } }) as never
    );
    vi.mocked(User.findOne).mockReturnValue(
      leanChain({ email: "operador@test.com" }) as never
    );
    vi.mocked(Sanction.create).mockResolvedValue({
      _id: { toString: () => "newSanc" },
      vehicleId: VEH_ID,
      driverId: DRV_ID,
      faultType: validBody.faultType,
      amountSoles: validBody.amountSoles,
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

  it("crea sanción con notificaciones derivadas de empresa, conductor y operador", async () => {
    await POST(req("POST", token(), validBody));
    const createCall = vi.mocked(Sanction.create).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    const notifs = createCall.notifications as { channel: string; target: string }[];
    expect(notifs.length).toBe(3);
    expect(notifs.find(n => n.channel === "email")?.target).toBe("operador@test.com");
    expect(notifs.find(n => n.channel === "whatsapp")?.target).toBe("+51999111222");
    expect(notifs.find(n => n.channel === "push")?.target).toBe("user_drv");
    expect(createCall.status).toBe("emitida");
    // companyId y driverId derivados del vehículo cuando no se envían
    expect(createCall.companyId).toBe(CMP_ID);
    expect(createCall.driverId).toBe(DRV_ID);
  });

  it("retorna 201 con sanción creada", async () => {
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("newSanc");
  });

  it("retorna 404 si el vehículo no existe", async () => {
    vi.mocked(Vehicle.findById).mockReturnValue(leanChain(null) as never);
    const res = await POST(req("POST", token(), validBody));
    expect(res.status).toBe(404);
  });
});
