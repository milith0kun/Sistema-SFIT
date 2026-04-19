"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Config = {
  horasMaxConduccion: number;
  limiteInspecciones: number;
  alertaFatigaHoras: number;
  notificacionesActivas: boolean;
};

const ALLOWED = ["admin_municipal", "super_admin"];

const INK1 = "#f4f4f5";
const INK2 = "#e4e4e7";
const INK5 = "#71717a";
const INK6 = "#52525b";
const INK9 = "#18181b";
const APTO_BG = "#F0FDF4"; const APTO_C = "#15803d"; const APTO_BD = "#86EFAC";
const ERR_BG = "#FFF5F5"; const ERR_C = "#b91c1c"; const ERR_BD = "#FCA5A5";

function NumberField({
  label, description, value, min, max, onChange,
}: {
  label: string; description: string; value: number;
  min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: 20, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: INK9 }}>{label}</div>
          <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 3 }}>{description}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${INK2}`,
              background: "#fff", color: INK6, cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >−</button>
          <span style={{ fontWeight: 800, fontSize: "1.25rem", color: INK9, minWidth: 36, textAlign: "center" }}>
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${INK2}`,
              background: "#fff", color: INK6, cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: INK9 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: INK5, marginTop: 2 }}>
          <span>{min}h mín.</span>
          <span>{max}h máx.</span>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [config, setConfig] = useState<Config>({
    horasMaxConduccion: 8,
    limiteInspecciones: 100,
    alertaFatigaHoras: 4,
    notificacionesActivas: true,
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
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/config", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
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
      setTimeout(() => setSavedOk(false), 3000);
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div>
      <PageHeader
        kicker="Administración"
        title="Configuración municipal"
        subtitle="Parámetros operativos del municipio: horas de conducción, límites de inspección y notificaciones."
      />

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: INK5 }}>Cargando configuración…</div>
      ) : (
        <div style={{ maxWidth: 680, marginTop: 24 }}>
          {error && (
            <div style={{
              marginBottom: 16, padding: "12px 16px", background: ERR_BG,
              border: `1px solid ${ERR_BD}`, borderRadius: 10, color: ERR_C, fontSize: "0.875rem",
            }}>
              {error}
            </div>
          )}

          {savedOk && (
            <div style={{
              marginBottom: 16, padding: "12px 16px", background: APTO_BG,
              border: `1px solid ${APTO_BD}`, borderRadius: 10, color: APTO_C,
              fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Check size={16} />Configuración guardada correctamente.
            </div>
          )}

          {/* Sección: Conducción */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: INK5, marginBottom: 12,
            }}>
              Límites de conducción
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <NumberField
                label="Horas máximas de conducción"
                description="Tiempo máximo diario de conducción antes de marcar fatiga."
                value={config.horasMaxConduccion}
                min={4}
                max={12}
                onChange={(v) => setConfig((c) => ({ ...c, horasMaxConduccion: v }))}
              />
              <NumberField
                label="Alerta de fatiga (horas)"
                description="Hora a partir de la cual se emite alerta preventiva de fatiga."
                value={config.alertaFatigaHoras}
                min={1}
                max={12}
                onChange={(v) => setConfig((c) => ({ ...c, alertaFatigaHoras: v }))}
              />
            </div>
          </div>

          {/* Sección: Inspecciones */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: INK5, marginBottom: 12,
            }}>
              Límites de inspección
            </div>
            <div style={{ padding: 20, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12 }}>
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: INK9, marginBottom: 3 }}>
                Límite mensual de inspecciones
              </div>
              <div style={{ fontSize: "0.8125rem", color: INK5, marginBottom: 14 }}>
                Número máximo de inspecciones que se pueden registrar por mes en este municipio.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={config.limiteInspecciones}
                  onChange={(e) => setConfig((c) => ({ ...c, limiteInspecciones: Math.max(1, Number(e.target.value)) }))}
                  style={{
                    width: 100, height: 40, padding: "0 12px", borderRadius: 8,
                    border: `1.5px solid ${INK2}`, fontSize: "1rem", fontWeight: 700,
                    color: INK9, fontFamily: "inherit", outline: "none",
                    textAlign: "center",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
                />
                <span style={{ fontSize: "0.875rem", color: INK5 }}>inspecciones / mes</span>
              </div>
            </div>
          </div>

          {/* Sección: Notificaciones */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: INK5, marginBottom: 12,
            }}>
              Notificaciones
            </div>
            <div style={{ padding: 20, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: INK9 }}>
                    Notificaciones push activas
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 3 }}>
                    Activa o desactiva las notificaciones push para conductores y operadores de este municipio.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.notificacionesActivas}
                  onClick={() => setConfig((c) => ({ ...c, notificacionesActivas: !c.notificacionesActivas }))}
                  style={{
                    width: 52, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
                    background: config.notificacionesActivas ? "#15803d" : INK2,
                    transition: "background 200ms ease",
                    position: "relative", flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, width: 22, height: 22, borderRadius: "50%",
                    background: "#fff", transition: "left 200ms ease",
                    left: config.notificacionesActivas ? 27 : 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: "0.8125rem", color: config.notificacionesActivas ? APTO_C : INK5, fontWeight: 500 }}>
                {config.notificacionesActivas ? "Las notificaciones están activadas." : "Las notificaciones están desactivadas."}
              </div>
            </div>
          </div>

          {/* Botón guardar */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => void save()}
              disabled={saving}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, height: 42,
                padding: "0 24px", borderRadius: 10, fontSize: "0.9375rem", fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", border: "none",
                background: INK9, color: "#fff", fontFamily: "inherit",
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Save size={16} />
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
            <button
              onClick={() => void load()}
              disabled={loading || saving}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, height: 42,
                padding: "0 20px", borderRadius: 10, fontSize: "0.9375rem", fontWeight: 600,
                cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff",
                color: INK6, fontFamily: "inherit",
              }}
            >
              Descartar cambios
            </button>
          </div>

          {/* Info */}
          <div style={{ marginTop: 24, padding: 14, background: INK1, borderRadius: 10, fontSize: "0.8125rem", color: INK5 }}>
            <Settings size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            Los cambios se aplican de forma inmediata para todos los usuarios del municipio.
          </div>
        </div>
      )}
    </div>
  );
}
