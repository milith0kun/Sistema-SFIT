import { z } from "zod";

const SERVICE_SCOPE_ENUM = ["urbano", "interprovincial"] as const;

const AUTHORITY_LEVEL_ENUM = [
  "municipal_distrital",
  "municipal_provincial",
  "regional",
  "mtc",
] as const;

export const RepresentanteLegalSchema = z.object({
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  phone: z.string().max(30).optional(),
});

export const DocumentSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url(),
});

export const ServiceScopeEnum = z.enum(SERVICE_SCOPE_ENUM);

export const AuthorityLevelEnum = z.enum(AUTHORITY_LEVEL_ENUM);

export const CoverageSchema = z.object({
  departmentCodes: z.array(z.string().regex(/^\d{2}$/)).max(30).default([]),
  provinceCodes:   z.array(z.string().regex(/^\d{4}$/)).max(60).default([]),
  districtCodes:   z.array(z.string().regex(/^\d{6}$/)).max(200).default([]),
});

export const AuthorizationSchema = z
  .object({
    level: AuthorityLevelEnum,
    scope: ServiceScopeEnum,
    issuedBy: z.string().max(200).optional(),
    resolutionNumber: z.string().max(80).optional(),
    issuedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    documentUrl: z.string().url().optional(),
  })
  .refine(
    (a) => !a.issuedAt || !a.expiresAt || a.expiresAt.getTime() > a.issuedAt.getTime(),
    { message: "expiresAt debe ser posterior a issuedAt", path: ["expiresAt"] },
  );
