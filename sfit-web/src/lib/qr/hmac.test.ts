import { describe, it, expect, beforeEach } from "vitest";
import { signQrPayload, verifyQrPayload, QR_VERSION, type QrPayload } from "./hmac";

beforeEach(() => {
  process.env.QR_HMAC_SECRET = "test-qr-secret-sfit-32chars!!!!!!";
});

const VEHICLE_ID   = "64a1b2c3d4e5f6a7b8c9d0e1";
const PLATE        = "CUS-001";
const MUNICIPALITY = "64a0000000000000000000ab";
const TYPE_KEY     = "bus_interprovincial";

describe("signQrPayload", () => {
  it("genera un payload con todos los campos requeridos", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(p.v).toBe(QR_VERSION);
    expect(p.id).toBe(VEHICLE_ID);
    expect(p.pl).toBe(PLATE);
    expect(p.mu).toBe(MUNICIPALITY);
    expect(p.ty).toBe(TYPE_KEY);
    expect(typeof p.ts).toBe("number");
    expect(p.ts).toBeGreaterThan(0);
    expect(typeof p.sig).toBe("string");
    expect(p.sig).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("el timestamp es aproximadamente el tiempo actual", () => {
    const before = Math.floor(Date.now() / 1000);
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    const after  = Math.floor(Date.now() / 1000);
    expect(p.ts).toBeGreaterThanOrEqual(before);
    expect(p.ts).toBeLessThanOrEqual(after);
  });

  it("cambiar el ts produce una firma diferente (firma es función de todos los campos)", () => {
    const p1 = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    // Construir mismo payload pero con ts + 1 y re-firmar manualmente
    const { createHmac } = require("node:crypto");
    const secret = process.env.QR_HMAC_SECRET ?? "";
    const altTs = p1.ts + 1;
    const altSig = createHmac("sha256", secret)
      .update(`v${p1.v}|${p1.id}|${p1.pl}|${p1.mu}|${p1.ty}|${altTs}`)
      .digest("hex");
    expect(p1.sig).not.toBe(altSig);
  });

  it("distintos vehículos producen firmas distintas", () => {
    const p1 = signQrPayload("aaa111", PLATE, MUNICIPALITY, TYPE_KEY);
    const p2 = signQrPayload("bbb222", PLATE, MUNICIPALITY, TYPE_KEY);
    expect(p1.sig).not.toBe(p2.sig);
  });
});

describe("verifyQrPayload", () => {
  it("verifica un payload recién firmado", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload(p)).toBe(true);
  });

  it("rechaza payload con firma manipulada", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    const tampered: QrPayload = { ...p, sig: "a".repeat(64) };
    expect(verifyQrPayload(tampered)).toBe(false);
  });

  it("rechaza payload con id modificado", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, id: "otro_id_malicioso" })).toBe(false);
  });

  it("rechaza payload con plate modificada", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, pl: "CUS-999" })).toBe(false);
  });

  it("rechaza payload con municipio modificado", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, mu: "otro_municipio" })).toBe(false);
  });

  it("rechaza payload con tipo de vehículo modificado", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, ty: "taxi" })).toBe(false);
  });

  it("rechaza payload con timestamp modificado", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, ts: p.ts + 999 })).toBe(false);
  });

  it("rechaza payload con firma de longitud incorrecta (tamper de truncación)", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, sig: p.sig.slice(0, 32) })).toBe(false);
  });

  it("rechaza cuando se usa secreto diferente", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    process.env.QR_HMAC_SECRET = "otro-secreto-completamente-diferente!!";
    expect(verifyQrPayload(p)).toBe(false);
  });

  it("acepta payload válido independientemente del secreto largo", () => {
    process.env.QR_HMAC_SECRET = "secreto-muy-largo-con-caracteres-especiales-!@#$%^&*()_+";
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload(p)).toBe(true);
  });
});

describe("consistencia de formato de firma", () => {
  it("la firma es hex en minúsculas de 64 caracteres", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(p.sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el payload serializable como JSON y deserializable vuelve a verificar", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    const roundtrip = JSON.parse(JSON.stringify(p)) as QrPayload;
    expect(verifyQrPayload(roundtrip)).toBe(true);
  });

  it("payload con sig vacía no verifica", () => {
    const p = signQrPayload(VEHICLE_ID, PLATE, MUNICIPALITY, TYPE_KEY);
    expect(verifyQrPayload({ ...p, sig: "" })).toBe(false);
  });
});
