"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car, Route, Wrench, X, Users, Download, Plus, Filter, AlertTriangle, Check,
  Calendar, Loader2, Inbox,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type FleetStatus =
  | "disponible" | "en_ruta" | "cerrado"
  | "auto_cierre" | "mantenimiento" | "fuera_de_servicio";

type FleetEntry = {
  id: string;
  vehicle: { plate: string; brand: string; model: string; vehicleTypeKey: string };
  route?: { code: string; name: string } | null;
  driver: { name: string; status: string; continuousHours: number; restHours: number };
  departureTime?: string;
  returnTime?: string;
  km: number;
  status: FleetStatus;
  observations?: string;
  checklistComplete: boolean;
  date: string;
};

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BD = "#86EFAC"; const APTO_BG = "#F0FDF4";
const INFO = "#1E40AF"; const INFO_BD = "#BFDBFE";
const RIESGO = "#B45309"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const STATUS_META: Record<FleetStatus | "apto" | "riesgo" | "no_apto", { color: string; bd: string; label: string }> = {
  disponible:        { color: APTO,   bd: APTO_BD,   label: "DISPONIBLE" },
  en_ruta:           { color: INFO,   bd: INFO_BD,   label: "EN RUTA" },
  cerrado:           { color: INK6,   bd: INK2,      label: "CERRADO" },
  auto_cierre:       { color: RIESGO, bd: RIESGO_BD, label: "AUTO-CIERRE" },
  mantenimiento:     { color: RIESGO, bd: RIESGO_BD, label: "MANTENIMIENTO" },
  fuera_de_servicio: { color: NO,     bd: NO_BD,     label: "FUERA DE SERVICIO" },
  apto:              { color: APTO,   bd: APTO_BD,   label: "APTO" },
  riesgo:            { color: RIESGO, bd: RIESGO_BD, label: "RIESGO" },
  no_apto:           { color: NO,     bd: NO_BD,     label: "NO APTO" },
};

function StatusBadge({ s }: { s: string }) {
  const m = STATUS_META[s as keyof typeof STATUS_META] ?? { color: INK6, bd: INK2, label: s.toUpperCase() };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999,
      background: "#fff", color: m.color, border: `1px solid ${m.bd}`,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {m.label}
    </span>
  );
}

const CHECKLIST_ITEMS = [
  { t: "Luces, intermitentes y frenos", critical: true },
  { t: "Documentos del vehículo (tarjeta, SOAT, revisión técnica)", critical: true },
  { t: "Cinturones de seguridad operativos", critical: true },
  { t: "Neumáticos y presión reglamentaria", critical: false },
  { t: "Extintor vigente", critical: false },
  { t: "Limpieza interior y exterior", critical: false },
];

const ALL_FLEET_STATUSES: { key: FleetStatus; label: string }[] = [
  { key: "disponible", label: "Disponible" },
  { key: "en_ruta", label: "En ruta" },
  { key: "mantenimiento", label: "Mantenimiento" },
  { key: "fuera_de_servicio", label: "Fuera de servicio" },
  { key: "cerrado", label: "Cerrado" },
  { key: "auto_cierre", label: "Auto-cierre" },
];

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function FlotaPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<FleetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => todayISO());

  // Modal salida
  const [showChecklist, setShowChecklist] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: false, 3: false, 4: false, 5: false,
  });
  const [exitForm, setExitForm] = useState({ vehicleId: "", driverId: "", observations: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalVehicles, setModalVehicles] = useState<{ id: string; plate: string; brand: string; model: string }[]>([]);
  const [modalDrivers, setModalDrivers] = useState<{ id: string; name: string; status: string }[]>([]);
  const [modalDataLoading, setModalDataLoading] = useState(false);

  // Filtros
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FleetStatus[]>([]);
  const [filterRoute, setFilterRoute] = useState("");
  const [filterDriver, setFilterDriver] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const loadModalData = useCallback(async () => {
    setModalDataLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const h = { Authorization: `Bearer ${token ?? ""}` };
      const [vRes, dRes] = await Promise.all([
        fetch("/api/vehiculos?limit=100&status=disponible", { headers: h }),
        fetch("/api/conductores?limit=100&status=apto", { headers: h }),
      ]);
      const [vData, dData] = await Promise.all([vRes.json(), dRes.json()]);
      if (vRes.ok && vData.success) setModalVehicles(vData.data.items ?? []);
      if (dRes.ok && dData.success) setModalDrivers(dData.data.items ?? []);
    } catch { /* silencioso */ }
    finally { setModalDataLoading(false); }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      const res = await fetch(`/api/flota?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al cargar flota"); return;
      }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, date, router]);

  useEffect(() => { void load(); }, [load]);

  const enRuta = items.filter(i => i.status === "en_ruta").length;
  const disponible = items.filter(i => i.status === "disponible").length;
  const mant = items.filter(i => i.status === "mantenimiento").length;
  const fueraServ = items.filter(i => i.status === "fuera_de_servicio").length;

  const filteredItems = useMemo(() => items.filter(i => {
    if (filterStatus.length > 0 && !filterStatus.includes(i.status)) return false;
    if (filterRoute && !`${i.route?.code ?? ""} ${i.route?.name ?? ""}`.toLowerCase().includes(filterRoute.toLowerCase())) return false;
    if (filterDriver && !(i.driver?.name ?? "").toLowerCase().includes(filterDriver.toLowerCase())) return false;
    return true;
  }), [items, filterStatus, filterRoute, filterDriver]);

  const activeFilters = filterStatus.length + (filterRoute ? 1 : 0) + (filterDriver ? 1 : 0);
  const clearFilters = () => { setFilterStatus([]); setFilterRoute(""); setFilterDriver(""); };
  const toggleStatus = (s: FleetStatus) => setFilterStatus(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  );

  const allCritOk = [0, 1, 2].every(i => checked[i]);
  const drivers = items
    .filter(i => i.driver)
    .map(i => i.driver)
    .filter((d, idx, arr) => arr.findIndex(x => x.name === d.name) === idx);
  const aptosCount = drivers.filter(d => d.status === "apto").length;

  const handleConfirmExit = useCallback(async () => {
    if (!allCritOk) return;
    if (!exitForm.vehicleId.trim()) { setSubmitError("Seleccione un vehículo."); return; }
    if (!exitForm.driverId.trim()) { setSubmitError("Seleccione un conductor."); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/flota", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          vehicleId: exitForm.vehicleId.trim(),
          driverId: exitForm.driverId.trim() || undefined,
          departureTime: new Date().toISOString(),
          checklistComplete: true,
          observations: exitForm.observations.trim() || undefined,
          status: "en_ruta",
        }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? "Error al registrar la salida."); return;
      }
      setShowChecklist(false);
      setChecked({ 0: true, 1: true, 2: false, 3: false, 4: false, 5: false });
      setExitForm({ vehicleId: "", driverId: "", observations: "" });
      void load();
    } catch { setSubmitError("Error de conexión al registrar la salida."); }
    finally { setSubmitting(false); }
  }, [allCritOk, exitForm, router, load]);

  const columns = useMemo<ColumnDef<FleetEntry, unknown>[]>(() => [
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (row) => `${row.vehicle?.plate ?? ""} ${row.vehicle?.brand ?? ""} ${row.vehicle?.model ?? ""}`,
      cell: ({ row: r }) => (
        <div>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 9px", borderRadius: 5,
            background: INK9, color: "#fff",
            fontFamily: "ui-monospace, monospace", fontWeight: 700,
            fontSize: "0.75rem", letterSpacing: "0.04em",
          }}>
            {r.original.vehicle?.plate ?? "—"}
          </span>
          <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 3 }}>
            {r.original.vehicle?.brand ?? ""} {r.original.vehicle?.model ?? ""}
          </div>
        </div>
      ),
    },
    {
      id: "ruta",
      header: "Ruta / Zona",
      accessorFn: (row) => row.route ? `${row.route.code} ${row.route.name}` : "",
      cell: ({ row: r }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
            {r.original.route
              ? `${r.original.route.code} · ${r.original.route.name}`
              : <span style={{ color: INK5, fontWeight: 500 }}>Sin asignar</span>}
          </div>
          {r.original.observations && (
            <div style={{ fontSize: "0.75rem", color: RIESGO, marginTop: 2 }}>
              {r.original.observations}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "conductor",
      header: "Conductor",
      accessorFn: (row) => row.driver?.name ?? "",
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9 }}>
          {(getValue() as string)?.trim() || <span style={{ color: INK5 }}>Sin conductor</span>}
        </span>
      ),
    },
    {
      id: "salida",
      header: "Salida",
      accessorFn: (row) => row.departureTime ?? "",
      sortingFn: "datetime",
      cell: ({ row: r }) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: "0.8125rem", color: INK9 }}>
          {r.original.departureTime?.trim() || "—"}
        </span>
      ),
    },
    {
      id: "retorno",
      header: "Retorno",
      accessorFn: (row) => row.returnTime ?? "",
      sortingFn: "datetime",
      cell: ({ row: r }) => (
        <span style={{
          fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: "0.8125rem",
          color: r.original.returnTime?.trim() ? INK9 : INK5,
        }}>
          {r.original.returnTime?.trim() || "—"}
        </span>
      ),
    },
    {
      id: "km",
      header: "Km",
      accessorFn: (row) => row.km ?? 0,
      cell: ({ getValue }) => (
        <span style={{ fontVariantNumeric: "tabular-nums", color: INK9 }}>
          {(getValue() as number) ?? 0}
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row: r }) => <StatusBadge s={r.original.status} />,
    },
  ], []);

  if (!user) return null;

  const canRegister = user.role === "operador" || user.role === "super_admin" || user.role === "admin_municipal";
  const isToday = date === todayISO();

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Operación · RF-07"
        title="Flota del día"
        pills={[
          { label: "Total hoy", value: items.length },
          { label: "En ruta", value: enRuta },
          { label: "Disponibles", value: disponible },
          { label: "Mantenimiento", value: mant + fueraServ, warn: (mant + fueraServ) > 0 },
        ]}
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
              borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
              fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Download size={13} />Reporte diario
            </button>
            {canRegister && (
              <button
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                  borderRadius: 7, border: "none",
                  background: "#fff", color: INK9,
                  fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
                onClick={() => { setShowChecklist(true); void loadModalData(); }}
              >
                <Plus size={13} />Registrar salida
              </button>
            )}
          </div>
        }
      />

      <KPIStrip cols={5} items={[
        { label: "DISPONIBLES", value: loading ? "—" : disponible, subtitle: "listos para salir", icon: Car, accent: APTO },
        { label: "EN RUTA", value: loading ? "—" : enRuta, subtitle: "en circulación", icon: Route, accent: INFO },
        { label: "MANTENIMIENTO", value: loading ? "—" : mant, subtitle: "en taller", icon: Wrench, accent: RIESGO },
        { label: "FUERA SERVICIO", value: loading ? "—" : fueraServ, subtitle: "deshabilitados", icon: X, accent: NO },
        { label: "CONDUCTORES APTOS", value: loading ? "—" : aptosCount, subtitle: "operativos hoy", icon: Users, accent: APTO },
      ]} />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      {/* Toolbar de fecha */}
      <div style={{
        background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5,
        }}>
          <Calendar size={12} />Fecha
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          max={todayISO()}
          style={{
            height: 30, padding: "0 10px", borderRadius: 6,
            border: `1px solid ${INK2}`, fontSize: "0.8125rem",
            color: INK9, fontFamily: "inherit", outline: "none",
          }}
        />
        {!isToday && (
          <button
            onClick={() => setDate(todayISO())}
            style={{
              height: 30, padding: "0 10px", borderRadius: 6,
              border: `1px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Volver a hoy
          </button>
        )}
        <span style={{
          marginLeft: "auto", fontSize: "0.75rem", color: INK5,
          fontVariantNumeric: "tabular-nums",
        }}>
          {filteredItems.length} de {items.length} registros
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          {showFilterPanel && (
            <div style={{
              background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
              padding: "12px 14px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5 }}>
                  Filtros
                </span>
                {activeFilters > 0 && (
                  <button onClick={clearFilters} style={{
                    fontSize: "0.75rem", fontWeight: 600, color: INK6,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}>
                    Limpiar todo
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{
                  fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: INK5, marginBottom: 6,
                }}>Estado</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ALL_FLEET_STATUSES.map(s => {
                    const active = filterStatus.includes(s.key);
                    return (
                      <button key={s.key} onClick={() => toggleStatus(s.key)}
                        style={{
                          padding: "4px 10px", borderRadius: 6,
                          fontSize: "0.75rem", fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
                          background: active ? INK9 : "#fff",
                          color: active ? "#fff" : INK6,
                          border: `1px solid ${active ? INK9 : INK2}`,
                        }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Filtrar por ruta…"
                  value={filterRoute}
                  onChange={e => setFilterRoute(e.target.value)}
                  style={{
                    height: 32, padding: "0 10px", border: `1px solid ${INK2}`,
                    borderRadius: 6, fontSize: "0.8125rem", fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box", color: INK9,
                  }}
                />
                <input
                  type="text"
                  placeholder="Filtrar por conductor…"
                  value={filterDriver}
                  onChange={e => setFilterDriver(e.target.value)}
                  style={{
                    height: 32, padding: "0 10px", border: `1px solid ${INK2}`,
                    borderRadius: 6, fontSize: "0.8125rem", fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box", color: INK9,
                  }}
                />
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={filteredItems}
            loading={loading}
            searchPlaceholder="Buscar por placa, conductor, ruta…"
            emptyTitle={isToday ? "Sin registros para hoy" : "Sin registros para esta fecha"}
            emptyDescription={isToday
              ? "No se encontraron salidas registradas. Cambia la fecha o registra una nueva salida."
              : "No hay flota registrada en la fecha seleccionada."
            }
            toolbarEnd={
              <button
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 6,
                  fontSize: "0.8125rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  background: showFilterPanel || activeFilters > 0 ? INK9 : "#fff",
                  color: showFilterPanel || activeFilters > 0 ? "#fff" : INK6,
                  border: `1px solid ${showFilterPanel || activeFilters > 0 ? INK9 : INK2}`,
                  transition: "all .15s",
                }}
                onClick={() => setShowFilterPanel(v => !v)}
              >
                <Filter size={13} />Filtrar
                {activeFilters > 0 && (
                  <span style={{
                    background: "rgba(255,255,255,0.2)", color: "#fff",
                    borderRadius: 999, padding: "0 6px",
                    fontSize: "0.625rem", fontWeight: 700, lineHeight: "16px",
                  }}>
                    {activeFilters}
                  </span>
                )}
              </button>
            }
          />
        </div>

        {/* Panel derecho — Conductores en turno */}
        <div style={{
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
          position: "sticky", top: 16, overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${INK2}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
              Conductores en turno
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
              Estado FatigueEngine
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            {drivers.length === 0 ? (
              <div style={{
                padding: "24px 12px", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: INK1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Inbox size={16} color={INK5} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: "0.8125rem", color: INK5 }}>Sin conductores</div>
              </div>
            ) : drivers.map((d, i) => {
              const ini = (d.name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 6px",
                  borderBottom: i < drivers.length - 1 ? `1px solid ${INK1}` : "none",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: INK1, color: INK6, border: `1px solid ${INK2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.75rem", flexShrink: 0,
                  }}>{ini}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.8125rem", fontWeight: 600, color: INK9,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{d.name}</div>
                    <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 1 }}>
                      Desc. {d.restHours ?? 0}h
                    </div>
                  </div>
                  <StatusBadge s={d.status ?? "apto"} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Checklist modal */}
      {showChecklist && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,9,11,0.55)",
          zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={() => { if (!submitting) setShowChecklist(false); }}>
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
            width: 540, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderBottom: `1px solid ${INK2}`,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>
                  Checklist de pre-salida
                </div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                  Verificación obligatoria antes del despacho
                </div>
              </div>
              <button style={{
                width: 28, height: 28, borderRadius: 7,
                border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontFamily: "inherit",
              }} onClick={() => setShowChecklist(false)} disabled={submitting}>
                <X size={13} />
              </button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: INK5, marginBottom: 8,
                }}>Datos de la salida</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>
                      Vehículo <span style={{ color: NO }}>*</span>
                    </label>
                    <select
                      value={exitForm.vehicleId}
                      onChange={e => setExitForm(f => ({ ...f, vehicleId: e.target.value }))}
                      style={{
                        width: "100%", height: 36, padding: "0 10px",
                        border: `1px solid ${INK2}`, borderRadius: 7,
                        fontSize: "0.875rem", fontFamily: "inherit",
                        outline: "none", boxSizing: "border-box",
                        background: "#fff", color: INK9, cursor: "pointer",
                      }}
                    >
                      <option value="">— Seleccionar vehículo —</option>
                      {modalDataLoading
                        ? <option disabled>Cargando…</option>
                        : modalVehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>
                        ))
                      }
                    </select>
                  </div>
                  {user?.role !== "conductor" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>
                        Conductor <span style={{ color: NO }}>*</span>
                      </label>
                      <select
                        value={exitForm.driverId}
                        onChange={e => setExitForm(f => ({ ...f, driverId: e.target.value }))}
                        style={{
                          width: "100%", height: 36, padding: "0 10px",
                          border: `1px solid ${INK2}`, borderRadius: 7,
                          fontSize: "0.875rem", fontFamily: "inherit",
                          outline: "none", boxSizing: "border-box",
                          background: "#fff", color: INK9, cursor: "pointer",
                        }}
                      >
                        <option value="">— Seleccionar conductor —</option>
                        {modalDataLoading
                          ? <option disabled>Cargando…</option>
                          : modalDrivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>
                      Observaciones
                    </label>
                    <input
                      type="text" placeholder="Opcional"
                      value={exitForm.observations}
                      onChange={e => setExitForm(f => ({ ...f, observations: e.target.value }))}
                      style={{
                        width: "100%", height: 36, padding: "0 12px",
                        border: `1px solid ${INK2}`, borderRadius: 7,
                        fontSize: "0.875rem", fontFamily: "inherit",
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5, marginBottom: 8,
              }}>Verificación pre-salida</div>
              {CHECKLIST_ITEMS.map((c, i) => (
                <div key={i} onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${checked[i] ? APTO_BD : c.critical && !checked[i] ? NO_BD : INK2}`,
                    borderRadius: 8, marginBottom: 6, cursor: "pointer",
                    background: checked[i] ? APTO_BG : "#fff",
                    transition: "all .12s",
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5,
                    border: `1.5px solid ${checked[i] ? APTO : c.critical ? NO : INK2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    background: checked[i] ? APTO : "transparent", color: "#fff",
                  }}>
                    {checked[i] && <Check size={12} />}
                  </div>
                  <div style={{
                    flex: 1, fontSize: "0.8125rem", fontWeight: 500,
                    color: checked[i] ? INK6 : INK9,
                  }}>{c.t}</div>
                  {c.critical && !checked[i] && (
                    <span style={{
                      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                      background: NO_BG, color: NO,
                    }}>Crítico</span>
                  )}
                </div>
              ))}

              {!allCritOk && (
                <div role="alert" style={{
                  marginTop: 10, padding: 10,
                  background: NO_BG, border: `1px solid ${NO_BD}`,
                  borderRadius: 8, fontSize: "0.75rem", color: NO,
                  display: "flex", gap: 8,
                }}>
                  <AlertTriangle size={14} />
                  <div><strong>Bloqueado:</strong> marca los 3 puntos críticos antes de registrar la salida.</div>
                </div>
              )}
              {submitError && (
                <div role="alert" style={{
                  marginTop: 8, padding: 10,
                  background: NO_BG, border: `1px solid ${NO_BD}`,
                  borderRadius: 8, fontSize: "0.75rem", color: NO,
                  display: "flex", gap: 8,
                }}>
                  <AlertTriangle size={14} /><div>{submitError}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <button
                  style={{
                    flex: 1, height: 36, padding: "0 14px", borderRadius: 7,
                    border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                    fontSize: "0.875rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                  onClick={() => setShowChecklist(false)} disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  style={{
                    flex: 1, height: 36, padding: "0 14px", borderRadius: 7,
                    border: "none", background: INK9, color: "#fff",
                    fontSize: "0.875rem", fontWeight: 700,
                    cursor: allCritOk && !submitting ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                    opacity: allCritOk && !submitting ? 1 : 0.45,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                  disabled={!allCritOk || submitting}
                  onClick={() => void handleConfirmExit()}
                >
                  {submitting && <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />}
                  {submitting ? "Registrando…" : "Confirmar salida"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link al detalle si hay items, oculto pero mantiene rutas activas */}
      {items.length > 0 && (
        <div style={{ display: "none" }}>
          {items.map(i => (
            <Link key={i.id} href={`/flota/${i.id}`}>{i.id}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
