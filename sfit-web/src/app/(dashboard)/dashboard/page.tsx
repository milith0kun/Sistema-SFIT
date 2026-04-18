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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="animate-fade-up">
        <h1
          className="text-2xl font-black text-[#18181b]"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-[#71717a] mt-1">
          Vista general del día — módulos en construcción
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className="rounded-xl p-5 animate-fade-up"
            style={{
              background: "#ffffff",
              border: `1.5px solid #e4e4e7`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: m.bg, border: `1px solid ${m.border}` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: m.accent }} />
            </div>
            <div
              className="text-2xl font-black text-[#18181b] leading-none mb-1"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {m.value}
            </div>
            <div className="text-[12px] text-[#71717a]">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div
        className="rounded-xl p-6 animate-fade-up delay-300"
        style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
      >
        <h2
          className="font-bold text-[#18181b] mb-4 text-[15px]"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Módulos del sistema (RF-01 → RF-19)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {MODULES.map((mod, i) => (
            <div
              key={mod}
              className="px-3 py-2 rounded-lg text-[12px] font-medium"
              style={
                i === 0
                  ? {
                      background: "#FDF8EC",
                      border: "1.5px solid #E8D090",
                      color: "#926A09",
                    }
                  : {
                      background: "#f4f4f5",
                      border: "1.5px solid #e4e4e7",
                      color: "#71717a",
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
