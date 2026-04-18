const STATS = [
  { value: "7",    label: "Roles de acceso" },
  { value: "19",   label: "Módulos RF" },
  { value: "Multi-tenant", label: "Municipalidades" },
  { value: "Web + App",    label: "Plataformas" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col lg:flex-row overflow-hidden">
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
          className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none"
          aria-hidden
        >
          <img src="/logo.svg" alt="Watermark" width={800} height={800} className="object-contain" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10 xl:px-14 xl:py-12 overflow-y-auto">
          {/* Wordmark */}
          <div className="flex items-center gap-3 animate-fade-in mb-2">
            <SfitMark size={110} color="#B8860B" />
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col my-auto py-4">
            {/* Live badge */}
            <div className="flex items-center gap-2 mb-4 animate-fade-in delay-100">
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
              className="font-black text-white animate-fade-up delay-200"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(2.25rem, 3.8vw, 3.25rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
              }}
            >
              Fiscalización<br />
              <span style={{ color: "#B8860B" }}>Inteligente</span><br />
              de Transporte
            </h1>

            {/* Gold rule */}
            <div
              className="my-5 animate-fade-in delay-300"
              style={{ width: "44px", height: "2.5px", background: "#B8860B", borderRadius: "1px" }}
            />

            {/* Description */}
            <p
              className="animate-fade-up delay-400"
              style={{
                color: "#D4D4D8",
                maxWidth: "340px",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              Gestión integral de flota vehicular, conductores e inspecciones en tiempo real.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-6 animate-fade-up delay-500">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="text-white font-bold mb-1.5"
                    style={{
                      fontFamily: "var(--font-syne)",
                      fontSize: "1.0625rem",
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ color: "#A1A1AA", fontSize: "0.75rem", fontWeight: 500 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* App Link Indicator */}
            <div className="mt-6 animate-fade-up delay-600 flex flex-col gap-3 p-4 rounded-2xl border border-[#B8860B]/20" style={{ background: "linear-gradient(145deg, rgba(184,134,11,0.06) 0%, rgba(10,22,40,0.4) 100%)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
              <p className="text-[#E4E4E7] text-[13px] font-semibold tracking-wide flex items-center gap-2" style={{ fontFamily: "var(--font-syne)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#B8860B] animate-pulse" />
                Descarga la App SFIT Móvil
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                {/* Play Store Badge */}
                <button className="flex items-center gap-2.5 bg-black border border-[#B8860B]/30 hover:border-[#B8860B]/80 hover:shadow-[0_0_12px_rgba(184,134,11,0.2)] transition-all px-3 py-1.5 rounded-lg select-none">
                  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.17 21.66A1.85 1.85 0 013.3 20.2V3.8a1.85 1.85 0 01.87-1.46l10.87 10.87-10.87 8.45z" fill="#00e676"/>
                    <path d="M15.04 14.67l3.67 3.67-2.8 1.62c-1.33.77-2.6 0-2.8-.12l-8.94-5.17z" fill="#ff3d00"/>
                    <path d="M15.04 9.33L4.17 3.03C3.97 2.91 5.24 2.14 6.57 2.91l12.14 7.02z" fill="#ffc400"/>
                    <path d="M18.71 9.93l3.35 1.94c1.1.64 1.1 1.68 0 2.32l-3.35 1.94-3.67-3.67z" fill="#2962ff"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[9px] text-gray-400 leading-none mb-1">DISPONIBLE EN</div>
                    <div className="text-[13px] text-white font-semibold leading-none">Google Play</div>
                  </div>
                </button>

                {/* App Store Badge */}
                <button className="flex items-center gap-2.5 bg-black border border-[#B8860B]/30 hover:border-[#B8860B]/80 hover:shadow-[0_0_12px_rgba(184,134,11,0.2)] transition-all px-3 py-1.5 rounded-lg select-none">
                  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" fill="white">
                    <path d="M16.5 6.5c.8-1 1.3-2.3 1.2-3.6-1.1.1-2.5.6-3.4 1.4-.7.6-1.3 1.9-1.1 3.2 1.2.1 2.5-.5 3.3-1zM17.3 16.8c-.8 2.3-1.6 4.7-4 4.8-1.1 0-1.6-.7-4.1-.7-2.4 0-3 1.3-4.1 1.4-2.1.2-4.5-3.8-5.1-6-1.3-4.2.3-7.5 2.8-9 1.2-.7 2.5-.9 3.8-.9 1.8 0 2.9.7 4.1.7 1.2 0 2.6-.9 4.3-.8 1.4 0 3 .5 4 1.9-3.2 1.8-2.7 6.1.5 7.4-.5 1-1.3 2-2.2 3.2z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[9px] text-gray-400 leading-none mb-1">Consíguelo en el</div>
                    <div className="text-[13px] text-white font-semibold leading-none">App Store</div>
                  </div>
                </button>
              </div>
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
      <main className="flex-1 flex flex-col items-center p-6 sm:p-10 bg-[#fafafa] overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          {/* Mobile brand (inside centered container) */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-10 animate-fade-in">
            <SfitMark size={80} color="#B8860B" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function SfitMark({ size = 32, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="SFIT Logo"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
