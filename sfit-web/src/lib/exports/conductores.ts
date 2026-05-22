import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { isValidObjectId } from "mongoose";
import {
  buildLicenseValidityFilter,
  type LicenseValidityState,
} from "@/lib/license-validity";
import { DRIVER_STATUS } from "@/lib/constants";

function formatDateLocal(d: Date | undefined | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

const STATUS_LABELS: Record<string, string> = {
  apto: "Apto",
  riesgo: "Riesgo",
  no_apto: "No apto",
};

export interface ConductorExportFilter {
  municipalityId?: string;
  status?: string;
  validity?: LicenseValidityState | "all";
  search?: string;
  companyId?: string;
}

export async function generateConductoresExcel(
  filterParams: ConductorExportFilter,
): Promise<{ buffer: Buffer; filename: string }> {
  await connectDB();

  const filter: Record<string, unknown> = {};
  filter.active = true;

  if (filterParams.municipalityId && isValidObjectId(filterParams.municipalityId)) {
    filter.municipalityId = filterParams.municipalityId;
  }
  if (filterParams.companyId && isValidObjectId(filterParams.companyId)) {
    filter.companyId = filterParams.companyId;
  }
  if (filterParams.status && Object.values(DRIVER_STATUS).includes(filterParams.status as never)) {
    filter.status = filterParams.status;
  }
  if (
    filterParams.validity &&
    ["valid", "expiring_soon", "expired", "missing", "all"].includes(filterParams.validity)
  ) {
    Object.assign(filter, buildLicenseValidityFilter(filterParams.validity));
  }
  if (filterParams.search) {
    filter.$or = [
      { name: { $regex: filterParams.search, $options: "i" } },
      { dni: { $regex: filterParams.search, $options: "i" } },
      { licenseNumber: { $regex: filterParams.search, $options: "i" } },
    ];
  }

  const drivers = await Driver.find(filter)
    .populate("companyId", "razonSocial")
    .sort({ name: 1 })
    .lean();

  const filterParts: string[] = [];
  if (filterParams.status) {
    filterParts.push(`Estado: ${STATUS_LABELS[filterParams.status] ?? filterParams.status}`);
  } else {
    filterParts.push("Estado fatiga: Todos");
  }
  if (filterParams.validity && filterParams.validity !== "all") {
    const validityLabels: Record<string, string> = {
      valid: "Vigente",
      expiring_soon: "Por vencer",
      expired: "Vencida",
      missing: "Sin registro",
    };
    filterParts.push(`Licencia: ${validityLabels[filterParams.validity] ?? filterParams.validity}`);
  }
  if (filterParams.search) filterParts.push(`Búsqueda: ${filterParams.search}`);

  const aoa: (string | number)[][] = [];

  // Título
  aoa.push(["CATÁLOGO DE CONDUCTORES — SFIT", "", "", "", "", "", "", "", "", ""]);

  // Info de exportación
  aoa.push([
    `Exportado: ${formatDateLocal(new Date())}`,
    ...filterParts.map((p) => p),
    ...[...Array(Math.max(0, 9 - filterParts.length))].map(() => ""),
  ].slice(0, 10));

  aoa.push([]);

  // Headers
  aoa.push([
    "Nombre",
    "DNI",
    "N° Licencia",
    "Categoría",
    "Venc. Licencia",
    "Teléfono",
    "Empresa",
    "Estado fatiga",
    "Reputación",
    "Activo",
  ]);

  drivers.forEach((d) => {
    aoa.push([
      d.name ?? "",
      d.dni ?? "",
      d.licenseNumber ?? "",
      d.licenseCategory ?? "",
      formatDateLocal(d.licenseExpiryDate as Date | undefined),
      d.phone ?? "—",
      (d.companyId as { razonSocial?: string } | null)?.razonSocial ?? "—",
      STATUS_LABELS[d.status] ?? d.status ?? "—",
      d.reputationScore ?? 0,
      d.active ? "Sí" : "No",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 32 },  // Nombre
    { wch: 12 },  // DNI
    { wch: 16 },  // N° Licencia
    { wch: 12 },  // Categoría
    { wch: 14 },  // Venc. Licencia
    { wch: 14 },  // Teléfono
    { wch: 28 },  // Empresa
    { wch: 14 },  // Estado fatiga
    { wch: 10 },  // Reputación
    { wch: 8 },   // Activo
  ];

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conductores");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const ts = formatTimestamp(new Date());
  const filename = `conductores-sfit-${ts}.xlsx`;

  return { buffer, filename };
}
