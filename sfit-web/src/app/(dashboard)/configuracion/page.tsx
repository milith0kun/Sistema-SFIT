"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, Check, Clock, AlertTriangle, Bell, ClipboardList, RotateCcw, Sliders } from "lucide-react";

type Config = {
  horasMaxConduccion: number;
  limiteInspecciones: number;
  alertaFatigaHoras: number;
  notificacionesActivas: boolean;
};

const ALLOWED = ["admin_municipal", "super_admin"];

const NAV  = "#0A1628";
const G    = "#B8860B"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO   = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";

/* ─── Stepper field ─────────────────────────────────────────────────────── */
function StepperField({
  icon, label, description, value, min, max, unit, color, onChange,
}: {
  icon: React.ReactNode; label: string; description: string;
  value: number; min: number; max: number; unit: string;
  color?: string; onChange: (v: number) => void;
}) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  const trackColor = color ?? G;
  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14,
      padding: "20px 22px", transition: "border-color 180ms",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GBR; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = INK2; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: GBG,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>{label}</div>
          <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => onChange(Math.max(min, value - 1))} style={{
            width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${INK2}`,
            background: INK1, color: INK6, cursor: "pointer", fontSize: 20, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
            transition: "border-color 150ms, background 150ms",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = G; (e.currentTarget as HTMLButtonElement).style.background = GBG; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = INK2; (e.currentTarget as HTMLButtonElement).style.background = INK1; }}
          >−</button>
          <div style={{ textAlign: "center", minWidth: 52 }}>
            <span style={{ fontWeight: 800, fontSize: "1.375rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>{value}</span>
            <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{unit}</div>
          </div>
          <button type="button" onClick={() => onChange(Math.min(max, value + 1))} style={{
            width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${INK2}`,
            background: INK1, color: INK6, cursor: "pointer", fontSize: 20, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
            transition: "border-color 150ms, background 150ms",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = G; (e.currentTarget as HTMLButtonElement).style.background = GBG; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = INK2; (e.currentTarget as HTMLButtonElement).style.background = INK1; }}
          >+</button>
        </div>
      </div>
      {/* Progress track */}
      <div style={{ height: 6, background: INK1, borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 999,
          background: `linear-gradient(90deg, ${trackColor}80, ${trackColor})`,
          transition: "width 200ms ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: INK5, marginTop: 4 }}>
        <span>{min} mín.</span><span>{max} máx.</span>
      </div>
    </div>
  );
}

/* ─── Toggle ─────────────────────────────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} style={{
      width: 54, height: 30, borderRadius: 999, border: "none", cursor: "pointer",
      background: value ? APTO : INK2, transition: "background 220ms ease",
      position: "relative", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 4, width: 22, height: 22, borderRadius: "50%",
        background: "#fff", transition: "left 220ms ease",
        left: value ? 28 : 4, boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
      }} />
    </button>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────── */
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, background: NAV,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK6 }}>{label}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ConfiguracionPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [config, setConfig] = useState<Config>({
    horasMaxConduccion: 8, limiteInspecciones: 100,
    alertaFatigaHoras: 4, notificacionesActivas: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("/api/admin/config", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setConfig(data.data as Config);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true); setError(null); setSavedOk(false);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al guardar"); return; }
      setConfig(data.data as Config);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3500);
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }} className="animate-fade-in">
      {/* ── Hero dark header ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAV} 0%, #122040 60%, #1a2e50 100%)`,
        borderRadius: 18, padding: "32px 36px", marginBottom: 28, position: "relative", overflow: "hidden",
      }}>
        {/* dot grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }} />
        {/* gold glow */}
        <div style={{
          position: "absolute", top: -40, right: 60, width: 180, height: 180,
          background: `radial-gradient(circle, ${G}30 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${G}22`,
              border: `1.5px solid ${G}55`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Settings size={18} color={G} strokeWidth={1.8} />
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${G}cc` }}>
              Administración · RF-15
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Configuración municipal
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "0.9375rem", color: "#94a3b8" }}>
            Parámetros operativos del sistema para este municipio.
          </p>
        </div>
      </div>

      {/* ── Feedback banners ─────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "12px 16px", background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, color: NO, fontSize: "0.875rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      {savedOk && (
        <div style={{ padding: "12px 16px", background: APTOBG, border: `1.5px solid ${APTOBD}`, borderRadius: 12, color: APTO, fontSize: "0.875rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={15} />Configuración guardada correctamente.
        </div>
      )}

      {loading ? (
        /* ── Skeleton ──────────────────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[120, 120, 80, 80].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: INK1, overflow: "hidden", position: "relative" }}>
              <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="cfg-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
          {/* ── Left column ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Conducción */}
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16, padding: "22px 24px" }}>
              <SectionHeader icon={<Clock size={14} color={G} strokeWidth={2.2} />} label="Límites de conducción" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <StepperField
                  icon={<Clock size={17} color={G} strokeWidth={2} />}
                  label="Horas máximas de conducción"
                  description="Tiempo máximo diario de conducción antes de marcar fatiga."
                  value={config.horasMaxConduccion} min={4} max={12} unit="horas"
                  onChange={v => setConfig(c => ({ ...c, horasMaxConduccion: v }))}
                />
                <StepperField
                  icon={<AlertTriangle size={17} color="#b45309" strokeWidth={2} />}
                  label="Alerta de fatiga"
                  description="Hora a partir de la cual se emite alerta preventiva de fatiga."
                  value={config.alertaFatigaHoras} min={1} max={12} unit="horas"
                  color="#b45309"
                  onChange={v => setConfig(c => ({ ...c, alertaFatigaHoras: v }))}
                />
              </div>
            </div>

            {/* Inspecciones */}
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16, padding: "22px 24px" }}>
              <SectionHeader icon={<ClipboardList size={14} color={G} strokeWidth={2.2} />} label="Límites de inspección" />
              <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12, padding: "18px 20px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GBR; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = INK2; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: GBG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ClipboardList size={17} color={G} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Límite mensual de inspecciones</div>
                    <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Número máximo de inspecciones registrables por mes.</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="number" min={1} max={9999}
                    value={config.limiteInspecciones}
                    onChange={e => setConfig(c => ({ ...c, limiteInspecciones: Math.max(1, Number(e.target.value)) }))}
                    style={{
                      width: 110, height: 44, padding: "0 14px", borderRadius: 10,
                      border: `1.5px solid ${INK2}`, fontSize: "1.125rem", fontWeight: 800,
                      color: INK9, fontFamily: "inherit", outline: "none", textAlign: "center",
                      transition: "border-color 150ms",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = G; }}
                    onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                  />
                  <span style={{ fontSize: "0.875rem", color: INK5, fontWeight: 500 }}>inspecciones / mes</span>
                </div>
              </div>
            </div>

            {/* Notificaciones */}
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16, padding: "22px 24px" }}>
              <SectionHeader icon={<Bell size={14} color={G} strokeWidth={2.2} />} label="Notificaciones" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = GBG; (e.currentTarget as HTMLDivElement).style.borderRadius = "10px"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ""; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: config.notificacionesActivas ? APTOBG : INK1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 220ms" }}>
                    <Bell size={17} color={config.notificacionesActivas ? APTO : INK5} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Notificaciones push activas</div>
                    <div style={{ fontSize: "0.8125rem", marginTop: 2, color: config.notificacionesActivas ? APTO : INK5, fontWeight: 500, transition: "color 220ms" }}>
                      {config.notificacionesActivas ? "Activadas — los usuarios reciben alertas en tiempo real." : "Desactivadas — no se envían notificaciones."}
                    </div>
                  </div>
                </div>
                <Toggle value={config.notificacionesActivas} onChange={v => setConfig(c => ({ ...c, notificacionesActivas: v }))} />
              </div>
            </div>
          </div>

          {/* ── Right column: summary + actions ─────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Resumen */}
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Sliders size={15} color={G} strokeWidth={2.2} />
                <span style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9 }}>Resumen de parámetros</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Max. conducción", value: `${config.horasMaxConduccion}h`, color: G },
                  { label: "Alerta fatiga", value: `${config.alertaFatigaHoras}h`, color: "#b45309" },
                  { label: "Límite inspecciones", value: `${config.limiteInspecciones}/mes`, color: INK9 },
                  {
                    label: "Notificaciones",
                    value: config.notificacionesActivas ? "Activas" : "Inactivas",
                    color: config.notificacionesActivas ? APTO : INK5,
                  },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: INK1, borderRadius: 10 }}>
                    <span style={{ fontSize: "0.8125rem", color: INK6 }}>{item.label}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => void save()} disabled={saving} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 46, borderRadius: 11, fontSize: "0.9375rem", fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer", border: "none",
                  background: saving ? INK5 : NAV, color: "#fff", fontFamily: "inherit",
                  transition: "background 150ms", width: "100%",
                }}>
                  {saving ? (
                    <><span style={{ display: "inline-block", width: 15, height: 15, borderRadius: "50%", border: `2px solid #fff4`, borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />Guardando…</>
                  ) : (
                    <><Save size={16} />Guardar configuración</>
                  )}
                </button>
                <button onClick={() => void load()} disabled={loading || saving} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 42, borderRadius: 11, fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff",
                  color: INK6, fontFamily: "inherit", width: "100%",
                }}>
                  <RotateCcw size={14} />Descartar cambios
                </button>
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: "14px 16px", background: GBG, border: `1.5px solid ${GBR}`, borderRadius: 12, fontSize: "0.8125rem", color: INK6, lineHeight: 1.5 }}>
              <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Settings size={14} color={G} style={{ marginTop: 2, flexShrink: 0 }} />
                Los cambios se aplican de forma inmediata para todos los usuarios del municipio.
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @media (max-width: 900px) {
          .cfg-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
