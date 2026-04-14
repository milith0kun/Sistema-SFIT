export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — marca SFIT */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col relative overflow-hidden bg-[var(--color-navy)]">
        {/* Patrón de líneas diagonales */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              #ffffff 0,
              #ffffff 1px,
              transparent 0,
              transparent 50%
            )`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Forma geométrica decorativa */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-[var(--color-primary-light)] opacity-8 blur-2xl" />

        {/* Contenido */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg shadow-blue-900/40">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <circle cx="7" cy="17" r="1" />
                <circle cx="17" cy="17" r="1" />
              </svg>
            </div>
            <span
              className="text-white font-bold text-xl tracking-wide"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              SFIT
            </span>
          </div>

          {/* Central content */}
          <div className="flex-1 flex flex-col justify-center mt-16">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-light)] animate-pulse" />
                <span className="text-white/60 text-xs font-medium tracking-wider uppercase">
                  Plataforma Municipal
                </span>
              </div>

              <h1
                className="text-4xl xl:text-5xl font-bold text-white leading-tight"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Fiscalización
                <br />
                <span className="text-[var(--color-primary-light)]">
                  Inteligente
                </span>
              </h1>

              <p className="text-white/50 text-base leading-relaxed max-w-xs">
                Gestión integral de flota vehicular y fiscalización municipal
                en tiempo real.
              </p>
            </div>

            {/* Stats */}
            <div className="mt-14 grid grid-cols-2 gap-4">
              {[
                { label: "Municipalidades", value: "Multi-tenant" },
                { label: "Roles", value: "7 niveles" },
                { label: "Módulos", value: "19 RF" },
                { label: "Plataforma", value: "Web + Móvil" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/5 border border-white/8 p-4"
                >
                  <div
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "var(--font-syne)" }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/25 text-xs">
            SFIT © 2026 — Plataforma municipal de transporte
          </p>
        </div>
      </aside>

      {/* Panel derecho — formulario */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-[var(--color-surface-alt)] dark:bg-[var(--color-dark-bg)]">
        {/* Logo móvil */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          </div>
          <span
            className="text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] font-bold text-lg"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            SFIT
          </span>
        </div>

        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
