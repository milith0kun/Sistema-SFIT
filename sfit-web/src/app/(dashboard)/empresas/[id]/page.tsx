"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Save, X, TrendingUp, Building2, Users, Car } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// ── Paleta SFIT ───────────────────────────────────────────────────────────────
const G = "#B8860B"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const WARN = "#b45309"; const WARNBG = "#FFFBEB"; const WARNBD = "#FCD34D";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

type Company = {
  id: string; razonSocial: string; ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[]; documents: { name: string; url: string }[];
  active: boolean; reputationScore: number; status?: string;
};
type VehicleType = { id: string; key: string; name: string };
type StoredUser = { role: string };
interface FormState { razonSocial: string; ruc: string; repName: string; repDni: string; repPhone: string }

const fieldStyle: React.CSSProperties = { width: "100%", height: 42, padding: "0 13px", borderRadius: 9, border: `1.5px solid ${INK2}`, fontSize: "0.9rem", color: INK9, background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "var(--font-inter), Inter, sans-serif", transition: "border-color 150ms" };
const readStyle: React.CSSProperties = { ...fieldStyle, background: INK1, color: INK6, border: `1px solid ${INK2}` };

function scoreColor(s: number) {
  if (s >= 80) return { bg: APTOBG, color: APTO, border: APTOBD };
  if (s >= 50) return { bg: WARNBG, color: WARN, border: WARNBD };
  return { bg: NOBG, color: NO, border: NOBD };
}

function ConfirmModal({ title, body, confirmLabel, confirmColor, onClose, onConfirm, loading }: { title: string; body: string; confirmLabel: string; confirmColor: string; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(9,9,11,0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
        <div style={{ padding: "20px 24px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: INK9, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: "0.9rem", color: INK6 }}>{body}</div>
        </div>
        <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, height: 40, borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: confirmColor, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props { params: Promise<{ id: string }> }

export default function EmpresaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ razonSocial: "", ruc: "", repName: "", repDni: "", repPhone: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"suspend" | "reactivate" | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["admin_municipal", "fiscal", "admin_provincial", "super_admin"].includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
    void load();
    void loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo cargar la empresa."); return; }
      const c: Company = data.data;
      setCompany(c);
      setForm({ razonSocial: c.razonSocial, ruc: c.ruc, repName: c.representanteLegal?.name ?? "", repDni: c.representanteLegal?.dni ?? "", repPhone: c.representanteLegal?.phone ?? "" });
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json();
      if (res.ok && data.success) setTypes(data.data.items ?? []);
    } catch { /* silent */ }
  }

  function startEdit() { setEditing(true); setSaveError(null); }
  function cancelEdit() { if (!company) return; setEditing(false); setSaveError(null); setForm({ razonSocial: company.razonSocial, ruc: company.ruc, repName: company.representanteLegal?.name ?? "", repDni: company.representanteLegal?.dni ?? "", repPhone: company.representanteLegal?.phone ?? "" }); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaveError(null);
    if (!form.razonSocial.trim() || !form.ruc.trim()) { setSaveError("Razón social y RUC son requeridos."); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ razonSocial: form.razonSocial.trim(), ruc: form.ruc.trim(), representanteLegal: { name: form.repName.trim(), dni: form.repDni.trim(), phone: form.repPhone.trim() || undefined } }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) { setSaveError(data.error ?? "No se pudo guardar."); return; }
      setCompany(data.data);
      setEditing(false);
    } catch { setSaveError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function toggleActive() {
    if (!company) return;
    const isSuspended = !company.active || company.status === "suspendido";
    setToggling(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: isSuspended, status: isSuspended ? "activo" : "suspendido" }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo actualizar."); return; }
      setCompany(data.data);
    } catch { setError("Error de conexión."); }
    finally { setToggling(false); setConfirm(null); }
  }

  if (loading || !company) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(100deg,#0A1628,#1A2D4A)", borderRadius: 12, padding: "18px 22px", marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: 100, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 26, width: 280, borderRadius: 8 }} />
        </div>
        {[1,2,3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />)}
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(100deg,#0A1628,#1A2D4A)", borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: G, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Empresas</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff" }}>Empresa no encontrada</div>
        </div>
        <Link href="/empresas" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
          <ArrowLeft size={14} />Volver
        </Link>
      </div>
    );
  }

  const sc = scoreColor(company.reputationScore);
  const typeMap = new Map(types.map(t => [t.key, t.name]));
  const canManage = user?.role === "admin_municipal" || user?.role === "super_admin";
  const isSuspended = !company.active || company.status === "suspendido";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="animate-fade-in">
      {confirm && (
        <ConfirmModal
          title={confirm === "suspend" ? "Suspender empresa" : "Reactivar empresa"}
          body={confirm === "suspend" ? `¿Suspender "${company.razonSocial}"? No podrá registrar nuevos viajes.` : `¿Reactivar "${company.razonSocial}"?`}
          confirmLabel={confirm === "suspend" ? "Sí, suspender" : "Sí, reactivar"}
          confirmColor={confirm === "suspend" ? NO : APTO}
          onClose={() => setConfirm(null)}
          onConfirm={toggleActive}
          loading={toggling}
        />
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(100deg,#0A1628 0%,#111F38 55%,#1A2D4A 100%)", borderRadius: 12, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: G, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Empresas · Detalle</div>
          {editing ? (
            <input value={form.razonSocial} onChange={e => setForm(p => ({ ...p, razonSocial: e.target.value }))} style={{ ...fieldStyle, fontSize: "1.25rem", fontWeight: 700, height: 44, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.25)", marginBottom: 4 }} placeholder="Razón social" />
          ) : (
            <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{company.razonSocial}</div>
          )}
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>RUC {company.ruc}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {!editing ? (
            <>
              <Link href="/empresas" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}>
                <ArrowLeft size={13} />Volver
              </Link>
              {canManage && (
                <>
                  <button onClick={startEdit} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", borderRadius: 8, border: "1.5px solid rgba(212,168,39,0.4)", background: "rgba(184,134,11,0.15)", color: "#D4A827", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}>
                    <Pencil size={13} />Editar
                  </button>
                  <button onClick={() => setConfirm(isSuspended ? "reactivate" : "suspend")} disabled={toggling} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", borderRadius: 8, border: `1.5px solid ${isSuspended ? "rgba(134,239,172,.4)" : "rgba(252,165,165,.4)"}`, background: isSuspended ? "rgba(21,128,61,.15)" : "rgba(185,28,28,.15)", color: isSuspended ? "#86EFAC" : "#FCA5A5", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {isSuspended ? "Reactivar" : "Suspender"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={cancelEdit} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}>
                <X size={13} />Cancelar
              </button>
              <button form="empresa-form" type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: "#D4A827", color: INK9, fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                <Save size={13} />{saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ background: isSuspended ? NOBG : APTOBG, border: `1px solid ${isSuspended ? NOBD : APTOBD}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: isSuspended ? NOBG : APTOBG, border: `1px solid ${isSuspended ? NOBD : APTOBD}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={16} color={isSuspended ? NO : APTO} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: INK5, letterSpacing: "0.1em", textTransform: "uppercase" }}>Estado</div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: isSuspended ? NO : APTO }}>{isSuspended ? "Suspendida" : "Activa"}</div>
          </div>
        </div>
        <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: sc.bg, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={16} color={sc.color} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: INK5, letterSpacing: "0.1em", textTransform: "uppercase" }}>Reputación</div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: sc.color, fontVariantNumeric: "tabular-nums" }}>{company.reputationScore}/100</div>
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Car size={16} color={INK5} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: INK5, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tipos autorizados</div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: INK9 }}>{company.vehicleTypeKeys.length}</div>
          </div>
        </div>
      </div>

      {(error || saveError) && (
        <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, fontWeight: 500, fontSize: "0.875rem", marginBottom: 12 }}>
          {error ?? saveError}
        </div>
      )}

      <form id="empresa-form" onSubmit={handleSave} noValidate>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Datos principales */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${INK1}`, fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Datos de la empresa</div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: INK5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Razón social</div>
                {editing ? (
                  <input value={form.razonSocial} onChange={e => setForm(p => ({ ...p, razonSocial: e.target.value }))} style={fieldStyle} placeholder="Razón social" onFocus={e => { e.target.style.borderColor = G; }} onBlur={e => { e.target.style.borderColor = INK2; }} />
                ) : (
                  <input value={company.razonSocial} style={readStyle} readOnly />
                )}
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: INK5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>RUC</div>
                {editing ? (
                  <input value={form.ruc} onChange={e => setForm(p => ({ ...p, ruc: e.target.value }))} style={{ ...fieldStyle, fontFamily: "ui-monospace,monospace" }} placeholder="20xxxxxxxxx" maxLength={11} onFocus={e => { e.target.style.borderColor = G; }} onBlur={e => { e.target.style.borderColor = INK2; }} />
                ) : (
                  <input value={company.ruc} style={{ ...readStyle, fontFamily: "ui-monospace,monospace" }} readOnly />
                )}
              </div>
            </div>
          </div>

          {/* Representante legal */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={14} color={INK6} strokeWidth={1.8} />
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Representante legal</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { lbl: "Nombre", key: "repName" as const, placeholder: "Nombre completo" },
                { lbl: "DNI", key: "repDni" as const, placeholder: "Ej. 12345678" },
                { lbl: "Teléfono", key: "repPhone" as const, placeholder: "Ej. 987654321" },
              ].map(({ lbl, key, placeholder }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: INK5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{lbl}</div>
                  {editing ? (
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={fieldStyle} placeholder={placeholder} onFocus={e => { e.target.style.borderColor = G; }} onBlur={e => { e.target.style.borderColor = INK2; }} />
                  ) : (
                    <input value={key === "repName" ? (company.representanteLegal?.name ?? "—") : key === "repDni" ? (company.representanteLegal?.dni ?? "—") : (company.representanteLegal?.phone ?? "—")} style={readStyle} readOnly />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tipos de vehículo */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${INK1}`, fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Flota autorizada</div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {company.vehicleTypeKeys.length === 0 ? (
                  <span style={{ color: INK5, fontSize: "0.875rem" }}>Sin tipos asignados.</span>
                ) : (
                  company.vehicleTypeKeys.map(k => (
                    <Badge key={k} variant="info">{typeMap.get(k) ?? k}</Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${INK1}`, fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Documentos</div>
            <div style={{ padding: "16px 18px" }}>
              {company.documents?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {company.documents.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: GBG, border: `1px solid ${GBR}`, color: G, fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}>
                      📄 {d.name}
                    </a>
                  ))}
                </div>
              ) : (
                <span style={{ color: INK5, fontSize: "0.875rem" }}>Sin documentos adjuntos.</span>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
