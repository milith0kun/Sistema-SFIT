/** RF-19-01: Dashboard del Admin Municipal — métricas del día por tipo de vehículo. */
export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div>
        <h1
          className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Vista general del día — módulos en construcción
        </p>
      </div>

      {/* Métricas placeholder */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vehículos activos", value: "—", color: "bg-blue-500", icon: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3" },
          { label: "Conductores APTOS", value: "—", color: "bg-emerald-500", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
          { label: "Reportes pendientes", value: "—", color: "bg-amber-500", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
          { label: "Sanciones del mes", value: "—", color: "bg-red-500", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-white dark:bg-[var(--color-dark-surface)] rounded-2xl p-5 border border-[var(--color-border)] dark:border-[var(--color-dark-border)] shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 ${metric.color} bg-opacity-15 rounded-xl flex items-center justify-center`}>
                <svg className={`w-4 h-4 ${metric.color.replace("bg-", "text-")}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={metric.icon} />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]">
              {metric.value}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              {metric.label}
            </div>
          </div>
        ))}
      </div>

      {/* Módulos */}
      <div className="bg-white dark:bg-[var(--color-dark-surface)] rounded-2xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-6">
        <h2 className="font-semibold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-4" style={{ fontFamily: "var(--font-syne)" }}>
          Módulos del sistema (RF-01 → RF-19)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            "Autenticación", "Provincias", "Municipalidades", "Tipos vehículo",
            "Empresas", "Conductores", "Vehículos / QR", "Flota Operador",
            "Vista pública", "Rutas / Zonas", "Viajes", "Inspecciones",
            "Reportes ciudadanos", "Sanciones", "FatigueEngine", "Reputación",
            "Gamificación", "IA / OCR", "Notificaciones", "Estadísticas",
          ].map((mod, i) => (
            <div
              key={mod}
              className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                i === 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                  : "bg-[var(--color-surface-alt)] dark:bg-white/5 border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              {i === 0 ? "✓ " : ""}{mod}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
