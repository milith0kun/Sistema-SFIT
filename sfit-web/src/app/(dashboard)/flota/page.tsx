"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Route, Wrench, X, Users, Download, Plus, Filter, AlertTriangle, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

type FleetStatus = "disponible" | "en_ruta" | "cerrado" | "auto_cierre" | "mantenimiento" | "fuera_de_servicio";
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

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF"; const INFOBD = "#BFDBFE";
const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function DriverStatusBadge({ s }: { s: string }) {
  const variantMap: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
    en_ruta: "info",
    cerrado: "inactivo",
    auto_cierre: "pendiente",
    disponible: "activo",
    mantenimiento: "pendiente",
    fuera_de_servicio: "suspendido",
    apto: "activo",
    riesgo: "pendiente",
    no_apto: "suspendido",
  };
  const labelMap: Record<string, string> = {
    en_ruta: "EN RUTA",
    cerrado: "CERRADO",
    auto_cierre: "AUTO-CIERRE",
    disponible: "DISPONIBLE",
    mantenimiento: "MANTENIMIENTO",
    fuera_de_servicio: "FUERA SERVICIO",
    apto: "APTO",
    riesgo: "RIESGO",
    no_apto: "NO APTO",
  };
  return (
    <Badge variant={variantMap[s] ?? "inactivo"}>
      {labelMap[s] ?? s.toUpperCase()}
    </Badge>
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
  { key: "disponible",        label: "Disponible" },
  { key: "en_ruta",           label: "En ruta" },
  { key: "mantenimiento",     label: "Mantenimiento" },
  { key: "fuera_de_servicio", label: "Fuera de servicio" },
  { key: "cerrado",           label: "Cerrado" },
  { key: "auto_cierre",       label: "Auto-cierre" },
];

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function FlotaPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<FleetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: false, 3: false, 4: false, 5: false });
  const [exitForm, setExitForm] = useState({ vehicleId: "", driverId: "", observations: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalVehicles, setModalVehicles] = useState<{ id: string; plate: string; brand: string; model: string }[]>([]);
  const [modalDrivers, setModalDrivers] = useState<{ id: string; name: string; status: string }[]>([]);
  const [modalDataLoading, setModalDataLoading] = useState(false);
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
      const res = await fetch("/api/flota", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar flota"); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  const enRuta = items.filter(i => i.status === "en_ruta").length;
  const disponible = items.filter(i => i.status === "disponible").length;
  const mant = items.filter(i => i.status === "mantenimiento" || i.status === "fuera_de_servicio").length;

  const filteredItems = useMemo(() => items.filter(i => {
    if (filterStatus.length > 0 && !filterStatus.includes(i.status)) return false;
    if (filterRoute && !`${i.route?.code ?? ""} ${i.route?.name ?? ""}`.toLowerCase().includes(filterRoute.toLowerCase())) return false;
    if (filterDriver && !(i.driver?.name ?? "").toLowerCase().includes(filterDriver.toLowerCase())) return false;
    return true;
  }), [items, filterStatus, filterRoute, filterDriver]);

  const activeFilters = filterStatus.length + (filterRoute ? 1 : 0) + (filterDriver ? 1 : 0);
  const clearFilters = () => { setFilterStatus([]); setFilterRoute(""); setFilterDriver(""); };
  const toggleStatus = (s: FleetStatus) => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const allCritOk = [0, 1, 2].every(i => checked[i]);
  const drivers = items.filter(i => i.driver).map(i => i.driver).filter((d, idx, arr) => arr.findIndex(x => x.name === d.name) === idx);

  const handleConfirmExit = useCallback(async () => {
    if (!allCritOk) return;
    if (!exitForm.vehicleId.trim()) { setSubmitError("Selecciona un vehículo."); return; }
    if (!exitForm.driverId.trim()) { setSubmitError("Selecciona un conductor."); return; }
    setSubmitting(true);
    setSubmitError(null);
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
        setSubmitError(data.error ?? "Error al registrar la salida.");
        return;
      }
      setShowChecklist(false);
      setChecked({ 0: true, 1: true, 2: false, 3: false, 4: false, 5: false });
      setExitForm({ vehicleId: "", driverId: "", observations: "" });
      void load();
    } catch {
      setSubmitError("Error de conexión al registrar la salida.");
    } finally {
      setSubmitting(false);
    }
  }, [allCritOk, exitForm, user, router, load]);

  const columns = useMemo<ColumnDef<FleetEntry, unknown>[]>(() => [
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (row) => `${row.vehicle?.plate ?? ""} ${row.vehicle?.brand ?? ""} ${row.vehicle?.model ?? ""}`,
      cell: ({ row }) => (
        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.05em" }}>
          {row.original.vehicle?.plate ?? "—"}
        </span>
      ),
    },
    {
      id: "ruta",
      header: "Ruta/Zona",
      accessorFn: (row) => row.route ? `${row.route.code} ${row.route.name}` : "",
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.original.route ? `${row.original.route.code} ${row.original.route.name}` : "—"}
          </div>
          {row.original.observations && (
            <div style={{ fontSize: "0.75rem", color: RIESGO, marginTop: 2 }}>{row.original.observations}</div>
          )}
        </div>
      ),
    },
    {
      id: "conductor",
      header: "Conductor",
      accessorFn: (row) => row.driver?.name ?? "",
      cell: ({ getValue }) => <span style={{ fontSize: "0.875rem" }}>{(getValue() as string) || "—"}</span>,
    },
    {
      id: "salida",
      header: "Salida",
      accessorFn: (row) => row.departureTime ?? "",
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {row.original.departureTime ?? "—"}
        </span>
      ),
    },
    {
      id: "retorno",
      header: "Retorno",
      accessorFn: (row) => row.returnTime ?? "",
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: row.original.returnTime ? INK9 : INK5 }}>
          {row.original.returnTime ?? "—"}
        </span>
      ),
    },
    {
      id: "km",
      header: "Km",
      accessorFn: (row) => row.km,
      cell: ({ getValue }) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{getValue() as number}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row }) => <DriverStatusBadge s={row.original.status} />,
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link href={`/flota/${row.original.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
      ),
    },
  ], []);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-07" title="Flota del día"
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Reporte diario</button>{user.role === "operador" && (<button style={btnInk} onClick={() => { setShowChecklist(true); void loadModalData(); }}><Plus size={16} />Registrar salida</button>)}</div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {[
          { ico: <Car size={18} />, lbl: "Disponibles", val: disponible, bg: APTOBG, ic: APTO },
          { ico: <Route size={18} />, lbl: "En ruta", val: enRuta, bg: INFOBG, ic: INFO },
          { ico: <Wrench size={18} />, lbl: "Mantenimiento", val: mant, bg: RIESGOBG, ic: RIESGO },
          { ico: <X size={18} />, lbl: "Fuera servicio", val: items.filter(i => i.status === "fuera_de_servicio").length, bg: NOBG, ic: NO },
          { ico: <Users size={18} />, lbl: "Conductores APTOS", val: drivers.filter(d => d.status === "apto").length, bg: GBG, ic: GD },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <div style={{ gridColumn: "span 2" }}>
          {showFilterPanel && (
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: INK9 }}>Filtros activos</span>
                {activeFilters > 0 && (
                  <button onClick={clearFilters} style={{ fontSize: "0.75rem", fontWeight: 600, color: NO, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Limpiar todo
                  </button>
                )}
              </div>

              {/* Estado */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5, marginBottom: 8 }}>Estado</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_FLEET_STATUSES.map(s => {
                    const active = filterStatus.includes(s.key);
                    return (
                      <button key={s.key} onClick={() => toggleStatus(s.key)}
                        style={{ padding: "4px 12px", borderRadius: 999, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .12s", background: active ? INK9 : INK1, color: active ? "#fff" : INK6, border: `1.5px solid ${active ? INK9 : INK2}` }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ruta y Conductor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Ruta / Zona</label>
                  <input
                    type="text"
                    placeholder="Buscar por código o nombre…"
                    value={filterRoute}
                    onChange={e => setFilterRoute(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 10px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: INK9 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Conductor</label>
                  <input
                    type="text"
                    placeholder="Buscar por nombre…"
                    value={filterDriver}
                    onChange={e => setFilterDriver(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 10px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: INK9 }}
                  />
                </div>
              </div>

              {activeFilters > 0 && (
                <div style={{ marginTop: 12, fontSize: "0.8125rem", color: INK5 }}>
                  Mostrando <strong style={{ color: INK9 }}>{filteredItems.length}</strong> de {items.length} registros
                </div>
              )}
            </div>
          )}

          <DataTable
            columns={columns}
            data={filteredItems}
            loading={loading}
            searchPlaceholder="Buscar por placa, conductor, ruta…"
            emptyTitle="Sin registros para hoy"
            emptyDescription="No se encontraron salidas registradas."
            toolbarEnd={
              <button
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: showFilterPanel || activeFilters > 0 ? INK9 : "#fff", color: showFilterPanel || activeFilters > 0 ? "#fff" : INK6, border: `1.5px solid ${showFilterPanel || activeFilters > 0 ? INK9 : INK2}`, transition: "all .15s" }}
                onClick={() => setShowFilterPanel(v => !v)}
              >
                <Filter size={13} />Filtrar
                {activeFilters > 0 && <span style={{ background: G, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: "0.6875rem", fontWeight: 700, lineHeight: "18px" }}>{activeFilters}</span>}
              </button>
            }
          />
        </div>

        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Conductores en turno</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Estado FatigueEngine</div>
          </div>
          <div style={{ padding: "8px 18px 18px" }}>
            {drivers.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: INK5 }}>Sin conductores</div>
            : drivers.map((d, i) => {
              const ini = d.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < drivers.length - 1 ? `1px solid ${INK1}` : "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: INK1, color: INK5, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>{ini}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>Desc. {d.restHours}h</div>
                  </div>
                  <DriverStatusBadge s={d.status} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Checklist modal */}
      {showChecklist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(9,9,11,.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { if (!submitting) setShowChecklist(false); }}>
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
              <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Checklist de pre-salida</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Verificación obligatoria antes del despacho</div></div>
              <button style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${INK2}`, background: "#fff", color: INK6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setShowChecklist(false)} disabled={submitting}><X size={14} /></button>
            </div>
            <div style={{ padding: 22 }}>
              {/* Datos de salida */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 10 }}>Datos de la salida</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>Vehículo <span style={{ color: NO }}>*</span></label>
                    <select
                      value={exitForm.vehicleId}
                      onChange={e => setExitForm(f => ({ ...f, vehicleId: e.target.value }))}
                      style={{ width: "100%", height: 38, padding: "0 10px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff", color: INK9, cursor: "pointer" }}
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
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>Conductor <span style={{ color: NO }}>*</span></label>
                      <select
                        value={exitForm.driverId}
                        onChange={e => setExitForm(f => ({ ...f, driverId: e.target.value }))}
                        style={{ width: "100%", height: 38, padding: "0 10px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff", color: INK9, cursor: "pointer" }}
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
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>Observaciones</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={exitForm.observations}
                      onChange={e => setExitForm(f => ({ ...f, observations: e.target.value }))}
                      style={{ width: "100%", height: 38, padding: "0 12px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 10 }}>Verificación pre-salida</div>
              {CHECKLIST_ITEMS.map((c, i) => (
                <div key={i} onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${checked[i] ? `rgba(21,128,61,0.25)` : c.critical && !checked[i] ? NOBD : INK2}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", background: checked[i] ? "#F7FCF9" : "#fff", transition: "all .12s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${checked[i] ? APTO : c.critical ? NO : INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: checked[i] ? APTO : "transparent", color: "#fff" }}>
                    {checked[i] && <Check size={14} />}
                  </div>
                  <div style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: checked[i] ? INK6 : INK9 }}>{c.t}</div>
                  {c.critical && !checked[i] && <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 5, background: NOBG, color: NO }}>Crítico</span>}
                </div>
              ))}
              {!allCritOk && (
                <div style={{ marginTop: 14, padding: 12, background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, fontSize: "0.8125rem", color: NO, display: "flex", gap: 10 }}>
                  <AlertTriangle size={16} /><div><strong>Bloqueado:</strong> marca los 3 puntos críticos antes de registrar la salida.</div>
                </div>
              )}
              {submitError && (
                <div style={{ marginTop: 12, padding: 12, background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, fontSize: "0.8125rem", color: NO, display: "flex", gap: 10 }}>
                  <AlertTriangle size={16} /><div>{submitError}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button style={{ ...btnOut, flex: 1 }} onClick={() => setShowChecklist(false)} disabled={submitting}>Cancelar</button>
                <button
                  style={{ ...btnInk, flex: 1, opacity: allCritOk && !submitting ? 1 : 0.45, cursor: allCritOk && !submitting ? "pointer" : "not-allowed" }}
                  disabled={!allCritOk || submitting}
                  onClick={() => void handleConfirmExit()}
                >
                  {submitting ? "Registrando…" : "Confirmar salida"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
