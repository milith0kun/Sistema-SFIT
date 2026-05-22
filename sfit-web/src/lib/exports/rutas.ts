import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { isValidObjectId } from "mongoose";

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
};

const TYPE_LABELS: Record<string, string> = {
  ruta: "Ruta fija",
  zona: "Zona de operación",
};

const STATUS_LABELS: Record<string, string> = {
  activa: "Activa",
  suspendida: "Suspendida",
};

export interface RutaExportFilter {
  municipalityId?: string;
  type?: string;
  status?: string;
  departmentCode?: string;
  companyId?: string;
}

export async function generateRutasExcel(
  filterParams: RutaExportFilter,
): Promise<{ buffer: Buffer; filename: string }> {
  await connectDB();

  const filter: Record<string, unknown> = {};

  if (filterParams.municipalityId && isValidObjectId(filterParams.municipalityId)) {
    filter.municipalityId = filterParams.municipalityId;
  }
  if (filterParams.type === "ruta" || filterParams.type === "zona") {
    filter.type = filterParams.type;
  }
  if (filterParams.status === "activa" || filterParams.status === "suspendida") {
    filter.status = filterParams.status;
  }
  if (filterParams.departmentCode && /^\d{2}$/.test(filterParams.departmentCode)) {
    const prefix = `^${filterParams.departmentCode}`;
    filter.$or = [
      { originDistrictCode: { $regex: prefix } },
      { traversedDistrictCodes: { $regex: prefix } },
      { "waypoints.districtCode": { $regex: prefix } },
    ];
  }
  if (filterParams.companyId && isValidObjectId(filterParams.companyId)) {
    filter.companyId = filterParams.companyId;
  }

  const routes = await Route.find(filter)
    .populate("companyId", "razonSocial")
    .sort({ code: 1 })
    .lean();

  const filterParts: string[] = [];
  if (filterParams.type) {
    filterParts.push(`Tipo: ${TYPE_LABELS[filterParams.type] ?? filterParams.type}`);
  }
  if (filterParams.status) {
    filterParts.push(`Estado: ${STATUS_LABELS[filterParams.status] ?? filterParams.status}`);
  }

  const aoa: (string | number)[][] = [];

  aoa.push(["CATÁLOGO DE RUTAS — SFIT", "", "", "", "", "", "", "", "", "", ""]);

  aoa.push([
    `Exportado: ${formatDateLocal(new Date())}`,
    ...filterParts.map((p) => p),
    ...[...Array(Math.max(0, 9 - filterParts.length))].map(() => ""),
  ].slice(0, 11));

  aoa.push([]);

  aoa.push([
    "Código",
    "Nombre",
    "Tipo",
    "Modalidad",
    "Empresa",
    "Tipo vehículo",
    "Paradas",
    "Longitud",
    "Vehículos",
    "Estado",
    "Registrado",
  ]);

  routes.forEach((r) => {
    const companyName = (r.companyId as { razonSocial?: string } | null)?.razonSocial ?? "—";
    aoa.push([
      r.code ?? "",
      r.name ?? "",
      TYPE_LABELS[r.type] ?? r.type ?? "—",
      SCOPE_LABELS[r.serviceScope] ?? r.serviceScope ?? "—",
      companyName,
      r.vehicleTypeKey ?? "—",
      r.stops ?? 0,
      r.length ?? "—",
      r.vehicleCount ?? 0,
      STATUS_LABELS[r.status] ?? r.status ?? "—",
      formatDateLocal(r.createdAt as Date | undefined),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 10 },  // Código
    { wch: 36 },  // Nombre
    { wch: 14 },  // Tipo
    { wch: 18 },  // Modalidad
    { wch: 28 },  // Empresa
    { wch: 16 },  // Tipo vehículo
    { wch: 10 },  // Paradas
    { wch: 10 },  // Longitud
    { wch: 10 },  // Vehículos
    { wch: 14 },  // Estado
    { wch: 12 },  // Registrado
  ];

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rutas");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const ts = formatTimestamp(new Date());
  const filename = `rutas-sfit-${ts}.xlsx`;

  return { buffer, filename };
}
