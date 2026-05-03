import { ShieldCheck, Smartphone, Zap, Globe, Apple, Layers, BarChart3, MapPin } from "lucide-react";

const FEATURES = [
  { icon: ShieldCheck, title: "Seguridad multinivel", desc: "7 roles con permisos granulares y JWT" },
  { icon: Layers,      title: "19 módulos integrados", desc: "Desde inspecciones hasta gamificación" },
  { icon: MapPin,      title: "Cobertura territorial", desc: "Multi-municipalidad con aislamiento de datos" },
  { icon: BarChart3,   title: "Analítica en tiempo real", desc: "Dashboards, KPIs y reportería avanzada" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-white selection:bg-[#8B1414]/10 selection:text-[#8B1414] lg:overflow-hidden">

      {/* ── Panel Izquierdo (Institucional) ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[45%] xl:w-[42%] bg-[#0A1628] relative flex-col overflow-hidden h-full">
        {/* Patrones de fondo sutiles */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "32px 32px" }} 
        />
        <div className="absolute -bottom-[10%] -left-[10%] w-[600px] h-[600px] bg-[#8B1414]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[10%] -right-[10%] w-[400px] h-[400px] bg-[#1E50A0]/10 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Marca de agua sutil — visible como sombra de fondo */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.15] pointer-events-none select-none">
          <img src="/logo.svg" alt="" width={700} height={700} className="object-contain blur-[0.5px] drop-shadow-[0_0_60px_rgba(139,20,20,0.3)]" />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10 xl:px-16 xl:py-12">
          {/* Logo institucional */}
          <div className="flex items-center mb-10 animate-fade-in shrink-0">
            <img
              src="/logo-horizontal.svg"
              alt="SFIT — Sistema de Fiscalización Inteligente del Transporte"
              className="h-14 xl:h-16 2xl:h-20 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-y-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6 w-fit animate-fade-up shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#8B1414] animate-pulse" />
              <span className="text-[11px] font-bold text-[#D9B0B0] uppercase tracking-[0.15em]">
                Sistema de Fiscalización · Perú
              </span>
            </div>

            {/* Heading Principal */}
            <h1 className="text-white font-bold tracking-tight mb-6 leading-[1.1] animate-fade-up delay-100 shrink-0"
                style={{ fontSize: "clamp(2.25rem, 4vw, 3.25rem)" }}>
              Gestión inteligente del <span className="text-[#D9B0B0]">Transporte Municipal.</span>
            </h1>

            {/* Descripción */}
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-md animate-fade-up delay-200 font-medium shrink-0">
              Acceda a la infraestructura digital centralizada para el control operativo y seguridad vial.
            </p>

            {/* Características del sistema */}
            <div className="flex flex-col gap-3 mb-8 animate-fade-up delay-300 shrink-0">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3.5 group">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#8B1414]/20 group-hover:border-[#8B1414]/30 transition-all">
                    <f.icon size={16} className="text-[#D9B0B0] group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white leading-tight tracking-[-0.005em]">{f.title}</div>
                    <div className="text-[11px] text-white/40 leading-snug mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Descargar App — sin tarjeta, botones directos */}
            <div className="animate-fade-up delay-400 shrink-0">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest mb-3">Disponible en móvil</p>
              <div className="flex flex-wrap gap-3">
                <a href="https://play.google.com/store/apps/details?id=com.sfit.sfit_app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white/[0.06] px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all">
                  <PlayStoreIcon />
                  <div className="text-left">
                    <div className="text-[8px] text-white/40 uppercase tracking-tight leading-none mb-1">Disponible en</div>
                    <div className="text-[12px] text-white font-semibold leading-none">Google Play</div>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-3 bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5 opacity-40 cursor-default">
                  <Apple size={18} className="text-white/70" />
                  <div className="text-left">
                    <div className="text-[8px] text-white/40 uppercase tracking-tight leading-none mb-1">Próximamente</div>
                    <div className="text-[12px] text-white/70 font-semibold leading-none">App Store</div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Footer del panel */}
          <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/5 animate-fade-in delay-500 shrink-0">
            <span className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em]">Seguridad Institucional AES-256</span>
            <span className="text-[10px] font-medium text-white/20 uppercase tracking-[0.12em]">© 2026 SFIT</span>
          </div>
        </div>
      </aside>

      {/* ── Panel Derecho (Formulario) ─────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-[#fafafa] relative lg:h-full">
        {/* Header móvil */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E4E4E7] bg-white shrink-0">
          <img
            src="/logo-horizontal.svg"
            alt="SFIT — Sistema de Fiscalización Inteligente del Transporte"
            className="h-10 sm:h-12 md:h-14 w-auto object-contain"
          />
          <span className="text-[9px] sm:text-[10px] font-bold text-[#71717A] uppercase tracking-widest px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#f4f4f5] border border-[#E4E4E7] whitespace-nowrap">Acceso Seguro</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 md:px-14 lg:px-20 py-8 sm:py-10 lg:py-12 overflow-y-auto">
          {/* Form wrapper centrado vertical y horizontalmente */}
          <div className="w-full max-w-[380px] sm:max-w-[420px] lg:max-w-[480px] animate-fade-in flex flex-col lg:bg-white lg:rounded-2xl lg:border lg:border-[#E4E4E7]/60 lg:shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:px-10 lg:py-10 xl:px-12 xl:py-12">
            {children}
          </div>
        </div>

        {/* Footer móvil */}
        <footer className="lg:hidden px-4 py-4 sm:py-5 text-center border-t border-[#E4E4E7] shrink-0">
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-[0.2em]">
            © 2026 SFIT · República del Perú
          </p>
        </footer>
      </main>
    </div>
  );
}

function SfitMark({ size = 32, invert = false }: { size?: number, invert?: boolean }) {
  return (
    <img
      src={invert ? "/logo-mark.svg" : "/logo.svg"}
      alt="SFIT"
      width={size}
      height={size}
      className={`object-contain ${invert ? "brightness-0 invert" : ""}`}
    />
  );
}

function PlayStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.17 21.66A1.85 1.85 0 013.3 20.2V3.8a1.85 1.85 0 01.87-1.46l10.87 10.87-10.87 8.45z" fill="#00e676"/>
      <path d="M15.04 14.67l3.67 3.67-2.8 1.62c-1.33.77-2.6 0-2.8-.12l-8.94-5.17z" fill="#ff3d00"/>
      <path d="M15.04 9.33L4.17 3.03C3.97 2.91 5.24 2.14 6.57 2.91l12.14 7.02z" fill="#ffc400"/>
      <path d="M18.71 9.93l3.35 1.94c1.1.64 1.1 1.68 0 2.32l-3.35 1.94-3.67-3.67z" fill="#2962ff"/>
    </svg>
  );
}
