"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Hash, Globe, Trash2, Save, AlertTriangle, ImageIcon,
  Copy, Check, Loader2, CheckCircle, Briefcase,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

type Province    = { id: string; name: string };
type Municipality = {
  id: string; name: string; provinceId: string;
  logoUrl?: string; active: boolean;
  ruc?: string; razonSocial?: string; dataCompleted?: boolean;
  ubigeoCode?: string;
  createdAt?: string;
};
type StoredUser  = { role: string };
type RucLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; razonSocial: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

interface Props { params: Promise<{ id: string }> }

/* ── Tokens — paleta sobria ── */
const INK9 = "#18181b"; const INK6 = "#52525b"; const INK5 = "#71717a";
const INK2 = "#e4e4e7"; const INK1 = "#f4f4f5";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const GRN = "#15803d"; const GRN_BG = "#F0FDF4"; const GRN_BD = "#86EFAC";

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  border: `1px solid ${INK2}`, borderRadius: 8,
  fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};
const META_ROW: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 12,
  borderBottom: `1px solid ${INK1}`,
};

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          position: "relative", width: 44, height: 24, borderRadius: 99, flexShrink: 0,
          background: checked ? INK9 : INK2, transition: "background 0.2s",
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s",
        }} />
      </div>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, lineHeight: 1 }}>
          {checked ? "Activa" : "Suspendida"}
        </div>
        <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 3 }}>
          {checked ? "Los usuarios de este municipio tienen acceso" : "Acceso bloqueado para todos los usuarios"}
        </div>
      </div>
    </label>
  );
}

export default function EditarMunicipalidadPage({ params }: Props) {
  const { id } = usePromise(params);
  const router  = useRouter();
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [name,     setName]     = useState("");
  const [provId,   setProvId]   = useState("");
  const [logoUrl,  setLogoUrl]  = useState("");
  const [isActive, setIsActive] = useState(true);
  const [ruc,         setRuc]         = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [rucLookup,   setRucLookup]   = useState<RucLookup>({ state: "idle" });
  const [rucHover,    setRucHover]    = useState(false);
  const rucTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial"].includes(u.role)) { router.replace("/dashboard"); return; }
    void Promise.all([load(), loadProvinces()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reemplaza el ID crudo del breadcrumb por el nombre real de la municipalidad
  useSetBreadcrumbTitle(municipality?.name);

  // Auto-lookup SUNAT al tipear los 11 dígitos del RUC.
  // Mantiene el patrón del DNI/RENIEC: 404 → not_found, 5xx → error.
  const lookupRuc = useCallback(async (rucValue: string) => {
    if (!/^\d{11}$/.test(rucValue)) return;
    setRucLookup({ state: "loading" });
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/validar/ruc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ ruc: rucValue }),
      });
      const data = await res.json();
      // Log para diagnóstico — visible en consola del browser.
      console.debug("[RUC lookup]", { status: res.status, data });
      if (res.status === 404) { setRucLookup({ state: "not_found" }); return; }
      if (!res.ok || !data.success) {
        setRucLookup({ state: "error", message: data.error ?? `Servicio SUNAT no disponible (HTTP ${res.status})` });
        return;
      }
      const rs = (data.data?.razon_social ?? data.data?.razonSocial ?? "").toString().trim();
      if (!rs) { setRucLookup({ state: "not_found" }); return; }
      setRucLookup({ state: "ok", razonSocial: rs });
      // Auto-aplica razón social SIEMPRE al verificar SUNAT.
      setRazonSocial(rs);
    } catch (err) {
      console.error("[RUC lookup] excepción:", err);
      setRucLookup({ state: "error", message: "No se pudo conectar con el servicio." });
    }
  }, []);

  useEffect(() => {
    if (rucTimer.current) clearTimeout(rucTimer.current);
    if (!/^\d{11}$/.test(ruc)) {
      if (rucLookup.state !== "idle") setRucLookup({ state: "idle" });
      return;
    }
    rucTimer.current = setTimeout(() => { void lookupRuc(ruc); }, 350);
    return () => { if (rucTimer.current) clearTimeout(rucTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruc, lookupRuc]);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo cargar."); return; }
      const m: Municipality = data.data;
      setMunicipality(m);
      setName(m.name);
      setProvId(m.provinceId);
      setLogoUrl(m.logoUrl ?? "");
      setIsActive(m.active);
      setRuc(m.ruc ?? "");
      setRazonSocial(m.razonSocial ?? "");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json();
      if (res.ok && data.success) setProvinces(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio.";
    if (!provId)      errs.provinceId = "La provincia es obligatoria.";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true); setError(null); setFieldErrors({}); setSuccess(false);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          name: name.trim(),
          provinceId: provId,
          logoUrl: logoUrl.trim() || undefined,
          active: isActive,
          ruc: ruc.trim() ? ruc.trim() : undefined,
          razonSocial: razonSocial.trim() ? razonSocial.trim() : undefined,
        }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else { setError(data.error ?? "No se pudo guardar."); }
        return;
      }
      setMunicipality(data.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) { window.alert(data.error ?? "No se pudo eliminar."); return; }
      router.push("/municipalidades");
    } catch { window.alert("Error de conexión."); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  if (notFound) return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader kicker="Municipalidades · RF-02" title="Municipalidad no encontrada"
        action={<Link href="/municipalidades"><button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><ArrowLeft size={15} />Volver</button></Link>}
      />
      <div style={{ padding: "32px 24px", background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, color: INK6, textAlign: "center" }}>
        La municipalidad solicitada no existe o fue eliminada.
      </div>
    </div>
  );

  if (loading || !municipality) return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader kicker="Municipalidades" title="Cargando municipalidad…" />
      <LoadingState rows={5} />
    </div>
  );

  const currentProvince = provinces.find((p) => p.id === provId);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        kicker="Municipalidades · RF-02"
        title={municipality.name}
        subtitle="Edita los datos y configura el estado de la municipalidad."
        action={
          <Link href="/municipalidades">
            <button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <ArrowLeft size={15} />Volver
            </button>
          </Link>
        }
      />

      {error && (
        <div style={{ padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 14px", background: GRN_BG, border: `1px solid ${GRN_BD}`, borderRadius: 8, color: GRN, fontSize: "0.8125rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} />
          Cambios guardados correctamente.
        </div>
      )}

      <div className="sfit-aside-layout sfit-aside-layout--wide">

        {/* ── Form card ── */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={14} color={INK6} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>Datos de la municipalidad</div>
              <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>Nombre, provincia, logo y estado</div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Nombre */}
            <div>
              <label style={LABEL}>Nombre de la municipalidad</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Municipalidad Provincial del Cusco"
                style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK9; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK2; }}
              />
              {fieldErrors.name && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.name}</p>}
            </div>

            {/* Provincia */}
            <div>
              <label style={LABEL}>Provincia</label>
              <div style={{ position: "relative" }}>
                <select
                  value={provId} onChange={(e) => setProvId(e.target.value)}
                  style={{ ...FIELD, appearance: "none", paddingRight: 36, cursor: "pointer", borderColor: fieldErrors.provinceId ? RED : INK2 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.provinceId ? RED : INK9; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.provinceId ? RED : INK2; }}
                >
                  <option value="" disabled>Seleccione una provincia…</option>
                  {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <svg viewBox="0 0 10 6" width="10" height="10" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} fill="none">
                  <path d="M1 1l4 4 4-4" stroke={INK5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {fieldErrors.provinceId && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.provinceId}</p>}
            </div>

            {/* Logo URL */}
            <div>
              <label style={LABEL}>URL del logo <span style={{ fontSize: "0.625rem", letterSpacing: "0.04em", color: "#a1a1aa", fontWeight: 600 }}>(OPCIONAL)</span></label>
              <div style={{ position: "relative" }}>
                <input
                  value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                  type="url" placeholder="https://ejemplo.com/logo.png"
                  style={{ ...FIELD, paddingLeft: 40 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = INK2; }}
                />
                <ImageIcon size={15} color={INK5} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
              {logoUrl && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo preview" onError={(e) => { e.currentTarget.style.display = "none"; }}
                    style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8, border: `1px solid ${INK2}`, background: INK1, padding: 4 }} />
                  <span style={{ fontSize: "0.75rem", color: INK5 }}>Vista previa del logo</span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: INK1 }} />

            {/* Datos institucionales — RUC + Razón social */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Briefcase size={13} color={INK6} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>
                  Datos institucionales
                </span>
                {municipality.dataCompleted ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", padding: "1px 7px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, color: GRN, background: "#fff", border: `1px solid ${GRN_BD}` }}>
                    <Check size={10} /> Completos
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", padding: "1px 7px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, color: "#92400E", background: "#fff", border: "1px solid #FDE68A" }}>
                    <AlertTriangle size={10} /> Pendientes
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {/* RUC con verificación SUNAT */}
                <div>
                  <label style={LABEL}>
                    RUC
                    <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                      (verificación SUNAT)
                    </span>
                  </label>
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setRucHover(true)}
                    onMouseLeave={() => setRucHover(false)}
                  >
                    <input
                      value={ruc}
                      onChange={e => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="20XXXXXXXXX"
                      inputMode="numeric"
                      maxLength={11}
                      style={{
                        ...FIELD,
                        fontFamily: "ui-monospace, monospace",
                        paddingRight: 38,
                        borderColor:
                          rucLookup.state === "ok" ? GRN
                          : rucLookup.state === "not_found" ? "#F59E0B"
                          : rucLookup.state === "error" ? RED
                          : fieldErrors.ruc ? RED
                          : INK2,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor =
                          rucLookup.state === "ok" ? GRN
                          : rucLookup.state === "not_found" ? "#F59E0B"
                          : rucLookup.state === "error" ? RED
                          : fieldErrors.ruc ? RED
                          : INK2;
                      }}
                    />
                    <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      {rucLookup.state === "loading"   && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                      {rucLookup.state === "ok"        && <CheckCircle size={14} color={GRN} />}
                      {rucLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                      {rucLookup.state === "error"     && <AlertTriangle size={14} color={RED} />}
                    </div>

                    {/* Popover hover — mismo patrón que DNI */}
                    {rucHover && rucLookup.state !== "idle" && (
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0, right: 0,
                          zIndex: 50,
                          background: "#fff",
                          border: `1px solid ${
                            rucLookup.state === "ok" ? GRN_BD
                            : rucLookup.state === "not_found" ? "#FDE68A"
                            : rucLookup.state === "error" ? RED_BD
                            : INK2
                          }`,
                          borderRadius: 8,
                          padding: "10px 12px",
                          boxShadow: "0 8px 24px rgba(9,9,11,0.10), 0 1px 2px rgba(9,9,11,0.06)",
                          animation: "fadeIn 120ms ease",
                        }}
                      >
                        {rucLookup.state === "loading" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Loader2 size={13} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />
                            <span style={{ fontSize: "0.8125rem", color: INK6 }}>Consultando SUNAT…</span>
                          </div>
                        )}
                        {rucLookup.state === "ok" && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <CheckCircle size={12} color={GRN} />
                              <span style={{ fontSize: "0.625rem", fontWeight: 800, color: GRN, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                SUNAT verificado
                              </span>
                            </div>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.35, wordBreak: "break-word" }}>
                              {rucLookup.razonSocial}
                            </div>
                            {razonSocial.trim().toLowerCase() !== rucLookup.razonSocial.toLowerCase() && (
                              <button
                                type="button"
                                onClick={() => setRazonSocial(rucLookup.razonSocial)}
                                style={{
                                  marginTop: 8, width: "100%",
                                  height: 28, borderRadius: 6,
                                  border: `1px solid ${GRN}`, background: GRN_BG, color: GRN,
                                  fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                }}
                              >
                                Usar esta razón social
                              </button>
                            )}
                          </>
                        )}
                        {rucLookup.state === "not_found" && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <AlertTriangle size={12} color="#92400E" />
                              <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#92400E", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                No registrado
                              </span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
                              RUC no encontrado en SUNAT. Puedes completar la razón social manualmente.
                            </div>
                          </>
                        )}
                        {rucLookup.state === "error" && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <AlertTriangle size={12} color={RED} />
                              <span style={{ fontSize: "0.625rem", fontWeight: 800, color: RED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Servicio no disponible
                              </span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5, marginBottom: 8 }}>
                              {rucLookup.message} Puedes ingresar la razón social manualmente.
                            </div>
                            <button
                              type="button"
                              onClick={() => { void lookupRuc(ruc); }}
                              style={{
                                width: "100%", height: 26, borderRadius: 6,
                                border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                                fontSize: "0.6875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              Reintentar consulta
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Feedback inline (visible sin hover) */}
                  {rucLookup.state === "not_found" && (
                    <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#92400E", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />
                      RUC no encontrado en SUNAT — ingresa la razón social manualmente.
                    </p>
                  )}
                  {rucLookup.state === "error" && (
                    <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />
                      {rucLookup.message}
                    </p>
                  )}
                  {rucLookup.state === "ok" && (
                    <p style={{ marginTop: 6, fontSize: "0.75rem", color: GRN, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                      <CheckCircle size={11} />
                      Verificado: {rucLookup.razonSocial}
                    </p>
                  )}
                  {fieldErrors.ruc && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.ruc}</p>}
                </div>

                {/* Razón social */}
                <div>
                  <label style={LABEL}>Razón social</label>
                  <input
                    value={razonSocial}
                    onChange={e => setRazonSocial(e.target.value)}
                    placeholder="MUNICIPALIDAD PROVINCIAL DE …"
                    style={{ ...FIELD, borderColor: fieldErrors.razonSocial ? RED : INK2 }}
                    onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.razonSocial ? RED : INK9; }}
                    onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.razonSocial ? RED : INK2; }}
                  />
                  {fieldErrors.razonSocial && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.razonSocial}</p>}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: INK1 }} />

            {/* Estado */}
            <div>
              <label style={LABEL}>Estado de la municipalidad</label>
              <div style={{ padding: "12px 14px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <ToggleSwitch checked={isActive} onChange={setIsActive} />
              </div>
              {!isActive && (
                <div style={{ marginTop: 10, padding: "9px 12px", background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 8, fontSize: "0.8125rem", color: RED, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  Al suspender, todos los usuarios de esta municipalidad perderán el acceso.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit" disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: INK9, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? (<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.65s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity="0.3"/><path d="M4 12a8 8 0 018-8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Guardando…</>) : (<><Save size={14} />Guardar cambios</>)}
              </button>
              <Link href="/municipalidades">
                <button type="button" style={{ display: "inline-flex", alignItems: "center", height: 36, padding: "0 16px", borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
              </Link>
            </div>
          </form>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}` }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>Información</div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* ID — botón copiar */}
              <SystemIdRow id={municipality.id} />
              {currentProvince && (
                <div style={META_ROW}>
                  <Globe size={13} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 3 }}>Provincia</div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{currentProvince.name}</div>
                  </div>
                </div>
              )}
              <div style={{ ...META_ROW, borderBottom: "none", paddingBottom: 0 }}>
                <Globe size={13} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 4 }}>Estado actual</div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: "#fff", color: isActive ? GRN : RED, border: `1px solid ${isActive ? GRN_BD : RED_BD}` }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />{isActive ? "Activa" : "Suspendida"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nota multi-tenant — neutral */}
          <div style={{ background: INK1, border: `1px solid ${INK2}`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK6, marginBottom: 6 }}>
              Multi-tenant
            </div>
            <p style={{ fontSize: "0.8125rem", color: INK6, lineHeight: 1.55, margin: 0 }}>
              Cada municipalidad opera de forma aislada. Los datos de una municipalidad nunca son visibles para otra.
            </p>
          </div>

          {/* Zona de peligro — compacta dentro del sidebar */}
          <DangerZoneSidebar
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            deleting={deleting}
            onDelete={() => { void handleDelete(); }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Zona de peligro compacta para el sidebar ── */
function DangerZoneSidebar({
  confirmDelete, setConfirmDelete, deleting, onDelete,
}: {
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${RED_BD}`, borderRadius: 12,
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Trash2 size={13} color={RED} />
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED }}>
          Zona de peligro
        </div>
      </div>

      {!confirmDelete ? (
        <>
          <p style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5, margin: 0 }}>
            Eliminar esta municipalidad es permanente. Se borrarán los usuarios, vehículos, conductores y registros vinculados.
          </p>
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              height: 32, padding: "0 12px", borderRadius: 7,
              border: `1px solid ${RED_BD}`, background: RED_BG, color: RED,
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Trash2 size={12} />Eliminar municipalidad
          </button>
        </>
      ) : (
        <div style={{ background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, color: RED, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 10, lineHeight: 1.5 }}>
            Acción irreversible.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onDelete} disabled={deleting}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                height: 30, borderRadius: 7, border: "none", background: RED, color: "#fff",
                fontSize: "0.75rem", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: deleting ? 0.7 : 1,
              }}>
              <Trash2 size={11} />{deleting ? "…" : "Sí, eliminar"}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              style={{
                flex: 1, height: 30, borderRadius: 7,
                border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ID del sistema con copy-to-clipboard ── */
function SystemIdRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const shortId = id.slice(-8).toUpperCase();
  return (
    <div style={META_ROW}>
      <Hash size={13} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 4 }}>ID del sistema</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
          background: INK1, padding: "5px 9px", borderRadius: 6,
        }}>
          <code title={id} style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.75rem",
            color: INK9,
            fontWeight: 600,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {shortId}
          </code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(id);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              } catch { /* clipboard may be blocked */ }
            }}
            title="Copiar ID completo"
            aria-label="Copiar ID completo"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              height: 22, padding: "0 8px", borderRadius: 5,
              border: `1px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {copied ? <Check size={11} color={GRN} /> : <Copy size={11} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
