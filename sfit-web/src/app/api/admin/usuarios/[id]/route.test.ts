import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/audit/logAction", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/email_service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/templates", () => ({
  accountApprovedEmailHtml: vi.fn(() => "<html/>"),
  accountRejectedEmailHtml: vi.fn(() => "<html/>"),
}));
vi.mock("@/lib/scope-server", () => ({
  getActiveMunicipalityId: vi.fn(async () => new Types.ObjectId("000000000000000000000001")),
}));
vi.mock("@/lib/auth/rbac", () => ({
  canAccessMunicipality: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireRole: vi.fn(() => ({
    session: {
      userId: "super1",
      role: "super_admin",
      municipalityId: "000000000000000000000001",
    },
  })),
}));
vi.mock("@/models/User", () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock("@/models/Company", () => ({
  Company: {
    findById: vi.fn(),
  },
}));

import { PATCH } from "./route";
import { User } from "@/models/User";

const TARGET_ID = "0000000000000000000000aa";

function patchReq(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/usuarios/${TARGET_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: TARGET_ID });

describe("PATCH /api/admin/usuarios/[id] — DNI duplicado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // findById(targetUser) — el usuario que estamos editando
    vi.mocked(User.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: TARGET_ID,
        name: "Original",
        email: "original@test.com",
        role: "ciudadano",
        status: "activo",
        municipalityId: new Types.ObjectId("000000000000000000000001"),
        dni: "11111111",
      }),
    } as never);
    // findByIdAndUpdate — devuelve el doc actualizado
    vi.mocked(User.findByIdAndUpdate).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: TARGET_ID,
        name: "Original",
        email: "original@test.com",
        role: "ciudadano",
        status: "activo",
        dni: "22222222",
        createdAt: new Date(),
      }),
    } as never);
  });

  it("DNI distinto y libre → 200 OK", async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const res = await PATCH(patchReq({ dni: "22222222" }), { params });
    expect(res.status).toBe(200);
  });

  it("DNI igual al actual → no chequea duplicado, 200 OK", async () => {
    // El findOne NO debe llamarse cuando dni no cambió
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const res = await PATCH(patchReq({ dni: "11111111" }), { params });
    expect(res.status).toBe(200);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("DNI nuevo ya tomado por otra cuenta → 409", async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "otherUserId" }),
    } as never);
    const res = await PATCH(patchReq({ dni: "99999999" }), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/DNI/i);
  });
});
