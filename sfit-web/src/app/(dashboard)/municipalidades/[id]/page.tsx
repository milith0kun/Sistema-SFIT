"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Hash, Globe, Trash2, Save, AlertTriangle, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Province    = { id: string; name: string };
type Municipality = { id: string; name: string; provinceId: string; logoUrl?: string; active: boolean; createdAt?: string };
type StoredUser  = { role: string };

interface Props { params: Promise<{ id: string }> }

/* ── Tokens ── */
const INK9 = "#18181b"; const INK6 = "#52525b"; const INK5 = "#71717a";
const INK2 = "#e4e4e7"; const INK1 = "#f4f4f5";
const GOLD = "#B8860B"; const GOLD_BG = "#FDF8EC"; const GOLD_BD = "#E8D090";
const RED  = "#b91c1c"; const RED_BG  = "#FFF5F5"; const RED_BD  = "#FCA5A5";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";

const FIELD: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px",
  border: `1.5px solid ${INK2}`, borderRadius: 10,
  fontSize: "0.9375rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};
const META_ROW: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 14,
  borderBottom: `1px solid ${INK2}`,
};

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          position: "relative", width: 52, height: 28, borderRadius: 99, flexShrink: 0,
          background: checked ? GOLD : INK2, transition: "background 0.2s",
        }}
      >
        <div style={{
          position: "absolute", top: 4, left: checked ? 28 : 4,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s",
        }} />
      </div>
      <div>
        <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: INK9, lineHeight: 1 }}>
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
        body: JSON.stringify({ name: name.trim(), provinceId: provId, logoUrl: logoUrl.trim() || undefined, active: isActive }),
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
    <div style={{ padding: 32, background: "#fff", borderRadius: 14, border: `1.5px solid ${INK2}`, color: INK5, display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.65s linear infinite" }}>
        <circle cx="12" cy="12" r="10" stroke={GOLD} strokeWidth="3" opacity="0.25"/>
        <path d="M4 12a8 8 0 018-8" stroke={GOLD} strokeWidth="3" strokeLinecap="round"/>
      </svg>
      Cargando municipalidad…
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
        <div style={{ padding: "12px 16px", background: RED_BG, border: `1.5px solid ${RED_BD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} />{error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 10, color: "#15803d", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#15803d", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>
          Cambios guardados correctamente.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18, alignItems: "start" }}>

        {/* ── Form card ── */}
        <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: INFO_BG, border: `1.5px solid ${INFO_BD}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={15} color={INFO_C} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Datos de la municipalidad</div>
              <div style={{ fontSize: "0.75rem", color: INK5 }}>Nombre, provincia, logo y estado</div>
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
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : GOLD; }}
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
                  onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.provinceId ? RED : GOLD; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.provinceId ? RED : INK2; }}
                >
                  <option value="" disabled>Selecciona una provincia…</option>
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
                  onFocus={(e) => { e.currentTarget.style.borderColor = GOLD; }}
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

            {/* Estado */}
            <div>
              <label style={LABEL}>Estado de la municipalidad</label>
              <div style={{ padding: "14px 16px", background: INK1, borderRadius: 10 }}>
                <ToggleSwitch checked={isActive} onChange={setIsActive} />
              </div>
              {!isActive && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 8, fontSize: "0.8125rem", color: RED, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  Al suspender, todos los usuarios de esta municipalidad perderán el acceso.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit" disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.65s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity="0.3"/><path d="M4 12a8 8 0 018-8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Guardando…</>) : (<><Save size={15} />Guardar cambios</>)}
              </button>
              <Link href="/municipalidades">
                <button type="button" style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 20px", borderRadius: 10, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
              </Link>
            </div>
          </form>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${INK1}` }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>Información</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={META_ROW}>
                <Hash size={14} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 3 }}>ID</div>
                  <div style={{ fontSize: "0.75rem", color: INK9, fontFamily: "monospace", wordBreak: "break-all" }}>{municipality.id}</div>
                </div>
              </div>
              {currentProvince && (
                <div style={META_ROW}>
                  <Globe size={14} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 3 }}>Provincia</div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{currentProvince.name}</div>
                  </div>
                </div>
              )}
              <div style={{ ...META_ROW, borderBottom: "none" }}>
                <Globe size={14} color={INK5} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, marginBottom: 3 }}>Estado actual</div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: isActive ? "#F0FDF4" : RED_BG, color: isActive ? "#15803d" : RED, border: `1px solid ${isActive ? "#86EFAC" : RED_BD}` }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />{isActive ? "Activa" : "Suspendida"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: GOLD, marginBottom: 6 }}>Multi-tenant</div>
            <p style={{ fontSize: "0.8125rem", color: "#78530A", lineHeight: 1.5, margin: 0 }}>
              Cada municipalidad opera de forma aislada. Los datos de una municipalidad nunca son visibles para otra.
            </p>
          </div>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div style={{ background: RED_BG, border: `1.5px solid ${RED_BD}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${RED_BD}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Trash2 size={15} color={RED} />
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: RED }}>Zona de peligro</div>
        </div>
        <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: INK9, marginBottom: 4 }}>Eliminar esta municipalidad</div>
            <p style={{ fontSize: "0.8125rem", color: INK6, margin: 0 }}>
              Esta acción es permanente. Se eliminarán todos los usuarios, vehículos, conductores y registros vinculados.
            </p>
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${RED_BD}`, background: "#fff", color: RED, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              <Trash2 size={14} />Eliminar municipalidad
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ height: 40, padding: "0 16px", borderRadius: 10, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >Cancelar</button>
              <button
                onClick={() => { void handleDelete(); }} disabled={deleting}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: RED, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
