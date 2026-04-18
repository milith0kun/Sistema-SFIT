import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signQrPayload } from "@/lib/qr/hmac";
import { GET } from "./route";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Vehicle", () => ({ Vehicle: { findOne: vi.fn() } }));

import { Vehicle } from "@/models/Vehicle";

beforeEach(() => {
  process.env.QR_HMAC_SECRET = "test-qr-secret-sfit-32chars!!!!!!";
  vi.clearAllMocks();
});

const BASE_VEHICLE = {
  _id: { toString: () => "veh001" },
  plate: "CUS-001",
  vehicleTypeKey: "bus_interprovincial",
  brand: "Mercedes",
  model: "OF-1721",
  year: 2022,
  status: "disponible",
  active: true,
  lastInspectionStatus: "aprobada",
  reputationScore: 92,
  companyId: { razonSocial: "Transportes Sol S.A." },
  currentDriverId: {
    _id: { toString: () => "drv001" },
    name: "Carlos Quispe",
    licenseCategory: "A-IIIb",
    reputationScore: 88,
    status: "apto",
  },
};

function makePopulate(result: unknown) {
  return { populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(result) };
}

function req(search: string) {
  return new NextRequest(`http://localhost/api/public/vehiculo${search}`);
}

// ── Sin parámetros ──────────────────────────────────────────────────────────
describe("GET /api/public/vehiculo — parámetros inválidos", () => {
  it("retorna 400 sin ningún parámetro", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });
});

// ── Búsqueda por plate ─────────────────────────────────────────────────────
describe("GET /api/public/vehiculo?plate=", () => {
  it("retorna 404 si el vehículo no existe", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(null) as never);
    const res = await GET(req("?plate=XXX-999"));
    expect(res.status).toBe(404);
  });

  it("retorna 200 con datos del vehículo e indicador verde", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(BASE_VEHICLE) as never);
    const res = await GET(req("?plate=CUS-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.vehicle.plate).toBe("CUS-001");
    expect(body.data.vehicle.indicator).toBe("verde");
    expect(body.data.qrSignatureValid).toBeNull();
  });

  it("normaliza la placa a mayúsculas", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(BASE_VEHICLE) as never);
    await GET(req("?plate=cus-001"));
    expect(vi.mocked(Vehicle.findOne)).toHaveBeenCalledWith(
      expect.objectContaining({ plate: "CUS-001", active: true }),
    );
  });

  it("indicador amarillo cuando inspección observada", async () => {
    const v = { ...BASE_VEHICLE, lastInspectionStatus: "observada" };
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(v) as never);
    const res = await GET(req("?plate=CUS-001"));
    const body = await res.json();
    expect(body.data.vehicle.indicator).toBe("amarillo");
  });

  it("indicador amarillo cuando reputación < 60", async () => {
    const v = { ...BASE_VEHICLE, reputationScore: 45 };
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(v) as never);
    const res = await GET(req("?plate=CUS-001"));
    const body = await res.json();
    expect(body.data.vehicle.indicator).toBe("amarillo");
  });

  it("indicador rojo cuando inspección rechazada", async () => {
    const v = { ...BASE_VEHICLE, lastInspectionStatus: "rechazada" };
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(v) as never);
    const res = await GET(req("?plate=CUS-001"));
    const body = await res.json();
    expect(body.data.vehicle.indicator).toBe("rojo");
  });

  it("indicador rojo cuando status fuera_de_servicio", async () => {
    const v = { ...BASE_VEHICLE, status: "fuera_de_servicio" };
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(v) as never);
    const res = await GET(req("?plate=CUS-001"));
    const body = await res.json();
    expect(body.data.vehicle.indicator).toBe("rojo");
  });

  it("retorna driver null si no hay conductor asignado", async () => {
    const v = { ...BASE_VEHICLE, currentDriverId: null };
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(v) as never);
    const res = await GET(req("?plate=CUS-001"));
    const body = await res.json();
    expect(body.data.driver).toBeNull();
  });
});

// ── Búsqueda por QR ────────────────────────────────────────────────────────
describe("GET /api/public/vehiculo?qr=", () => {
  it("verifica firma válida y retorna qrSignatureValid: true", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(BASE_VEHICLE) as never);
    const payload = signQrPayload("veh001", "CUS-001", "muni001", "bus_interprovincial");
    const qr = encodeURIComponent(JSON.stringify(payload));
    const res = await GET(req(`?qr=${qr}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.qrSignatureValid).toBe(true);
  });

  it("firma inválida devuelve qrSignatureValid: false pero sigue buscando por placa", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(BASE_VEHICLE) as never);
    const payload = { v: 1, id: "veh001", pl: "CUS-001", mu: "muni001", ty: "bus", ts: 1000, sig: "a".repeat(64) };
    const qr = encodeURIComponent(JSON.stringify(payload));
    const res = await GET(req(`?qr=${qr}`));
    const body = await res.json();
    expect(body.data.qrSignatureValid).toBe(false);
  });

  it("JSON malformado retorna 400 (no se puede extraer plate del QR)", async () => {
    const res = await GET(req(`?qr=not-valid-json`));
    expect(res.status).toBe(400);
  });

  it("usa la placa del QR para buscar el vehículo si no se provee plate", async () => {
    vi.mocked(Vehicle.findOne).mockReturnValue(makePopulate(BASE_VEHICLE) as never);
    const payload = signQrPayload("veh001", "CUS-001", "muni001", "bus_interprovincial");
    const qr = encodeURIComponent(JSON.stringify(payload));
    await GET(req(`?qr=${qr}`));
    expect(vi.mocked(Vehicle.findOne)).toHaveBeenCalledWith(
      expect.objectContaining({ plate: "CUS-001" }),
    );
  });
});
