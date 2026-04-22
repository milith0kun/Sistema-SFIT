"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, AlertTriangle, Plus, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Province    = { id: string; name: string };
type StoredUser  = { role: string; provinceId?: string };

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

export default function NuevaMunicipalidadPage() {
  const router = useRouter();
  const [user,     setUser]     = useState<StoredUser | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [name,     setName]     = useState("");
  const [provId,   setProvId]   = useState("");
  const [logoUrl,  setLogoUrl]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial"].includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
    void loadProvinces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setProvinces(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedProvId = user?.role === "admin_provincial" ? user.provinceId : provId;
    const errs: Record<string, string> = {};
    if (!name.trim())       errs.name       = "El nombre es obligatorio.";
    if (!resolvedProvId)    errs.provinceId = "La provincia es obligatoria.";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true); setError(null); setFieldErrors({});
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/municipalidades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ name: name.trim(), provinceId: resolvedProvId, ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}) }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else { setError(data.error ?? "No se pudo crear la municipalidad."); }
        return;
      }
      router.push("/municipalidades");
    } catch { setError("Error de conexión. Intenta nuevamente."); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        kicker="Municipalidades · RF-02"
        title="Nueva municipalidad"
        subtitle="Registra una nueva municipalidad dentro de la provincia correspondiente."
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18, alignItems: "start" }}>

        {/* ── Form card ── */}
        <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: INFO_BG, border: `1.5px solid ${INFO_BD}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={15} color={INFO_C} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Datos de la municipalidad</div>
              <div style={{ fontSize: "0.75rem", color: INK5 }}>Completa la información requerida</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
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

            {/* Logo URL */}
            <div>
              <label style={LABEL}>URL del logo <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
              <input
                value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
                style={{ ...FIELD, borderColor: fieldErrors.logoUrl ? RED : INK2 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = GOLD; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.logoUrl ? RED : INK2; }}
              />
              {fieldErrors.logoUrl && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.logoUrl}</p>}
            </div>

            {/* Provincia */}
            {user.role === "super_admin" ? (
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
            ) : (
              <div>
                <label style={LABEL}>Provincia</label>
                <div style={{ padding: "12px 16px", background: INFO_BG, border: `1.5px solid ${INFO_BD}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <Info size={15} color={INFO_C} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: "0.875rem", color: INFO_C, fontWeight: 500, margin: 0 }}>
                    La municipalidad se creará bajo tu provincia asignada.
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit" disabled={loading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.65s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity="0.3"/><path d="M4 12a8 8 0 018-8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Creando…</>
                ) : (
                  <><Plus size={15} />Crear municipalidad</>
                )}
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
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>Jerarquía del sistema</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🏛", label: "Provincia", active: false, desc: "Nivel raíz" },
                { icon: "🏢", label: "Municipalidad", active: true, desc: "Nivel actual" },
                { icon: "🚌", label: "Vehículos y conductores", active: false, desc: "Pertenecen a la municipalidad" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: item.active ? GOLD_BG : "transparent", border: item.active ? `1px solid ${GOLD_BD}` : "1px solid transparent" }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: item.active ? 700 : 500, color: item.active ? GOLD : INK9 }}>{item.label}</div>
                    <div style={{ fontSize: "0.6875rem", color: INK5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: GOLD, marginBottom: 6 }}>Estado inicial</div>
            <p style={{ fontSize: "0.8125rem", color: "#78530A", lineHeight: 1.5, margin: 0 }}>
              Las municipalidades se crean como <strong>activas</strong>. Puedes suspenderlas en cualquier momento desde la pantalla de edición.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
