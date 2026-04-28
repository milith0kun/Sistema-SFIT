import {
  QrCode,
  Clock,
  MessageSquareWarning,
  Scale,
  FileText,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    n: "01",
    Icon: QrCode,
    title: "Inspección mediante código QR",
    desc: "Verificación vehicular con código QR firmado y registro digital del acta de inspección en campo, con sincronización en tiempo real.",
  },
  {
    n: "02",
    Icon: Clock,
    title: "Control de fatiga de conductores",
    desc: "Control automatizado de horas de conducción conforme a la normativa nacional vigente, con alertas preventivas según el estado de aptitud.",
  },
  {
    n: "03",
    Icon: MessageSquareWarning,
    title: "Reportes de la ciudadanía",
    desc: "Recepción de reportes ciudadanos con geolocalización y validación; los aportes verificados otorgan reconocimiento mediante el sistema institucional de incentivos.",
  },
  {
    n: "04",
    Icon: Scale,
    title: "Procedimiento de apelación",
    desc: "Procedimiento formal de apelación con trazabilidad: presentación por el administrado, revisión técnica y resolución por la autoridad municipal competente.",
  },
  {
    n: "05",
    Icon: FileText,
    title: "Registro de sanciones",
    desc: "Registro oficial de infracciones con trazabilidad documental completa y exportación de datos para reportes administrativos.",
  },
  {
    n: "06",
    Icon: BarChart3,
    title: "Indicadores estadísticos",
    desc: "Indicadores estadísticos por municipalidad: inspecciones realizadas, sanciones impuestas, flota operativa y registro de conductores.",
  },
];

const ROLES = [
  { role: "Super Administrador",  desc: "Administración general del sistema" },
  { role: "Administrador Provincial", desc: "Supervisión de municipalidades en la jurisdicción provincial" },
  { role: "Administrador Municipal",  desc: "Autorización de usuarios y configuración de la municipalidad" },
  { role: "Fiscal / Inspector",   desc: "Realización de inspecciones y emisión de actas en campo" },
  { role: "Operador de Empresa",  desc: "Administración de la flota vehicular y registro de salidas" },
  { role: "Conductor",            desc: "Consulta de aptitud y registro de operaciones" },
  { role: "Ciudadano",            desc: "Consulta pública y presentación de reportes" },
];

const STATS = [
  { n: "100+", label: "Vehículos registrados" },
  { n: "7",    label: "Niveles de acceso" },
  { n: "24/7", label: "Monitoreo continuo" },
  { n: "100%", label: "Aislamiento por municipalidad" },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

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
          Acceso al sistema
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
        {/* Primary glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "-200px", left: "8%",
            width: "650px",   height: "650px",
            background: "radial-gradient(circle, rgba(139,20,20,0.18) 0%, transparent 65%)",
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
              style={{ background: "#8B1414" }}
              aria-hidden
            />
            <span
              style={{
                color: "#D9B0B0",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              Sistema de Fiscalización · República del Perú
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-bold text-white mb-6 animate-fade-up delay-100"
            style={{
              fontSize: "clamp(2rem, 5vw, 3.75rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            Sistema Integral de Fiscalización
            <br />
            del <span style={{ color: "#D9B0B0" }}>Transporte Municipal</span>
          </h1>

          {/* Primary rule */}
          <div
            className="mx-auto mb-6"
            style={{ width: "44px", height: "2.5px", background: "#8B1414", borderRadius: "1px" }}
          />

          {/* Subtext */}
          <p
            className="mx-auto mb-9 animate-fade-up delay-200"
            style={{
              color: "#E4E4E7",
              fontSize: "1.0625rem",
              lineHeight: 1.6,
              maxWidth: "640px",
              fontWeight: 400,
            }}
          >
            Plataforma institucional para la fiscalización digital del transporte público, la gestión de la flota vehicular, el control de conductores y la atención de reportes ciudadanos en las municipalidades del Perú.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 animate-fade-up delay-300">
            <a
              href="/login"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden hover:-translate-y-[1px]"
              style={{
                width: "auto",
                minWidth: "200px",
                padding: "0 32px",
                height: "58px",
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                borderRadius: "12px",
                background: "linear-gradient(180deg, #8B1414 0%, #6C0606 100%)",
                color: "#ffffff",
                border: "1px solid #D9B0B0",
                boxShadow: "0 0 0 1px rgba(139,20,20,0.35), 0 10px 30px rgba(108,6,6,0.40)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
                textDecoration: "none",
              }}
            >
              Acceso al sistema
              <ArrowRight
                size={18}
                strokeWidth={2.5}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </a>
            <a
              href="/consulta-publica"
              className="inline-flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/40"
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
            >
              Consulta vehicular pública
            </a>
          </div>

          {/* Hint de siguiente paso */}
          <p className="mb-8 animate-fade-up delay-400" style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.8125rem",
            fontWeight: 500,
          }}>
            Ciudadanía: consulta del estado de habilitación de vehículos mediante el número de placa.
          </p>

          {/* Chips */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap animate-fade-up delay-400">
            {[
              "7 niveles de acceso",
              "19 módulos funcionales",
              "Aislamiento por municipalidad",
              "Plataforma web y móvil",
            ].map((chip) => (
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
              Funcionalidades del sistema
            </p>
            <h2
              className="mt-5 font-bold text-[#09090b]"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              Módulos institucionales
            </h2>
            <p
              className="mt-5"
              style={{
                color: "#52525b",
                fontSize: "1.0625rem",
                lineHeight: 1.6,
                maxWidth: "640px",
                fontWeight: 400,
              }}
            >
              Módulos integrados que comprenden el proceso integral de fiscalización vehicular: desde el registro de salida de la flota hasta la resolución de procedimientos sancionadores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.Icon;
              return (
                <div
                  key={f.n}
                  className="feature-card p-7 rounded-2xl"
                  style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="flex items-center justify-center rounded-xl"
                      style={{
                        width: 44,
                        height: 44,
                        background: "#FBEAEA",
                        border: "1.5px solid #D9B0B0",
                        color: "#6C0606",
                      }}
                      aria-hidden
                    >
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <div
                      className="font-bold leading-none select-none"
                      style={{ fontSize: "0.875rem", letterSpacing: "0.05em", color: "#a1a1aa" }}
                      aria-hidden
                    >
                      {f.n}
                    </div>
                  </div>
                  <h3
                    className="font-bold text-[#09090b] mb-3"
                    style={{
                      fontSize: "1.125rem",
                      lineHeight: 1.3,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      color: "#52525b",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      fontWeight: 400,
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              );
            })}
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
              Estructura de acceso
            </p>
            <h2
              className="mt-5 font-bold text-white"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              Acceso diferenciado{" "}
              <span style={{ color: "#D9B0B0" }}>según nivel de competencia</span>
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
                  style={{ background: "#8B1414" }}
                  aria-hidden
                />
                <div
                  className="font-bold text-white mb-2"
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.3,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {r.role}
                </div>
                <div
                  style={{
                    color: "#D4D4D8",
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
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
            Datos del sistema
          </p>
          <h2
            className="mt-5 mb-16 font-bold text-[#09090b]"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Arquitectura institucional escalable
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="font-bold text-[#09090b] mb-2 leading-none"
                  style={{ fontSize: "clamp(2.25rem, 5vw, 3rem)", letterSpacing: "-0.03em" }}
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
            background: "radial-gradient(circle, rgba(139,20,20,0.10) 0%, transparent 65%)",
          }}
        />
        <div className="relative z-10 max-w-xl mx-auto">
          <div
            className="w-10 h-10 mx-auto mb-7 flex items-center justify-center rounded-lg"
            style={{ border: "1.5px solid rgba(139,20,20,0.55)", background: "rgba(108,6,6,0.12)" }}
          >
            <SfitMark size={22} />
          </div>
          <h2
            className="font-bold text-white mb-5"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Implementación institucional
          </h2>
          <p
            className="mb-10 mx-auto"
            style={{
              color: "#E4E4E7",
              fontSize: "1.0625rem",
              lineHeight: 1.6,
              maxWidth: "480px",
              fontWeight: 400,
            }}
          >
            Para implementar el sistema en su municipalidad, comuníquese con la administración. Si su municipalidad ya cuenta con acceso, ingrese con sus credenciales institucionales.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/login"
              className="btn-primary"
              style={{ width: "auto", padding: "0 34px", height: "54px", fontSize: "1rem" }}
            >
              <span className="shine" aria-hidden />
              Acceso al sistema
            </a>
            <a
              href="mailto:184193@unsaac.edu.pe?subject=Implementación SFIT en mi municipalidad"
              className="inline-flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/40"
              style={{
                height: "54px",
                padding: "0 34px",
                fontSize: "1rem",
                fontWeight: 500,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
                color: "#F4F4F5",
                border: "1.5px solid rgba(255,255,255,0.22)",
                textDecoration: "none",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              Solicitar información
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer
        className="px-6 md:px-12 py-6"
        style={{ background: "#09090b", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SfitMark size={18} />
            <span
              className="text-[12px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "rgba(255,255,255,0.32)" }}
            >
              SFIT
            </span>
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <a href="/consulta-publica" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none" }}
              className="hover:text-white transition-colors">Consulta pública</a>
            <a href="/privacidad" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none" }}
              className="hover:text-white transition-colors">Privacidad</a>
            <a href="/terminos" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none" }}
              className="hover:text-white transition-colors">Términos</a>
          </div>
          <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.16)" }}>
            © 2026 SFIT · República del Perú
          </p>
        </div>
      </footer>
    </div>
  );
}

function SfitMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt="SFIT"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
