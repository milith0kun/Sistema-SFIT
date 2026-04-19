"use client";

import { useState, useRef } from "react";

/* ─── Tipos ─────────────────────────────────────────────────────── */
type IndicadorColor = "verde" | "amarillo" | "rojo";

interface VehicleResult {
  vehicle: {
    plate: string;
    brand: string;
    model: string;
    year: number;
    vehicleTypeKey: string;
    status: string;
    company: string | null;
    lastInspectionStatus: string;
    reputationScore: number;
    indicator: IndicadorColor;
  };
  driver: {
    name: string;
    licenseCategory: string;
    fatigueStatus: string;
    reputationScore: number;
    enabled: boolean;
  } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  activo:           "Activo",
  en_mantenimiento: "En mantenimiento",
  fuera_de_servicio:"Fuera de servicio",
  inactivo:         "Inactivo",
};

const INSPECTION_LABELS: Record<string, string> = {
  aprobada:  "Aprobada",
  rechazada: "Rechazada",
  observada: "Con observaciones",
  pendiente: "Sin inspección reciente",
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  bus:        "Bus",
  minibus:    "Minibús",
  combi:      "Combi",
  taxi:       "Taxi",
  mototaxi:   "Mototaxi",
  camion:     "Camión",
};

const INDICATOR_CONFIG: Record<IndicadorColor, { label: string; color: string; bg: string; border: string }> = {
  verde:    { label: "Habilitado",      color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  amarillo: { label: "Con observaciones", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  rojo:     { label: "No habilitado",   color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};

/* ─── Componente ─────────────────────────────────────────────────── */
export default function ConsultaPublicaPage() {
  const [plate, setPlate]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<VehicleResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = plate.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(false);

    try {
      const res = await fetch(`/api/public/vehiculo?plate=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Vehículo no encontrado en el sistema SFIT.");
        setSearched(true);
      } else {
        setResult(json.data ?? json);
        setSearched(true);
      }
    } catch {
      setError("Error de conexión. Intente nuevamente.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  const ind = result ? INDICATOR_CONFIG[result.vehicle.indicator] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <header style={{
        background: "#0A1628",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src="/logo.svg" alt="SFIT" width={22} height={22} style={{ objectFit: "contain" }} />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-syne)" }}>
            SFIT
          </span>
        </a>
        <a
          href="/login"
          style={{
            height: "36px",
            padding: "0 18px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#F4F4F5",
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Ingresar al panel
        </a>
      </header>

      {/* ── Hero búsqueda ── */}
      <section style={{
        background: "linear-gradient(180deg, #0A1628 0%, #111F38 100%)",
        padding: "48px 24px 56px",
        textAlign: "center",
      }}>
        <p style={{ color: "#B8860B", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px" }}>
          Consulta pública · SFIT
        </p>
        <h1 style={{
          color: "#ffffff",
          fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: "10px",
          fontFamily: "var(--font-syne)",
        }}>
          Verificación de vehículos
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "1rem", lineHeight: 1.6, maxWidth: "460px", margin: "0 auto 32px" }}>
          Consulta el estado de habilitación, última inspección y conductor de cualquier vehículo ingresando su placa.
        </p>

        {/* ── Formulario ── */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", maxWidth: "520px", margin: "0 auto" }}>
          <input
            ref={inputRef}
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="Ej: ABC-123"
            maxLength={10}
            autoFocus
            style={{
              flex: "1 1 220px",
              height: "54px",
              padding: "0 20px",
              borderRadius: "10px",
              border: "1.5px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.07)",
              color: "#ffffff",
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              outline: "none",
              fontFamily: "var(--font-inter), Inter, monospace",
            }}
          />
          <button
            type="submit"
            disabled={loading || !plate.trim()}
            style={{
              height: "54px",
              padding: "0 28px",
              borderRadius: "10px",
              background: loading ? "#926A09" : "linear-gradient(180deg, #D4A827 0%, #B8860B 100%)",
              color: "#09090b",
              fontSize: "1rem",
              fontWeight: 700,
              border: "1px solid #E8D090",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: !plate.trim() ? 0.5 : 1,
              transition: "opacity 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>
      </section>

      {/* ── Resultados ── */}
      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px 64px" }}>

        {/* No encontrado */}
        {searched && error && (
          <div style={{
            background: "#fff",
            border: "1.5px solid #e4e4e7",
            borderRadius: "16px",
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🔍</div>
            <h2 style={{ color: "#18181b", fontWeight: 700, fontSize: "1.25rem", marginBottom: "8px" }}>
              Vehículo no encontrado
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.9375rem", lineHeight: 1.6 }}>
              {error.includes("no encontrado") || error.includes("not found")
                ? "Vehículo no encontrado en el sistema SFIT. Verifica la placa e intenta nuevamente."
                : error}
            </p>
            <button
              onClick={() => { setError(null); setSearched(false); setPlate(""); inputRef.current?.focus(); }}
              style={{
                marginTop: "24px",
                height: "40px",
                padding: "0 20px",
                borderRadius: "8px",
                border: "1.5px solid #e4e4e7",
                background: "#fff",
                color: "#3f3f46",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nueva consulta
            </button>
          </div>
        )}

        {/* Resultado encontrado */}
        {result && ind && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Card principal vehículo */}
            <div style={{
              background: "#fff",
              border: "1.5px solid #e4e4e7",
              borderRadius: "16px",
              overflow: "hidden",
            }}>
              {/* Header card */}
              <div style={{
                background: "#0A1628",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
                    Placa registrada
                  </p>
                  <p style={{ color: "#D4A827", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "0.12em", fontFamily: "var(--font-syne)", lineHeight: 1 }}>
                    {result.vehicle.plate}
                  </p>
                </div>
                <div style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  background: ind.bg,
                  border: `1.5px solid ${ind.border}`,
                  color: ind.color,
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                }}>
                  {ind.label}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
                  <InfoField label="Marca" value={result.vehicle.brand} />
                  <InfoField label="Modelo" value={result.vehicle.model} />
                  <InfoField label="Año" value={String(result.vehicle.year)} />
                  <InfoField label="Tipo de vehículo" value={VEHICLE_TYPE_LABELS[result.vehicle.vehicleTypeKey] ?? result.vehicle.vehicleTypeKey} />
                  <InfoField label="Estado operativo" value={STATUS_LABELS[result.vehicle.status] ?? result.vehicle.status} />
                  {result.vehicle.company && (
                    <InfoField label="Empresa" value={result.vehicle.company} />
                  )}
                </div>

                {/* Última inspección */}
                <div style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#fafafa",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}>
                  <div>
                    <p style={{ color: "#71717a", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                      Última inspección
                    </p>
                    <p style={{ color: "#18181b", fontWeight: 600, fontSize: "1rem" }}>
                      {INSPECTION_LABELS[result.vehicle.lastInspectionStatus] ?? result.vehicle.lastInspectionStatus}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#71717a", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                      Puntaje de reputación
                    </p>
                    <p style={{
                      fontWeight: 800,
                      fontSize: "1.25rem",
                      fontFamily: "var(--font-syne)",
                      color: result.vehicle.reputationScore >= 75 ? "#15803d" : result.vehicle.reputationScore >= 50 ? "#b45309" : "#b91c1c",
                    }}>
                      {result.vehicle.reputationScore} / 100
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card conductor */}
            {result.driver ? (
              <div style={{
                background: "#fff",
                border: "1.5px solid #e4e4e7",
                borderRadius: "16px",
                padding: "20px 24px",
              }}>
                <p style={{ color: "#71717a", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>
                  Conductor asignado
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
                  <InfoField label="Nombre" value={result.driver.name} />
                  <InfoField label="Categoría de licencia" value={result.driver.licenseCategory} />
                  <InfoField
                    label="Estado de fatiga"
                    value={result.driver.fatigueStatus === "apto" ? "Apto" : result.driver.fatigueStatus === "en_riesgo" ? "En riesgo" : "No apto"}
                    highlight={result.driver.fatigueStatus === "apto" ? "green" : result.driver.fatigueStatus === "en_riesgo" ? "amber" : "red"}
                  />
                  <InfoField
                    label="Habilitado"
                    value={result.driver.enabled ? "Sí" : "No"}
                    highlight={result.driver.enabled ? "green" : "red"}
                  />
                </div>
              </div>
            ) : (
              <div style={{
                background: "#fff",
                border: "1.5px solid #e4e4e7",
                borderRadius: "16px",
                padding: "20px 24px",
                textAlign: "center",
                color: "#a1a1aa",
                fontSize: "0.9375rem",
              }}>
                Sin conductor asignado actualmente.
              </div>
            )}

            {/* Nueva consulta */}
            <div style={{ textAlign: "center", paddingTop: "8px" }}>
              <button
                onClick={() => { setResult(null); setSearched(false); setPlate(""); inputRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{
                  height: "40px",
                  padding: "0 24px",
                  borderRadius: "8px",
                  border: "1.5px solid #e4e4e7",
                  background: "#fff",
                  color: "#3f3f46",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Nueva consulta
              </button>
            </div>
          </div>
        )}

        {/* Estado inicial */}
        {!searched && !loading && (
          <div style={{ textAlign: "center", color: "#a1a1aa", paddingTop: "16px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🚌</div>
            <p style={{ fontSize: "0.9375rem" }}>Ingresa la placa del vehículo para consultar su estado.</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        background: "#09090b",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "20px 24px",
        textAlign: "center",
        color: "rgba(255,255,255,0.2)",
        fontSize: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
          <span>© 2026 SFIT — Sistema de Fiscalización Inteligente de Transporte</span>
          <a href="/privacidad" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Privacidad</a>
          <a href="/terminos" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Términos</a>
          <a href="/" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Inicio</a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-componente ─────────────────────────────────────────────── */
function InfoField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "amber" | "red";
}) {
  const valueColor = highlight === "green" ? "#15803d" : highlight === "amber" ? "#b45309" : highlight === "red" ? "#b91c1c" : "#18181b";
  return (
    <div>
      <p style={{ color: "#71717a", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
        {label}
      </p>
      <p style={{ color: valueColor, fontWeight: 600, fontSize: "0.9375rem" }}>
        {value}
      </p>
    </div>
  );
}
