const STATS = [
  { value: "7",    label: "Roles de acceso" },
  { value: "19",   label: "Módulos RF" },
  { value: "Multi-tenant", label: "Municipalidades" },
  { value: "Web + App",    label: "Plataformas" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col relative overflow-hidden"
        style={{ background: "#0A1628" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.045) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Gold ambient — bottom-left */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "-200px", left: "-120px",
            width: "580px",   height: "580px",
            background: "radial-gradient(circle, rgba(184,134,11,0.11) 0%, transparent 65%)",
          }}
        />
        {/* Blue ambient — top-right */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-120px", right: "-120px",
            width: "380px", height: "380px",
            background: "radial-gradient(circle, rgba(30,80,160,0.22) 0%, transparent 65%)",
          }}
        />
        {/* Large SFIT watermark */}
        <div
          className="absolute inset-0 flex items-end justify-end pb-10 pr-6 pointer-events-none select-none"
          aria-hidden
        >
          <span
            className="font-black text-white"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(100px, 16vw, 180px)",
              opacity: 0.018,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            SFIT
          </span>
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10 xl:px-14 xl:py-12">
          {/* Wordmark */}
          <div className="flex items-center gap-3 animate-fade-in">
            <SfitMark size={30} color="#B8860B" />
            <span
              className="text-white font-bold text-[15px] tracking-[0.2em] uppercase"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              SFIT
            </span>
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col justify-center">
            {/* Live badge */}
            <div className="flex items-center gap-2 mb-7 animate-fade-in delay-100">
              <span
                className="w-1.5 h-1.5 rounded-full animate-soft-pulse"
                style={{ background: "#B8860B" }}
                aria-hidden
              />
              <span
                className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: "#B8860B" }}
              >
                Plataforma Municipal · Perú
              </span>
            </div>

            {/* Heading */}
            <h1
              className="font-black text-white leading-[1.05] tracking-tight animate-fade-up delay-200"
              style={{ fontFamily: "var(--font-syne)", fontSize: "clamp(2rem, 3.2vw, 2.75rem)" }}
            >
              Fiscalización<br />
              <span style={{ color: "#B8860B" }}>Inteligente</span><br />
              de Transporte
            </h1>

            {/* Gold rule */}
            <div
              className="my-6 animate-fade-in delay-300"
              style={{ width: "36px", height: "2px", background: "#B8860B", borderRadius: "1px" }}
            />

            {/* Description */}
            <p
              className="text-sm leading-relaxed animate-fade-up delay-400"
              style={{ color: "rgba(255,255,255,0.36)", maxWidth: "272px" }}
            >
              Gestión integral de flota vehicular, conductores e inspecciones en tiempo real.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2.5 mt-9 animate-fade-up delay-500">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div
                    className="text-white font-bold leading-none mb-1"
                    style={{ fontFamily: "var(--font-syne)", fontSize: "16px" }}
                  >
                    {s.value}
                  </div>
                  <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p
            className="text-[11px] animate-fade-in delay-600"
            style={{ color: "rgba(255,255,255,0.16)" }}
          >
            © 2026 SFIT — Sistema Municipal de Transporte
          </p>
        </div>
      </aside>

      {/* ── Right panel ─────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-[#fafafa]">
        {/* Mobile brand */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10 animate-fade-in">
          <SfitMark size={26} color="#B8860B" />
          <span
            className="font-bold text-[15px] tracking-[0.2em] uppercase text-[#18181b]"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            SFIT
          </span>
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}

function SfitMark({ size = 32, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3L29 16L16 29L3 16Z" stroke={color} strokeWidth="1.5" />
      <path d="M16 9.5L22.5 16L16 22.5L9.5 16Z" fill={color} />
    </svg>
  );
}
