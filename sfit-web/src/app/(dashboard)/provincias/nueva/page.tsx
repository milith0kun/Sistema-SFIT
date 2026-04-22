"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, AlertTriangle, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type StoredUser = { role: string };

/* ── Tokens ── */
const INK9 = "#18181b"; const INK6 = "#52525b"; const INK5 = "#71717a";
const INK2 = "#e4e4e7"; const INK1 = "#f4f4f5";
const GOLD = "#B8860B"; const GOLD_BG = "#FDF8EC"; const GOLD_BD = "#E8D090";
const RED  = "#b91c1c"; const RED_BG  = "#FFF5F5"; const RED_BD  = "#FCA5A5";

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

export default function NuevaProvinciaPage() {
  const router = useRouter();
  const [name,   setName]   = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim())   errs.name   = "El nombre es obligatorio.";
    if (!region.trim()) errs.region = "La región es obligatoria.";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true); setError(null); setFieldErrors({});
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ name: name.trim(), region: region.trim() }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else { setError(data.error ?? "No se pudo crear la provincia."); }
        return;
      }
      router.push("/provincias");
    } catch { setError("Error de conexión. Intenta nuevamente."); }
    finally { setLoading(false); }
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        kicker="Provincias · RF-02"
        title="Nueva provincia"
        subtitle="Registra una nueva provincia y su región correspondiente."
        action={
          <Link href="/provincias">
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
            <div style={{ width: 32, height: 32, borderRadius: 9, background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={15} color={GOLD} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Datos de la provincia</div>
              <div style={{ fontSize: "0.75rem", color: INK5 }}>Completa la información geográfica</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={LABEL}>Nombre de la provincia</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cusco"
                style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : GOLD; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK2; }}
              />
              {fieldErrors.name && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.name}</p>}
            </div>

            <div>
              <label style={LABEL}>Región</label>
              <input
                value={region} onChange={(e) => setRegion(e.target.value)}
                placeholder="Ej. Cusco"
                style={{ ...FIELD, borderColor: fieldErrors.region ? RED : INK2 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.region ? RED : GOLD; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = fieldErrors.region ? RED : INK2; }}
              />
              {fieldErrors.region && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: RED, fontWeight: 500 }}>{fieldErrors.region}</p>}
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit" disabled={loading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.65s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity="0.3"/><path d="M4 12a8 8 0 018-8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>Creando…</>
                ) : (
                  <><Plus size={15} />Crear provincia</>
                )}
              </button>
              <Link href="/provincias">
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
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>Estructura geográfica</div>
            </div>
            <div style={{ padding: "16px 18px", fontSize: "0.8125rem", color: INK6, lineHeight: 1.6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Provincia", desc: "Nivel raíz de la jerarquía geográfica de SFIT." },
                  { label: "Municipalidades", desc: "Cada provincia puede tener múltiples municipalidades." },
                  { label: "Usuarios", desc: "Los administradores provinciales se asignan a este nivel." },
                ].map((item) => (
                  <div key={item.label} style={{ paddingBottom: 10, borderBottom: `1px solid ${INK1}` }}>
                    <div style={{ fontWeight: 700, color: INK9, marginBottom: 3, fontSize: "0.8125rem" }}>{item.label}</div>
                    <div style={{ color: INK5, fontSize: "0.75rem" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: GOLD, marginBottom: 6 }}>Tip</div>
            <p style={{ fontSize: "0.8125rem", color: "#78530A", lineHeight: 1.5, margin: 0 }}>
              Las provincias se activan automáticamente al crearse. Podrás desactivarlas desde la pantalla de edición.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
