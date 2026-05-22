import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
import { isValidObjectId } from "mongoose";
import { VEHICLE_STATUS } from "@/lib/constants";
import { computeDocStatus } from "@/lib/vehicle-status";
import type { JwtPayload } from "@/lib/auth/jwt";

function formatDateLocal(d: Date | undefined | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

const TYPE_LABELS: Record<string, string> = {
  transporte_urbano: "Transporte urbano",
  transporte_interprovincial: "Transporte interprovincial",
};

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  en_ruta: "En ruta",
  en_mantenimiento: "Mantenimiento",
  fuera_de_servicio: "Fuera de servicio",
};

const INSPECTION_LABELS: Record<string, string> = {
  aprobada: "Aprobada",
  observada: "Observada",
  rechazada: "Rechazada",
  pendiente: "Pendiente",
};

export interface VehicleExportFilter {
  municipalityId?: string;
  companyId?: string;
  status?: string;
  vehicleTypeKey?: string;
  verified?: boolean | "all";
  search?: string;
  incluirInactivos?: boolean;
}

export async function generateVehiclesExcel(
  filterParams: VehicleExportFilter,
  session: JwtPayload,
): Promise<{ buffer: Buffer; filename: string }> {
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (!filterParams.incluirInactivos) filter.active = true;

  if (filterParams.municipalityId && isValidObjectId(filterParams.municipalityId)) {
    filter.municipalityId = filterParams.municipalityId;
  }
  if (filterParams.companyId && isValidObjectId(filterParams.companyId)) {
    filter.companyId = filterParams.companyId;
  }
  if (filterParams.status && Object.values(VEHICLE_STATUS).includes(filterParams.status as never)) {
    filter.status = filterParams.status;
  }
  if (filterParams.vehicleTypeKey) {
    filter.vehicleTypeKey = filterParams.vehicleTypeKey;
  }
  if (filterParams.verified === true) {
    filter.verified = true;
  } else if (filterParams.verified === false) {
    filter.verified = { $ne: true };
  }
  if (filterParams.search) {
    filter.$or = [
      { plate: { $regex: filterParams.search, $options: "i" } },
      { brand: { $regex: filterParams.search, $options: "i" } },
      { model: { $regex: filterParams.search, $options: "i" } },
    ];
  }

  const vehicles = await Vehicle.find(filter)
    .populate("companyId", "razonSocial")
    .populate("currentDriverId", "name")
    .sort({ plate: 1 })
    .lean();

  // Construir descripción de filtros aplicados
  const filterParts: string[] = [];
  if (filterParams.vehicleTypeKey) {
    filterParts.push(`Tipo: ${TYPE_LABELS[filterParams.vehicleTypeKey] ?? filterParams.vehicleTypeKey}`);
  } else {
    filterParts.push("Tipo: Todos");
  }
  if (filterParams.verified === true) filterParts.push("Verificación: Verificados");
  else if (filterParams.verified === false) filterParts.push("Verificación: Sin verificar");
  else filterParts.push("Verificación: Todas");
  if (filterParams.companyId) {
    const company = await Company.findById(filterParams.companyId).select("razonSocial").lean<{ razonSocial?: string } | null>();
    if (company?.razonSocial) filterParts.push(`Empresa: ${company.razonSocial}`);
  }
  if (filterParams.search) filterParts.push(`Búsqueda: ${filterParams.search}`);

  const aoa: (string | number)[][] = [];

  // Título
  aoa.push(["CATÁLOGO DE VEHÍCULOS — SFIT", "", "", "", "", "", "", "", "", "", "", ""]);

  // Info de exportación
  aoa.push([
    `Exportado: ${formatDateLocal(new Date())}`,
    ...filterParts.map((p) => p),
    ...[...Array(Math.max(0, 10 - filterParts.length))].map(() => ""),
  ].slice(0, 12));

  aoa.push([]); // separador

  // Headers
  aoa.push([
    "Placa",
    "Tipo de Servicio",
    "Marca",
    "Modelo",
    "Año",
    "Empresa",
    "Conductor",
    "Estado",
    "SOAT Vencimiento",
    "CITV",
    "Última Inspección",
    "Reputación",
    "Verificado",
  ]);

  vehicles.forEach((v) => {
    const companyName = (v.companyId as { razonSocial?: string } | null)?.razonSocial ?? "—";
    const driverName = (v.currentDriverId as { name?: string } | null)?.name ?? "—";

    aoa.push([
      v.plate ?? "",
      TYPE_LABELS[v.vehicleTypeKey] ?? v.vehicleTypeKey ?? "",
      v.brand ?? "",
      v.model ?? "",
      v.year ?? "",
      companyName,
      driverName,
      STATUS_LABELS[v.status] ?? v.status ?? "",
      v.soatExpiry ? (() => {
        const status = computeDocStatus(v.soatExpiry as Date | null);
        const date = formatDateLocal(v.soatExpiry as unknown as Date);
        const labels: Record<string, string> = { vigente: "Vigente", por_vencer: "Por vencer", vencido: "Vencido" };
        return `${labels[status] ?? status} — ${date}`;
      })() : "Sin registro",
      (() => {
        const status = computeDocStatus(v.citvExpiryDate as Date | null, v.year);
        if (status === "exento") return `Exento (hasta ${(v.year ?? 0) + 3})`;
        if (status === "sin_registro") return "Sin registro";
        const date = v.citvExpiryDate ? formatDateLocal(v.citvExpiryDate as unknown as Date) : "—";
        const labels: Record<string, string> = { vigente: "Vigente", por_vencer: "Por vencer", vencido: "Vencido" };
        return `${labels[status] ?? status} — ${date}`;
      })(),
      INSPECTION_LABELS[v.lastInspectionStatus ?? ""] ?? v.lastInspectionStatus ?? "—",
      v.reputationScore ?? 0,
      v.verified ? "Sí" : "No",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Anchos de columna
  ws["!cols"] = [
    { wch: 10 },  // Placa
    { wch: 22 },  // Tipo de Servicio
    { wch: 16 },  // Marca
    { wch: 18 },  // Modelo
    { wch: 6 },   // Año
    { wch: 28 },  // Empresa
    { wch: 24 },  // Conductor
    { wch: 14 },  // Estado
    { wch: 16 },  // SOAT
    { wch: 16 },  // CITV
    { wch: 14 },  // Inspección
    { wch: 10 },  // Reputación
    { wch: 10 },  // Verificado
  ];

  // Merge para título
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vehículos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const ts = formatTimestamp(new Date());
  const filename = `vehiculos-sfit-${ts}.xlsx`;

  return { buffer, filename };
}
