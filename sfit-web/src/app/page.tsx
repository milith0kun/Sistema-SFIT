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
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{ background: "#0A1628", paddingTop: "7rem", paddingBottom: "5rem" }}
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
          <div className="flex items-center justify-center gap-2 mb-6">
            <span
              className="w-1.5 h-1.5 rounded-full animate-soft-pulse"
              style={{ background: "#D4A827" }}
              aria-hidden
            />
            <span
              style={{
                color: "#D4A827",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              Plataforma Municipal · Perú 2026
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black text-white mb-6 animate-fade-up delay-100"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
            }}
          >
            La plataforma que{" "}
            <span style={{ color: "#D4A827" }}>unifica</span>
            <br />
            la fiscalización del
            <br />
            transporte municipal
          </h1>

          {/* Gold rule */}
          <div
            className="mx-auto mb-6"
            style={{ width: "44px", height: "2.5px", background: "#D4A827", borderRadius: "1px" }}
          />

          {/* Subtext */}
          <p
            className="mx-auto mb-9 animate-fade-up delay-200"
            style={{
              color: "#E4E4E7",
              fontSize: "1.0625rem",
              lineHeight: 1.55,
              maxWidth: "600px",
              fontWeight: 400,
            }}
          >
            Inspecciones digitales, gestión de flota, conductores y reportes ciudadanos — todo en una sola plataforma multi-tenant para municipalidades del Perú.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 animate-fade-up delay-300">
            <a
              href="/login"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden"
              style={{
                width: "auto",
                minWidth: "200px",
                padding: "0 32px",
                height: "58px",
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                borderRadius: "12px",
                background: "linear-gradient(180deg, #D4A827 0%, #B8860B 100%)",
                color: "#09090b",
                border: "1px solid #E8D090",
                boxShadow: "0 0 0 1px rgba(212,168,39,0.3), 0 10px 30px rgba(184,134,11,0.35)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(212,168,39,0.5), 0 14px 40px rgba(184,134,11,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(212,168,39,0.3), 0 10px 30px rgba(184,134,11,0.35)";
              }}
            >
              Iniciar sesión
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2"
              style={{
                height: "58px",
                minWidth: "200px",
                padding: "0 32px",
                fontSize: "1rem",
                fontWeight: 500,
                letterSpacing: "-0.005em",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                color: "#F4F4F5",
                border: "1.5px solid rgba(255,255,255,0.22)",
                textDecoration: "none",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
              }}
            >
              Solicitar acceso
            </a>
          </div>

          {/* Hint de siguiente paso */}
          <p className="mb-8 animate-fade-up delay-400" style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "0.8125rem",
            fontWeight: 500,
          }}>
            ¿Primera vez? Solicita acceso y el administrador municipal te aprobará.
          </p>

          {/* Chips */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap animate-fade-up delay-400">
            {["7 roles de acceso", "19 módulos RF", "Multi-tenant", "Web + App móvil"].map((chip) => (
              <span
                key={chip}
                className="px-3.5 py-1.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#F4F4F5",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
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
          <div className="mb-16">
            <p className="kicker">
              Capacidades del sistema
            </p>
            <h2
              className="mt-5 font-black text-[#09090b]"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
              }}
            >
              Todo en una plataforma
            </h2>
            <p
              className="mt-5"
              style={{
                color: "#52525b",
                fontSize: "1.0625rem",
                lineHeight: 1.55,
                maxWidth: "560px",
                fontWeight: 400,
              }}
            >
              Módulos integrados que cubren el ciclo completo de fiscalización, desde la salida de flota hasta la resolución de sanciones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="feature-card p-7 rounded-2xl"
                style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
              >
                <div
                  className="font-black text-[#f4f4f5] mb-5 leading-none select-none"
                  style={{ fontFamily: "var(--font-syne)", fontSize: "3.25rem", letterSpacing: "-0.04em" }}
                  aria-hidden
                >
                  {f.n}
                </div>
                <h3
                  className="font-bold text-[#09090b] mb-3"
                  style={{
                    fontFamily: "var(--font-syne)",
                    fontSize: "1.125rem",
                    lineHeight: 1.25,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    color: "#52525b",
                    fontSize: "0.9375rem",
                    lineHeight: 1.55,
                    fontWeight: 400,
                  }}
                >
                  {f.desc}
                </p>
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
          <div className="mb-16">
            <p className="kicker">
              Acceso por rol
            </p>
            <h2
              className="mt-5 font-black text-white"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
              }}
            >
              Para cada actor,{" "}
              <span style={{ color: "#B8860B" }}>la herramienta exacta</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className="p-5 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="w-2 h-2 rounded-full mb-4"
                  style={{ background: "#B8860B" }}
                  aria-hidden
                />
                <div
                  className="font-bold text-white mb-2"
                  style={{
                    fontFamily: "var(--font-syne)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {r.role}
                </div>
                <div
                  style={{
                    color: "#D4D4D8",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                    fontWeight: 400,
                  }}
                >
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────── */}
      <section className="py-24 px-6 md:px-12 text-center" style={{ background: "#f4f4f5" }}>
        <div className="max-w-4xl mx-auto">
          <p className="kicker">
            En cifras
          </p>
          <h2
            className="mt-5 mb-16 font-black text-[#09090b]"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
            }}
          >
            Diseñado para escalar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="font-black text-[#09090b] mb-2 leading-none"
                  style={{ fontFamily: "var(--font-syne)", fontSize: "3rem", letterSpacing: "-0.04em" }}
                >
                  {s.n}
                </div>
                <div style={{ color: "#52525b", fontSize: "0.875rem", fontWeight: 500, letterSpacing: "0.01em" }}>
                  {s.label}
                </div>
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
            className="font-black text-white mb-5"
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
            }}
          >
            ¿Tu municipalidad usa SFIT?
          </h2>
          <p
            className="mb-10 mx-auto"
            style={{
              color: "#E4E4E7",
              fontSize: "1.0625rem",
              lineHeight: 1.55,
              maxWidth: "440px",
              fontWeight: 400,
            }}
          >
            Ingresa con tu cuenta institucional o solicita acceso a tu administrador municipal.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="/login"
              className="btn-primary"
              style={{ width: "auto", padding: "0 34px", height: "54px", fontSize: "1rem" }}
            >
              <span className="shine" aria-hidden />
              Iniciar sesión
            </a>
            <a
              href="/register"
              className="btn-ghost"
              style={{ height: "54px", fontSize: "1rem", padding: "0 34px" }}
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
