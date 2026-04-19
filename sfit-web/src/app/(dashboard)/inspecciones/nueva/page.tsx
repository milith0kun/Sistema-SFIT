"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

/* ─── tipos ─────────────────────────────────────────────────────────── */
type StoredUser = { role: string };

type Vehicle = { id: string; plate: string; vehicleTypeKey: string; brand: string; model: string };
type Driver  = { id: string; name: string; licenseNumber: string };
type VehicleType = { id: string; key: string; name: string; checklistItems: string[] };

type ChecklistRow = { item: string; passed: boolean; notes: string };

/* ─── colores ────────────────────────────────────────────────────────── */
const APTO   = "#15803d"; const APTOBG   = "#F0FDF4"; const APTOBD   = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO     = "#b91c1c"; const NOBG     = "#FFF5F5"; const NOBD     = "#FCA5A5";
const INK1   = "#f4f4f5"; const INK2     = "#e4e4e7"; const INK5     = "#71717a";
const INK6   = "#52525b"; const INK9     = "#18181b";

const ALLOWED_CREATE = ["fiscal", "admin_municipal", "super_admin"];

function scoreColor(s: number) {
  if (s >= 80) return APTO;
  if (s >= 50) return RIESGO;
  return NO;
}
function scoreResult(s: number): "aprobada" | "observada" | "rechazada" {
  if (s >= 80) return "aprobada";
  if (s >= 60) return "observada";
  return "rechazada";
}
function resultLabel(r: "aprobada" | "observada" | "rechazada") {
  return r === "aprobada" ? "APROBADA" : r === "observada" ? "OBSERVADA" : "RECHAZADA";
}
function resultBg(r: "aprobada" | "observada" | "rechazada") {
  return r === "aprobada" ? APTOBG : r === "observada" ? RIESGOBG : NOBG;
}
function resultBorder(r: "aprobada" | "observada" | "rechazada") {
  return r === "aprobada" ? APTOBD : r === "observada" ? RIESGOBD : NOBD;
}

/* ─── componente ──────────────────────────────────────────────────────── */
export default function NuevaInspeccionPage() {
  const router = useRouter();

  /* datos de apoyo */
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [vTypes, setVTypes]         = useState<VehicleType[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /* selección */
  const [vehicleId, setVehicleId]   = useState("");
  const [driverId, setDriverId]     = useState("");
  const [checklist, setChecklist]   = useState<ChecklistRow[]>([]);
  const [observations, setObservations] = useState("");

  /* envío */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /* autenticación */
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/inspecciones"); return; }
  }, [router]);

  /* carga datos de apoyo */
  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      const headers = { Authorization: `Bearer ${token}` };
      const [rv, rd, rt] = await Promise.all([
        fetch("/api/vehiculos?limit=100",      { headers }),
        fetch("/api/conductores?limit=100",    { headers }),
        fetch("/api/tipos-vehiculo?limit=100", { headers }),
      ]);
      if (rv.status === 401 || rd.status === 401 || rt.status === 401) {
        router.replace("/login"); return;
      }
      const [dv, dd, dt] = await Promise.all([rv.json(), rd.json(), rt.json()]);
      if (dv.success) setVehicles(dv.data.items ?? []);
      if (dd.success) setDrivers(dd.data.items ?? []);
      if (dt.success) setVTypes(dt.data.items ?? []);
    } catch {
      setError("Error al cargar datos de apoyo.");
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  /* cuando cambia el vehículo → cargar checklist de su tipo */
  useEffect(() => {
    if (!vehicleId) { setChecklist([]); return; }
    const v = vehicles.find(x => x.id === vehicleId);
    if (!v) { setChecklist([]); return; }
    const vt = vTypes.find(x => x.key === v.vehicleTypeKey);
    if (!vt || !vt.checklistItems?.length) { setChecklist([]); return; }
    setChecklist(vt.checklistItems.map(item => ({ item, passed: false, notes: "" })));
  }, [vehicleId, vehicles, vTypes]);

  /* score calculado */
  const total   = checklist.length;
  const pasados = checklist.filter(r => r.passed).length;
  const score   = total === 0 ? 0 : Math.round((pasados / total) * 100);
  const result  = scoreResult(score);

  /* handlers checklist */
  function togglePassed(idx: number) {
    setChecklist(prev => prev.map((r, i) => i === idx ? { ...r, passed: !r.passed } : r));
  }
  function setNotes(idx: number, notes: string) {
    setChecklist(prev => prev.map((r, i) => i === idx ? { ...r, notes } : r));
  }

  /* enviar */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    const errs: Record<string, string> = {};
    if (!vehicleId)           errs.vehicleId       = "Selecciona un vehículo.";
    if (checklist.length === 0) errs.checklist     = "El tipo de vehículo debe tener ítems en el checklist.";

    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    const vehicle = vehicles.find(v => v.id === vehicleId)!;
    const payload = {
      vehicleId,
      driverId:       driverId || undefined,
      vehicleTypeKey: vehicle.vehicleTypeKey,
      checklistResults: checklist.map(r => ({
        item:   r.item,
        passed: r.passed,
        notes:  r.notes || undefined,
      })),
      score,
      result,
      observations: observations.trim() || undefined,
      evidenceUrls: [],
    };

    setSubmitting(true);
    try {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      const res = await fetch("/api/inspecciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo registrar la inspección.");
        }
        return;
      }
      router.push("/inspecciones");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── UI ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Inspecciones · RF-11"
        title="Nueva inspección"
        subtitle="Registra el acta de inspección vehicular con checklist por tipo de vehículo."
      />

      {error && (
        <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 16, color: NO, fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      {loadingData ? (
        <div style={{ padding: 48, textAlign: "center", color: INK5 }}>Cargando datos…</div>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Selección de vehículo y conductor ── */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: "0 0 18px" }}>
              Vehículo e infractor
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>

              {/* Vehículo */}
              <div>
                <label htmlFor="vehicleId" style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                  Vehículo <span style={{ color: NO }}>*</span>
                </label>
                <select
                  id="vehicleId"
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  className={`field${fieldErrors.vehicleId ? " field-error" : ""}`}
                >
                  <option value="">— Seleccionar vehículo —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.vehicleTypeKey} · {v.brand} {v.model}
                    </option>
                  ))}
                </select>
                {fieldErrors.vehicleId && (
                  <p style={{ marginTop: 6, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>{fieldErrors.vehicleId}</p>
                )}
              </div>

              {/* Conductor */}
              <div>
                <label htmlFor="driverId" style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                  Conductor <span style={{ color: INK5, fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
                </label>
                <select
                  id="driverId"
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="field"
                >
                  <option value="">— Sin conductor asociado —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.licenseNumber}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </Card>

          {/* ── Checklist dinámico ── */}
          {vehicleId && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                  Checklist de inspección
                </h3>
                {total > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.8125rem", color: INK5 }}>{pasados}/{total} ítems aprobados</span>
                    <span style={{ fontWeight: 800, fontSize: "1.125rem", color: scoreColor(score), fontVariantNumeric: "tabular-nums" }}>
                      {score}/100
                    </span>
                  </div>
                )}
              </div>

              {checklist.length === 0 ? (
                <div style={{ padding: "16px 0", color: INK5, fontSize: "0.9375rem" }}>
                  El tipo de vehículo seleccionado no tiene ítems de checklist configurados.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {checklist.map((row, idx) => (
                    <label
                      key={idx}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 14px", borderRadius: 10,
                        border: `1.5px solid ${row.passed ? APTOBD : INK2}`,
                        background: row.passed ? APTOBG : "#fff",
                        cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={row.passed}
                        onChange={() => togglePassed(idx)}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>{row.item}</span>
                        <input
                          placeholder="Notas (opcional)"
                          className="field"
                          style={{ marginTop: 8, fontSize: "0.8125rem" }}
                          value={row.notes}
                          onChange={e => setNotes(idx, e.target.value)}
                          onClick={e => e.preventDefault()}
                        />
                      </div>
                      <div style={{ marginTop: 2, color: row.passed ? APTO : INK5, flexShrink: 0 }}>
                        {row.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {fieldErrors.checklist && (
                <p style={{ marginTop: 10, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>{fieldErrors.checklist}</p>
              )}

              {/* Barra de score en tiempo real */}
              {total > 0 && (
                <div style={{ marginTop: 22, padding: "16px 18px", borderRadius: 12, background: resultBg(result), border: `1.5px solid ${resultBorder(result)}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {result === "aprobada" && <CheckCircle2 size={18} color={APTO} />}
                      {result === "observada" && <AlertCircle size={18} color={RIESGO} />}
                      {result === "rechazada" && <XCircle size={18} color={NO} />}
                      <span style={{ fontWeight: 700, color: scoreColor(score), fontSize: "0.9375rem" }}>
                        {resultLabel(result)}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: "1.5rem", color: scoreColor(score), fontVariantNumeric: "tabular-nums" }}>
                      {score}/100
                    </span>
                  </div>
                  <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: scoreColor(score), width: `${score}%`, transition: "width 0.3s ease" }} />
                  </div>
                  <p style={{ marginTop: 8, fontSize: "0.8125rem", color: scoreColor(score), fontWeight: 500 }}>
                    {result === "aprobada" && "El vehículo cumple con los estándares requeridos."}
                    {result === "observada" && "El vehículo presenta observaciones que deben ser corregidas."}
                    {result === "rechazada" && "El vehículo no cumple con los estándares mínimos de seguridad."}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* ── Observaciones ── */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: "0 0 14px" }}>
              Observaciones generales
            </h3>
            <div style={{ maxWidth: 720 }}>
              <label htmlFor="observations" style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                Observaciones <span style={{ color: INK5, fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                id="observations"
                className="field"
                rows={4}
                placeholder="Detalles adicionales sobre la inspección, condiciones del vehículo, etc."
                value={observations}
                onChange={e => setObservations(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          </Card>

          {/* ── Resumen previo al envío ── */}
          {vehicleId && total > 0 && (
            <div style={{ padding: "14px 18px", borderRadius: 12, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: "0.8125rem", color: INK6 }}>
                <span style={{ fontWeight: 700, color: INK9 }}>Resumen:</span>{" "}
                Vehículo <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{vehicles.find(v => v.id === vehicleId)?.plate}</span>
                {driverId && ` · Conductor: ${drivers.find(d => d.id === driverId)?.name}`}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.8125rem", color: INK5 }}>Score calculado:</span>
                <span style={{ fontWeight: 800, fontSize: "1rem", color: scoreColor(score), fontVariantNumeric: "tabular-nums" }}>{score}/100</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 999,
                  fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase" as const,
                  background: resultBg(result), color: scoreColor(score), border: `1px solid ${resultBorder(result)}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                  {resultLabel(result)}
                </span>
              </div>
            </div>
          )}

          {/* ── Acciones ── */}
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              Registrar inspección
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => router.push("/inspecciones")}>
              Cancelar
            </Button>
          </div>

        </form>
      )}
    </div>
  );
}
