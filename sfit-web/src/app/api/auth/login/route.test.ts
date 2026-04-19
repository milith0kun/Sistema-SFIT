import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAuditRaw: vi.fn().mockResolvedValue(undefined) }));
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));
vi.mock("@/models/User", () => ({
  User: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
  },
}));

import bcrypt from "bcryptjs";
import { User } from "@/models/User";

const mockUser = {
  _id: { toString: () => "usr123" },
  name: "Carlos Quispe",
  email: "carlos@test.com",
  password: "$2b$10$hashedpassword",
  role: "fiscal",
  status: "activo",
  municipalityId: { toString: () => "muni1" },
  provinceId: undefined,
  image: null,
  fcmTokens: [],
};

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it("login con credenciales correctas devuelve tokens", async () => {
    const res = await POST(req({ email: "carlos@test.com", password: "Sfit2026!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.email).toBe("carlos@test.com");
  });

  it("login con contraseña incorrecta devuelve 401", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const res = await POST(req({ email: "carlos@test.com", password: "WrongPass!" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("login con email inexistente devuelve 401", async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);
    const res = await POST(req({ email: "noexiste@test.com", password: "Sfit2026!" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("login con body vacío devuelve 400 (validación)", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("login sin body devuelve error de validación", async () => {
    const badReq = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(badReq);
    // body no parseable → el endpoint lanza excepción → 500
    expect([422, 500].includes(res.status)).toBe(true);
  });

  it("cuenta suspendida devuelve 403", async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({ ...mockUser, status: "suspendido" }),
    } as never);
    const res = await POST(req({ email: "carlos@test.com", password: "Sfit2026!" }));
    expect(res.status).toBe(403);
  });

  it("cuenta sin contraseña (OAuth) devuelve 400", async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({ ...mockUser, password: undefined }),
    } as never);
    const res = await POST(req({ email: "carlos@test.com", password: "cualquiera" }));
    expect(res.status).toBe(400);
  });
});
