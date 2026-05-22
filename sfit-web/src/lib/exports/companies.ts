import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import { isValidObjectId } from "mongoose";
import type { JwtPayload } from "@/lib/auth/jwt";

function formatDateLocal(d: Date | undefined | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

const SCOPE_LABELS: Record<string, string> = {
  urbano: "Urbano",
  interprovincial: "Interprovincial",
  transporte_urbano: "Urbano",
  transporte_interprovincial: "Interprovincial",
};

const AUTHORITY_LABELS: Record<string, string> = {
  municipal_distrital: "Muni. distrital",
  municipal_provincial: "Muni. provincial",
  regional: "Gobierno regional",
  mtc: "MTC",
};

export interface CompanyExportFilter {
  municipalityId?: string;
  active?: boolean | "all";
  vehicleTypeKey?: string;
  search?: string;
}

export async function generateCompaniesExcel(
  filterParams: CompanyExportFilter,
  _session: JwtPayload,
): Promise<{ buffer: Buffer; filename: string }> {
  await connectDB();

  const filter: Record<string, unknown> = {};

  if (filterParams.municipalityId && isValidObjectId(filterParams.municipalityId)) {
    filter.municipalityId = filterParams.municipalityId;
  }
  if (filterParams.active === true) filter.active = true;
  else if (filterParams.active === false) filter.active = false;
  if (filterParams.vehicleTypeKey) {
    filter.vehicleTypeKeys = filterParams.vehicleTypeKey;
  }
  if (filterParams.search) {
    filter.$or = [
      { razonSocial: { $regex: filterParams.search, $options: "i" } },
      { ruc: { $regex: filterParams.search, $options: "i" } },
      { "representanteLegal.name": { $regex: filterParams.search, $options: "i" } },
    ];
  }

  const companies = await Company.find(filter)
    .sort({ razonSocial: 1 })
    .lean();

  const filterParts: string[] = [];
  if (filterParams.vehicleTypeKey) {
    filterParts.push(`Tipo: ${SCOPE_LABELS[filterParams.vehicleTypeKey] ?? filterParams.vehicleTypeKey}`);
  } else {
    filterParts.push("Tipo: Todos");
  }
  if (filterParams.active === true) filterParts.push("Estado: Activas");
  else if (filterParams.active === false) filterParts.push("Estado: Inactivas");
  else filterParts.push("Estado: Todas");
  if (filterParams.search) filterParts.push(`Búsqueda: ${filterParams.search}`);

  const aoa: (string | number)[][] = [];

  // Título
  aoa.push(["CATÁLOGO DE EMPRESAS — SFIT", "", "", "", "", "", "", "", "", ""]);

  // Info de exportación
  aoa.push([
    `Exportado: ${formatDateLocal(new Date())}`,
    ...filterParts.map((p) => p),
    ...[...Array(Math.max(0, 8 - filterParts.length))].map(() => ""),
  ].slice(0, 10));

  aoa.push([]);

  // Headers
  aoa.push([
    "Razón Social",
    "RUC",
    "Representante Legal",
    "DNI",
    "Teléfono",
    "Modalidad",
    "Autorizaciones",
    "Reputación",
    "Registrada",
    "Estado",
  ]);

  companies.forEach((c) => {
    const status = !c.active
      ? "Suspendida"
      : !c.approvedAt
        ? "Pendiente"
        : "Activa";

    const authSummary = (c.authorizations as Array<{ level: string; expiresAt?: Date }> ?? [])
      .map((a) => {
        const label = AUTHORITY_LABELS[a.level] ?? a.level;
        if (a.expiresAt) {
          const d = new Date(a.expiresAt);
          const vencida = d < new Date();
          return `${label}${vencida ? " (VENCIDA)" : ""} — ${formatDateLocal(d)}`;
        }
        return label;
      })
      .join(" | ") || "Sin autorizaciones";

    aoa.push([
      c.razonSocial ?? "",
      c.ruc ?? "",
      c.representanteLegal?.name ?? "—",
      c.representanteLegal?.dni ?? "—",
      c.representanteLegal?.phone ?? "—",
      SCOPE_LABELS[c.serviceScope ?? ""] ?? c.serviceScope ?? "—",
      authSummary,
      c.reputationScore ?? 0,
      formatDateLocal(c.createdAt as Date | undefined),
      status,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 32 },  // Razón Social
    { wch: 14 },  // RUC
    { wch: 28 },  // Representante Legal
    { wch: 12 },  // DNI
    { wch: 14 },  // Teléfono
    { wch: 18 },  // Modalidad
    { wch: 40 },  // Autorizaciones
    { wch: 10 },  // Reputación
    { wch: 12 },  // Registrada
    { wch: 14 },  // Estado
  ];

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Empresas");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const ts = formatTimestamp(new Date());
  const filename = `empresas-sfit-${ts}.xlsx`;

  return { buffer, filename };
}
