"use client";

import { useEffect, useState, useCallback, cloneElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Route, Wrench, X, Users, Download, Plus, Filter, AlertTriangle, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

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

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    en_ruta: { bg: INFOBG, color: INFO, border: INFOBD, label: "EN RUTA" },
    cerrado: { bg: INK1, color: INK5, border: INK2, label: "CERRADO" },
    auto_cierre: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "AUTO-CIERRE" },
    disponible: { bg: APTOBG, color: APTO, border: APTOBD, label: "DISPONIBLE" },
    mantenimiento: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "MANTENIMIENTO" },
    fuera_de_servicio: { bg: NOBG, color: NO, border: NOBD, label: "FUERA SERVICIO" },
    apto: { bg: APTOBG, color: APTO, border: APTOBD, label: "APTO" },
    riesgo: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "RIESGO" },
    no_apto: { bg: NOBG, color: NO, border: NOBD, label: "NO APTO" },
  };
  const st = map[s] ?? { bg: INK1, color: INK5, border: INK2, label: s.toUpperCase() };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{st.label}</span>;
}

function Plate({ p }: { p: string }) {
  return <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.05em" }}>{p}</span>;
}

const CHECKLIST_ITEMS = [
  { t: "Luces, intermitentes y frenos", critical: true },
  { t: "Documentos del vehículo (tarjeta, SOAT, revisión técnica)", critical: true },
  { t: "Cinturones de seguridad operativos", critical: true },
  { t: "Neumáticos y presión reglamentaria", critical: false },
  { t: "Extintor vigente", critical: false },
  { t: "Limpieza interior y exterior", critical: false },
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

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

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
  const cerrado = items.filter(i => i.status === "cerrado").length;
  const disponible = items.filter(i => i.status === "disponible").length;
  const mant = items.filter(i => i.status === "mantenimiento" || i.status === "fuera_de_servicio").length;

  const allCritOk = [0, 1, 2].every(i => checked[i]);
  const drivers = items.filter(i => i.driver).map(i => i.driver).filter((d, idx, arr) => arr.findIndex(x => x.name === d.name) === idx);

  const handleConfirmExit = useCallback(async () => {
    if (!allCritOk) return;
    if (!exitForm.vehicleId.trim()) { setSubmitError("Selecciona o ingresa el ID del vehículo."); return; }
    if (!exitForm.driverId.trim() && user?.role !== "conductor") { setSubmitError("Ingresa el ID del conductor."); return; }
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

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-07" title="Flota del día"
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Reporte diario</button><button style={btnInk} onClick={() => setShowChecklist(true)}><Plus size={16} />Registrar salida</button></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, margin: "24px 0 18px" }}>
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
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden", gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
            <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Salidas y retornos del día</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{items.length} registros</div></div>
            <button style={{ ...btnOut, height: 32, fontSize: "0.8125rem" }}><Filter size={14} />Filtrar</button>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando…</div>
          : items.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin registros para hoy</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr>{["Vehículo","Ruta/Zona","Conductor","Salida","Retorno","Km","Estado",""].map((h,i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>{items.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><Plate p={e.vehicle.plate} /></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <div style={{ fontWeight: 600 }}>{e.route ? `${e.route.code} ${e.route.name}` : "—"}</div>
                    {e.observations && <div style={{ fontSize: "0.75rem", color: RIESGO, marginTop: 2 }}>{e.observations}</div>}
                  </td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontSize: "0.875rem" }}>{e.driver.name}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{e.departureTime ?? "—"}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600, color: e.returnTime ? INK9 : INK5, fontVariantNumeric: "tabular-nums" }}>{e.returnTime ?? "—"}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontVariantNumeric: "tabular-nums" }}>{e.km}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><StatusBadge s={e.status} /></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <Link href={`/flota/${e.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
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
                  <StatusBadge s={d.status} />
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
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>ID Vehículo <span style={{ color: NO }}>*</span></label>
                    <input
                      type="text"
                      placeholder="ObjectId del vehículo"
                      value={exitForm.vehicleId}
                      onChange={e => setExitForm(f => ({ ...f, vehicleId: e.target.value }))}
                      style={{ width: "100%", height: 38, padding: "0 12px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  {user?.role !== "conductor" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 4 }}>ID Conductor <span style={{ color: NO }}>*</span></label>
                      <input
                        type="text"
                        placeholder="ObjectId del conductor"
                        value={exitForm.driverId}
                        onChange={e => setExitForm(f => ({ ...f, driverId: e.target.value }))}
                        style={{ width: "100%", height: 38, padding: "0 12px", border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.875rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box" }}
                      />
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
