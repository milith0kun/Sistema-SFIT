import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Passenger } from "@/models/Passenger";
import { Driver } from "@/models/Driver";
import { Vehicle } from "@/models/Vehicle";
import { Route } from "@/models/Route";
import { Company } from "@/models/Company";

/**
 * Helper de fecha → "YYYYMMDD-HHmm" para el nombre del archivo.
 * Usa horario local del server (que en producción correrá en UTC); con eso es
 * suficiente para identificar manifiestos contiguos sin colisión.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

function formatDateLong(date: Date | undefined | null): string {
  if (!date) return "—";
  return date.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "long",
    timeStyle: "short",
  });
}

/**
 * Genera un workbook XLSX con el manifiesto de pasajeros de un viaje.
 *
 * Layout:
 *   Filas 1-2  : header con info del viaje (empresa, ruta, fecha, vehículo, conductor)
 *   Fila  3    : separador en blanco
 *   Fila  4    : header de columnas (#, DNI, Nombre, Asiento, Origen, Destino, Teléfono, Firma)
 *   Filas 5+   : una por pasajero
 *   Última + 2 : firma del conductor + sello
 */
export async function generatePassengerManifestExcel(
  tripId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  await connectDB();

  // Trip + populate. Driver no incluye companyId en su schema "ref" populate
  // directo a Company, así que lo resolvemos manualmente abajo.
  const trip = await Trip.findById(tripId)
    .populate("vehicleId", "plate brand model companyId")
    .populate("driverId", "name dni phone companyId")
    .populate("routeId", "code name")
    .lean<{
      _id: unknown;
      startTime?: Date;
      vehicleId?: { plate?: string; brand?: string; model?: string; companyId?: unknown } | null;
      driverId?: { name?: string; dni?: string; phone?: string; companyId?: unknown } | null;
      routeId?: { code?: string; name?: string } | null;
    } | null>();

  if (!trip) {
    throw new Error("Viaje no encontrado");
  }

  const driverDoc = trip.driverId ?? null;
  const vehicleDoc = trip.vehicleId ?? null;
  const routeDoc = trip.routeId ?? null;

  // Resolver empresa: prioriza companyId del vehículo, cae al del driver.
  const companyId = vehicleDoc?.companyId ?? driverDoc?.companyId ?? null;
  let companyName = "—";
  if (companyId) {
    const company = await Company.findById(companyId)
      .select("razonSocial ruc")
      .lean<{ razonSocial?: string; ruc?: string } | null>();
    if (company?.razonSocial) {
      companyName = company.ruc
        ? `${company.razonSocial} (RUC ${company.ruc})`
        : company.razonSocial;
    }
  }

  // Si el populate del vehicle/driver/route quedó null por alguna razón, los
  // resolvemos a mano (defensivo, normalmente no pasa).
  const _vehicleFallback = !vehicleDoc
    ? await Vehicle.findById((trip as { vehicleId?: unknown }).vehicleId)
        .select("plate brand model")
        .lean()
    : null;
  const _driverFallback = !driverDoc
    ? await Driver.findById((trip as { driverId?: unknown }).driverId)
        .select("name dni phone")
        .lean()
    : null;
  const _routeFallback =
    !routeDoc && (trip as { routeId?: unknown }).routeId
      ? await Route.findById((trip as { routeId?: unknown }).routeId)
          .select("code name")
          .lean()
      : null;

  const vehicle = vehicleDoc ?? _vehicleFallback;
  const driver = driverDoc ?? _driverFallback;
  const route = routeDoc ?? _routeFallback;

  const passengers = await Passenger.find({ tripId })
    .sort({ seatNumber: 1, fullName: 1 })
    .lean();

  // Construcción del AOA (array of arrays).
  const aoa: (string | number)[][] = [];

  const routeLabel = route
    ? `${(route as { code?: string }).code ?? ""} — ${(route as { name?: string }).name ?? ""}`.trim()
    : "—";
  const vehiclePlate = vehicle ? (vehicle as { plate?: string }).plate ?? "—" : "—";
  const vehicleDesc = vehicle
    ? `${(vehicle as { brand?: string }).brand ?? ""} ${(vehicle as { model?: string }).model ?? ""}`.trim()
    : "";
  const driverName = driver ? (driver as { name?: string }).name ?? "—" : "—";
  const driverDni = driver ? (driver as { dni?: string }).dni ?? "" : "";
  const driverPhone = driver ? (driver as { phone?: string }).phone ?? "" : "";

  aoa.push(["MANIFIESTO DE PASAJEROS", "", "", "", "", "", "", ""]);
  aoa.push([
    `Empresa: ${companyName}`,
    "",
    `Ruta: ${routeLabel}`,
    "",
    `Fecha: ${formatDateLong(trip.startTime)}`,
    "",
    `Vehículo: ${vehiclePlate}${vehicleDesc ? ` (${vehicleDesc})` : ""}`,
    "",
  ]);
  aoa.push([
    `Conductor: ${driverName}${driverDni ? ` — DNI ${driverDni}` : ""}${
      driverPhone ? ` — Tel. ${driverPhone}` : ""
    }`,
    "", "", "", "", "", "", "",
  ]);
  aoa.push([]); // separador

  aoa.push(["#", "Tipo", "Documento", "Nombre completo", "Asiento", "Origen", "Destino", "Teléfono", "Firma"]);

  passengers.forEach((p, idx) => {
    aoa.push([
      idx + 1,
      p.documentType ?? "DNI",
      p.documentNumber ?? "",
      p.fullName ?? "",
      p.seatNumber ?? "",
      p.origin ?? "",
      p.destination ?? "",
      p.phone ?? "",
      "",
    ]);
  });

  // Espacio + firma del conductor.
  aoa.push([]);
  aoa.push([]);
  aoa.push(["Firma del conductor:", "", "", "", "", "", "", "Sello/Visto bueno:"]);
  aoa.push(["__________________________", "", "", "", "", "", "", "__________________________"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Anchos de columna razonables.
  ws["!cols"] = [
    { wch: 5 },   // #
    { wch: 8 },   // Tipo doc
    { wch: 14 },  // Documento
    { wch: 36 },  // Nombre
    { wch: 10 },  // Asiento
    { wch: 18 },  // Origen
    { wch: 18 },  // Destino
    { wch: 14 },  // Teléfono
    { wch: 22 },  // Firma
  ];

  // Merge para el título principal (fila 1, columnas A:I).
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Manifiesto");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeRouteCode =
    (route as { code?: string } | null)?.code?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "ruta";
  const ts = formatTimestamp(trip.startTime ?? new Date());
  const filename = `manifiesto-${safeRouteCode}-${ts}.xlsx`;

  return { buffer, filename };
}
