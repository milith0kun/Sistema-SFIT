import { createHmac } from "node:crypto";

export const QR_VERSION = 1;

export interface QrPayload {
  v: number;   // version
  id: string;  // vehicleId
  pl: string;  // plate
  mu: string;  // municipalityId
  ty: string;  // vehicleTypeKey
  ts: number;  // Unix timestamp (seconds)
  sig: string; // HMAC-SHA256 hex
}

function signingInput(p: Omit<QrPayload, "sig">): string {
  return `v${p.v}|${p.id}|${p.pl}|${p.mu}|${p.ty}|${p.ts}`;
}

export function signQrPayload(
  vehicleId: string,
  plate: string,
  municipalityId: string,
  vehicleTypeKey: string,
): QrPayload {
  const secret = process.env.QR_HMAC_SECRET ?? "";
  const ts = Math.floor(Date.now() / 1000);
  const partial = { v: QR_VERSION, id: vehicleId, pl: plate, mu: municipalityId, ty: vehicleTypeKey, ts };
  const sig = createHmac("sha256", secret).update(signingInput(partial)).digest("hex");
  return { ...partial, sig };
}

export function verifyQrPayload(payload: QrPayload): boolean {
  const secret = process.env.QR_HMAC_SECRET ?? "";
  const { sig, ...rest } = payload;
  const expected = createHmac("sha256", secret).update(signingInput(rest)).digest("hex");
  // timing-safe comparison
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
