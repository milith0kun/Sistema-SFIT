const FEATURES = [
  {
    n: "01",
    title: "Flota en tiempo real",
    desc: "Monitoreo de salidas, rutas y estado vehicular. Toda la flota municipal visible desde un único panel.",
  },
  {
    n: "02",
    title: "Inspecciones digitales",
    desc: "Actas electrónicas con firma digital, evidencia fotográfica y trazabilidad completa.",
  },
  {
    n: "03",
    title: "Gestión de conductores",
    desc: "Estado de aptitud, monitoreo de fatiga, historial de infracciones y seguimiento de licencias.",
  },
  {
    n: "04",
    title: "Reportes ciudadanos",
    desc: "Canal directo para que la ciudadanía reporte anomalías con geolocalización y seguimiento.",
  },
  {
    n: "05",
    title: "IA y OCR documental",
    desc: "Extracción automática de datos en licencias, SOAT, tarjetas de propiedad y documentos vehiculares.",
  },
  {
    n: "06",
    title: "Multi-tenant",
    desc: "Aislamiento total por municipalidad. Una sola instancia, datos completamente separados.",
  },
];

const ROLES = [
  { role: "Super Administrador",  desc: "Configuración global del sistema" },
  { role: "Admin Provincial",     desc: "Gestión de municipalidades en la provincia" },
  { role: "Admin Municipal",      desc: "Aprobación de usuarios y configuración local" },
  { role: "Fiscal / Inspector",   desc: "Inspecciones de campo y actas digitales" },
  { role: "Operador de Empresa",  desc: "Gestión de flota y salidas diarias" },
  { role: "Conductor",            desc: "Estado de aptitud y registro de viajes" },
  { role: "Ciudadano",            desc: "Consultas y reporte de anomalías" },
];

const STATS = [
  { n: "7",    label: "Roles de acceso" },
  { n: "19",   label: "Módulos RF" },
  { n: "100%", label: "Aislamiento por tenant" },
  { n: "15m",  label: "Duración del access token" },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>

      {/* ── Nav fijo ─────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4"
        style={{
          background: "rgba(10,22,40,0.88)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <SfitMark size={24} />
          <span
            className="text-white font-bold text-[14px] tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            SFIT
          </span>
        </div>
        <a
          href="/login"
          className="btn-primary"
          style={{ height: "38px", fontSize: "13px", padding: "0 18px", width: "auto" }}
        >
          <span className="shine" aria-hidden />
          Iniciar sesión
        </a>
      </header>

      {/* ── Hero ─────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center min-h-screen px-6 pt-24 pb-20"
        style={{ background: "#0A1628" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.042) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Gold glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "-200px", left: "8%",
            width: "650px",   height: "650px",
            background: "radial-gradient(circle, rgba(184,134,11,0.09) 0%, transparent 65%)",
          }}
        />
        {/* Blue glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-100px", right: "5%",
            width: "440px", height: "440px",
            background: "radial-gradient(circle, rgba(30,80,160,0.18) 0%, transparent 65%)",
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto animate-fade-in">
          {/* Live badge */}
          <div className="flex items-center justify-center gap-2 mb-7">
            <span
              className="w-1.5 h-1.5 rounded-full animate-soft-pulse"
              style={{ background: "#B8860B" }}
              aria-hidden
            />
            <span
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: "#B8860B" }}
            >
              Plataforma Municipal · Perú 2026
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black text-white leading-[1.05] tracking-tight mb-6 animate-fade-up delay-100"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(2.5rem, 5.5vw, 4.2rem)",
            }}
          >
            La plataforma que{" "}
            <span style={{ color: "#B8860B" }}>unifica</span>
            <br />
            la fiscalización del
            <br />
            transporte municipal
          </h1>

          {/* Gold rule */}
          <div
            className="mx-auto mb-6"
            style={{ width: "36px", height: "2px", background: "#B8860B", borderRadius: "1px" }}
          />

          {/* Subtext */}
          <p
            className="text-base leading-relaxed mb-10 max-w-xl mx-auto animate-fade-up delay-200"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Inspecciones digitales, gestión de flota, conductores y reportes ciudadanos — todo en una sola plataforma multi-tenant para municipalidades del Perú.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mb-10 animate-fade-up delay-300">
            <a
              href="/login"
              className="btn-primary"
              style={{ width: "auto", padding: "0 32px", height: "48px", fontSize: "15px" }}
            >
              <span className="shine" aria-hidden />
              Iniciar sesión
            </a>
            <a
              href="/register"
              className="btn-ghost"
              style={{ height: "48px", fontSize: "15px", padding: "0 32px" }}
            >
              Solicitar acceso
            </a>
          </div>

          {/* Chips */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap animate-fade-up delay-400">
            {["7 roles de acceso", "19 módulos RF", "Multi-tenant", "Web + App móvil"].map((chip) => (
              <span
                key={chip}
                className="px-3 py-1 rounded-full text-[12px] font-medium"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────── */}
      <section className="py-24 px-6 md:px-12" style={{ background: "#fafafa" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <p
              className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-3"
              style={{ color: "#B8860B" }}
            >
              Capacidades del sistema
            </p>
            <h2
              className="font-black text-[#18181b] leading-tight"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              }}
            >
              Todo en una plataforma
            </h2>
            <p className="mt-3 text-[#71717a] text-sm max-w-lg">
              Módulos integrados que cubren el ciclo completo de fiscalización, desde la salida de flota hasta la resolución de sanciones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="feature-card p-6 rounded-xl"
                style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
              >
                <div
                  className="font-black text-[#f4f4f5] mb-4 leading-none select-none"
                  style={{ fontFamily: "var(--font-syne)", fontSize: "2.8rem" }}
                  aria-hidden
                >
                  {f.n}
                </div>
                <h3
                  className="font-bold text-[#18181b] text-[15px] mb-2 leading-snug"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {f.title}
                </h3>
                <p className="text-[13px] text-[#71717a] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────── */}
      <section
        className="relative py-24 px-6 md:px-12"
        style={{ background: "#0A1628" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="mb-14">
            <p
              className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-3"
              style={{ color: "#B8860B" }}
            >
              Acceso por rol
            </p>
            <h2
              className="font-black text-white leading-tight"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              }}
            >
              Para cada actor,{" "}
              <span style={{ color: "#B8860B" }}>la herramienta exacta</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className="p-4 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mb-3"
                  style={{ background: "#B8860B" }}
                  aria-hidden
                />
                <div
                  className="font-semibold text-white text-[13px] mb-1 leading-snug"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {r.role}
                </div>
                <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────── */}
      <section className="py-20 px-6 md:px-12 text-center" style={{ background: "#f4f4f5" }}>
        <div className="max-w-4xl mx-auto">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-3"
            style={{ color: "#B8860B" }}
          >
            En cifras
          </p>
          <h2
            className="font-black text-[#18181b] mb-14 leading-tight"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
            }}
          >
            Diseñado para escalar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="font-black text-[#18181b] mb-1.5 leading-none"
                  style={{ fontFamily: "var(--font-syne)", fontSize: "2.5rem" }}
                >
                  {s.n}
                </div>
                <div className="text-[12px] text-[#71717a]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────── */}
      <section
        className="py-24 px-6 text-center relative"
        style={{ background: "#0A1628", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "500px", height: "500px",
            background: "radial-gradient(circle, rgba(184,134,11,0.07) 0%, transparent 65%)",
          }}
        />
        <div className="relative z-10 max-w-xl mx-auto">
          <div
            className="w-10 h-10 mx-auto mb-7 flex items-center justify-center rounded-lg"
            style={{ border: "1.5px solid rgba(184,134,11,0.5)", background: "rgba(184,134,11,0.08)" }}
          >
            <SfitMark size={22} />
          </div>
          <h2
            className="font-black text-white mb-4 leading-tight"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
            }}
          >
            ¿Tu municipalidad usa SFIT?
          </h2>
          <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Ingresa con tu cuenta institucional o solicita acceso a tu administrador municipal.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="/login"
              className="btn-primary"
              style={{ width: "auto", padding: "0 32px", height: "48px", fontSize: "15px" }}
            >
              <span className="shine" aria-hidden />
              Iniciar sesión
            </a>
            <a
              href="/register"
              className="btn-ghost"
              style={{ height: "48px", fontSize: "15px", padding: "0 32px" }}
            >
              Solicitar acceso
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer
        className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 md:px-12 py-5"
        style={{ background: "#09090b", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <SfitMark size={18} />
          <span
            className="text-[12px] font-bold tracking-[0.16em] uppercase"
            style={{ color: "rgba(255,255,255,0.32)", fontFamily: "var(--font-syne)" }}
          >
            SFIT
          </span>
        </div>
        <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.16)" }}>
          © 2026 — Plataforma de fiscalización y gestión de flota vehicular municipal
        </p>
      </footer>
    </div>
  );
}

function SfitMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3L29 16L16 29L3 16Z" stroke="#B8860B" strokeWidth="1.5" />
      <path d="M16 9.5L22.5 16L16 22.5L9.5 16Z" fill="#B8860B" />
    </svg>
  );
}
