const METRICS = [
  { label: "Vehículos activos",   value: "—", accent: "#B8860B", bg: "#FDF8EC", border: "#E8D090" },
  { label: "Conductores APTOS",   value: "—", accent: "#15803d", bg: "#F0FDF4", border: "#86EFAC" },
  { label: "Reportes pendientes", value: "—", accent: "#b45309", bg: "#FFFBEB", border: "#FCD34D" },
  { label: "Sanciones del mes",   value: "—", accent: "#b91c1c", bg: "#FFF5F5", border: "#FCA5A5" },
];

const MODULES = [
  "Autenticación", "Provincias", "Municipalidades", "Tipos vehículo",
  "Empresas", "Conductores", "Vehículos / QR", "Flota Operador",
  "Vista pública", "Rutas / Zonas", "Viajes", "Inspecciones",
  "Reportes ciudadanos", "Sanciones", "FatigueEngine", "Reputación",
  "Gamificación", "IA / OCR", "Notificaciones", "Estadísticas",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="kicker mb-3">Panel general</p>
        <h1
          className="font-black text-[#09090b]"
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "2.25rem",
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
          }}
        >
          Dashboard
        </h1>
        <p
          className="mt-3"
          style={{
            color: "#52525b",
            fontSize: "1rem",
            lineHeight: 1.55,
            fontWeight: 400,
          }}
        >
          Vista general del día — módulos en construcción
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className="rounded-2xl p-6 animate-fade-up"
            style={{
              background: "#ffffff",
              border: "1.5px solid #e4e4e7",
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
              style={{ background: m.bg, border: `1px solid ${m.border}` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: m.accent }} />
            </div>
            <div
              className="font-black text-[#09090b] leading-none mb-2"
              style={{ fontFamily: "var(--font-syne)", fontSize: "2rem", letterSpacing: "-0.03em" }}
            >
              {m.value}
            </div>
            <div style={{ color: "#52525b", fontSize: "0.8125rem", fontWeight: 500 }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div
        className="rounded-2xl p-7 animate-fade-up delay-300"
        style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
      >
        <h2
          className="font-bold text-[#09090b] mb-5"
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "1.125rem",
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
          }}
        >
          Módulos del sistema (RF-01 → RF-19)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {MODULES.map((mod, i) => (
            <div
              key={mod}
              className="px-4 py-2.5 rounded-lg"
              style={
                i === 0
                  ? {
                      background: "#FDF8EC",
                      border: "1.5px solid #E8D090",
                      color: "#926A09",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      letterSpacing: "-0.005em",
                    }
                  : {
                      background: "#f4f4f5",
                      border: "1.5px solid #e4e4e7",
                      color: "#52525b",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }
              }
            >
              {i === 0 ? "✓ " : ""}
              {mod}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
