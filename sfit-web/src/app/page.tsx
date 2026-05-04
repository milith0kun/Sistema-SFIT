import {
  QrCode,
  Clock,
  MessageSquareWarning,
  Scale,
  FileText,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Lock,
  Users,
  CheckCircle2,
  ChevronRight,
  Server,
  Activity,
  Award,
  Phone,
  CarFront,
  Landmark,
  Map,
  Shield,
  ScanFace,
  Briefcase,
  Mail,
} from "lucide-react";

const FEATURES = [
  {
    n: "01",
    Icon: QrCode,
    title: "Inspección Inteligente QR",
    desc: "Verificación vehicular instantánea mediante código QR firmado. Registro digital de actas en campo con sincronización automática y validez legal.",
  },
  {
    n: "02",
    Icon: Clock,
    title: "Gestión de Fatiga",
    desc: "Control automatizado de horas de conducción según normativa nacional. Alertas preventivas y monitoreo de aptitud para garantizar la seguridad vial.",
  },
  {
    n: "03",
    Icon: MessageSquareWarning,
    title: "Participación Ciudadana",
    desc: "Sistema de reportes geolocalizados para la ciudadanía. Los aportes verificados fortalecen la fiscalización y otorgan incentivos institucionales.",
  },
  {
    n: "04",
    Icon: Scale,
    title: "Trazabilidad Legal",
    desc: "Flujo digital completo para procedimientos de apelación. Transparencia total desde la presentación del administrado hasta la resolución técnica.",
  },
  {
    n: "05",
    Icon: FileText,
    title: "Registro de Sanciones",
    desc: "Base de datos centralizada de infracciones con historial documental inalterable. Exportación de datos analíticos para la toma de decisiones.",
  },
  {
    n: "06",
    Icon: BarChart3,
    title: "Analítica Municipal",
    desc: "Dashboards de indicadores estadísticos en tiempo real: flota operativa, desempeño de inspectores y métricas de cumplimiento por jurisdicción.",
  },
];

const ROLES = [
  { role: "Super Administrador",  desc: "Gestión global de la infraestructura." },
  { role: "Administrador Provincial", desc: "Supervisión regional y coordinación municipal." },
  { role: "Administrador Municipal",  desc: "Control de usuarios y políticas locales." },
  { role: "Fiscal / Inspector",   desc: "Operación de campo y emisión de actas digitales." },
  { role: "Operador de Empresa",  desc: "Gestión de flota y cumplimiento normativo." },
  { role: "Conductor",            desc: "Autoconsulta de aptitud y registro operativo." },
  { role: "Ciudadano",            desc: "Transparencia pública y reportes de seguridad." },
];

const STATS = [
  { n: "50k+", label: "Inspecciones digitales", icon: CheckCircle2 },
  { n: "100%", label: "Trazabilidad legal", icon: ShieldCheck },
  { n: "24/7", label: "Disponibilidad garantizada", icon: Zap },
  { n: "0ms",  label: "Latencia de sincronización", icon: Globe },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white selection:bg-[#8B1414]/10 selection:text-[#8B1414]">

      {/* ── Navigation ─────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 sm:px-6 md:px-10 lg:px-16 py-3 sm:py-4 transition-all duration-300 border-b border-white/[0.06]"
        style={{
          background: "rgba(10, 22, 40, 0.7)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <a href="#" className="flex items-center group transition-transform hover:scale-[0.98] min-w-0 shrink">
          <img
            src="/logo-horizontal.svg"
            alt="SFIT — Sistema de Fiscalización Inteligente del Transporte"
            className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </a>
        <nav className="flex items-center gap-4 sm:gap-6 md:gap-8 shrink-0">
          <a
            href="/login"
            className="inline-flex items-center justify-center px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-[12px] sm:text-[13px] font-semibold hover:bg-white/15 hover:border-white/25 transition-all backdrop-blur-sm active:scale-95 whitespace-nowrap"
          >
            <span className="sm:hidden">Acceso</span>
            <span className="hidden sm:inline">Acceso al Sistema</span>
          </a>
        </nav>
      </header>

      {/* ── Hero Section ────────────────────────── */}
      <section className="relative pt-32 sm:pt-40 md:pt-48 pb-16 sm:pb-24 md:pb-32 overflow-hidden bg-[#0A1628]">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "60px 60px" }}
        />
        {/* Glowing orbs */}
        <div className="absolute -top-[20%] right-[10%] w-[700px] h-[700px] bg-[#8B1414]/20 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-[40%] -left-[15%] w-[500px] h-[500px] bg-[#1E50A0]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-gradient-to-t from-[#8B1414]/8 to-transparent rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-6 items-center pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8">
            
            {/* ── Left Column: Contenido y Acciones ── */}
            <div className="flex flex-col items-start text-left relative z-10">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm mb-4 animate-fade-in max-w-full">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/70 truncate">
                  Plataforma Nacional de Fiscalización Digital
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-white font-bold tracking-tighter mb-4 animate-fade-up leading-[0.95] text-balance"
                  style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)" }}>
                La infraestructura para el <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F87171] via-[#DC2626] to-[#991B1B]">Transporte Municipal</span>
              </h1>

              {/* Subtext */}
              <p className="max-w-xl text-white/60 text-sm sm:text-base md:text-lg leading-relaxed mb-8 animate-fade-up delay-100 font-medium text-balance">
                Transformando la fiscalización vehicular en el Perú mediante tecnología
                de vanguardia para municipalidades modernas y eficientes.
              </p>

              {/* Actions (Minimalistas y adaptables) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10 animate-fade-up delay-150 w-full sm:w-auto">
                <a href="/login"
                   className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white text-[#0A1628] font-bold text-[13px] sm:text-sm hover:bg-[#f4f4f5] hover:-translate-y-1 transition-all shadow-[0_8px_30px_-10px_rgba(255,255,255,0.2)] group active:scale-[0.98]">
                  Acceso Institucional
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="/consulta-publica"
                   className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-bold text-[13px] sm:text-sm hover:bg-white/[0.08] hover:border-white/20 transition-all backdrop-blur-sm active:scale-[0.98]">
                  Consulta Vehicular
                </a>
              </div>

              {/* Badges Institucionales (Alineados a la izquierda) */}
              <div className="w-full pt-6 border-t border-white/[0.08] relative">
                <div className="absolute -top-[1px] left-0 w-24 h-[1px] bg-gradient-to-r from-[#D9B0B0]/50 to-transparent" />
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-[0.25em] mb-3">
                  Operando bajo normativa de
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-default backdrop-blur-sm">
                    <CarFront size={12} className="text-white/40" /> MTC
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-default backdrop-blur-sm">
                    <Landmark size={12} className="text-white/40" /> Municipalidades
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-default backdrop-blur-sm">
                    <Map size={12} className="text-white/40" /> Gobierno Regional
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-default backdrop-blur-sm">
                    <Shield size={12} className="text-[#D9B0B0]/70" /> República del Perú
                  </span>
                </div>
              </div>

            </div>

            {/* ── Right Column: Marca de Agua Gigante ── */}
            <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-full pointer-events-none justify-end items-center overflow-visible z-0">
              {/* Glow Behind Watermark */}
              <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#8B1414]/15 to-blue-500/5 rounded-full blur-[120px] mix-blend-screen" />
              
              {/* Giant Logo */}
              <div className="relative opacity-[0.15] group-hover:opacity-25 transition-opacity duration-1000 transform translate-x-32 scale-110 drop-shadow-[0_0_50px_rgba(255,255,255,0.05)] text-white">
                <SfitMark size={750} invert={true} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Capabilities Bento Grid (Rompemos el blanco con Navy) ────────── */}
      <section className="pt-6 sm:pt-8 md:pt-10 pb-8 sm:pb-10 md:pb-12 bg-[#0A1628] text-white relative overflow-hidden">
        {/* Pattern decorativo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-8 md:mb-10 gap-4 sm:gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 mb-4 sm:mb-6">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#D9B0B0] animate-pulse" />
                 <h2 className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] leading-none pt-px">
                   Ecosistema de Módulos
                 </h2>
              </div>
              <h3 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter leading-[1.05] text-balance">
                Potencia operativa en <br className="hidden sm:block" /> cada nivel de gestión.
              </h3>
            </div>
            <div className="text-white/80 font-medium text-base sm:text-lg max-w-xs leading-relaxed">
              SFIT integra todas las fases de la fiscalización en una plataforma única y trazable.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-6">
            {/* Inspección QR - Grande */}
            <div className="md:col-span-4 bg-white/[0.03] border border-white/10 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 group overflow-hidden relative min-h-[220px] sm:min-h-[260px] flex flex-col justify-between backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500" />
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-4 sm:mb-6 shadow-[0_0_25px_rgba(37,99,235,0.4)] group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-500">
                    <QrCode className="size-5 sm:size-6" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 tracking-tight text-white">Inspección Digital QR</h4>
                  <p className="text-white/70 text-sm leading-relaxed max-w-md font-medium group-hover:text-white/90 transition-colors">Validación instantánea con firma electrónica y geolocalización en tiempo real para inspectores de campo.</p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-white/80 font-bold text-[10px] sm:text-xs uppercase tracking-widest group-hover:gap-4 group-hover:text-white transition-all cursor-pointer w-fit">
                  Explorar módulo <ChevronRight size={16} className="text-[#D9B0B0]" />
                </div>
              </div>
              
              <div className="absolute top-0 right-0 w-full h-full opacity-10 group-hover:opacity-[0.15] transition-opacity duration-500 pointer-events-none translate-x-[5%] translate-y-[5%] flex items-center justify-end text-white pr-4">
                 <QrCode size={200} strokeWidth={1} />
              </div>
            </div>

            {/* Fatiga */}
            <div className="md:col-span-2 bg-white/[0.03] border border-white/10 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 group flex flex-col justify-between backdrop-blur-sm relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-[150px] h-[150px] bg-amber-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-amber-500/20 transition-colors duration-500" />
              <div className="relative z-10">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white mb-4 sm:mb-5 shadow-[0_0_25px_rgba(245,158,11,0.4)] group-hover:scale-110 group-hover:bg-amber-400 transition-all duration-500">
                   <Clock className="size-5 sm:size-6" strokeWidth={2.5} />
                 </div>
                 <h4 className="text-lg sm:text-xl font-bold mb-2 tracking-tight text-white">Gestión de Fatiga</h4>
                 <p className="text-white/70 text-xs sm:text-sm leading-relaxed font-medium group-hover:text-white/90 transition-colors">Monitoreo predictivo de horas de conducción para prevenir accidentes.</p>
              </div>
              <div className="absolute top-0 right-0 w-full h-full opacity-10 group-hover:opacity-[0.15] transition-opacity duration-500 pointer-events-none translate-x-[5%] translate-y-[10%] flex items-center justify-end text-white pr-4">
                 <Clock size={140} strokeWidth={1} />
              </div>
              <div className="mt-4 sm:mt-6 flex items-center gap-2 text-amber-400/80 text-[10px] sm:text-xs font-bold uppercase tracking-widest group-hover:text-amber-400 transition-colors relative z-10 w-fit cursor-pointer">
                Ver más <ArrowRight size={14} />
              </div>
            </div>

            {/* Stats Circular - Visual */}
            <div className="md:col-span-2 bg-gradient-to-br from-[#6C0606] to-[#4A0303] rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xl min-h-[140px] sm:min-h-[160px] relative overflow-hidden group border border-white/5">
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none z-0" />
              
              {/* Giant Shadow Icon */}
              <div className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity duration-500 pointer-events-none flex items-center justify-center text-white overflow-hidden">
                 <Activity size={280} strokeWidth={1} className="group-hover:scale-110 transition-transform duration-700" />
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <Activity className="size-6 sm:size-8 mb-2 sm:mb-3 text-white/90 group-hover:text-white group-hover:scale-110 transition-all duration-500" />
                <div className="text-3xl sm:text-4xl font-black mb-1.5 tracking-tighter text-white drop-shadow-md">99.9%</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">Uptime Garantizado</div>
              </div>
            </div>

            {/* Analítica */}
            <div className="md:col-span-4 bg-white/[0.02] border border-white/10 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8 overflow-hidden relative group backdrop-blur-sm hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300">
              <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/15 transition-colors duration-500" />
              <div className="relative z-10 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white mb-4 sm:mb-5 shadow-[0_0_25px_rgba(79,70,229,0.4)] group-hover:scale-110 group-hover:bg-indigo-500 transition-all duration-500">
                  <BarChart3 className="size-5 sm:size-6" strokeWidth={2.5} />
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3 tracking-tight">Analítica Predictiva</h4>
                <p className="text-white/70 text-xs sm:text-sm leading-relaxed font-medium group-hover:text-white/90 transition-colors">Tome decisiones estratégicas basadas en el rendimiento histórico de la flota y cumplimiento normativo en su jurisdicción.</p>
              </div>
              <div className="flex-1 w-full h-28 sm:h-36 bg-[#0A1628] rounded-[1.25rem] flex items-center justify-center shadow-inner relative overflow-hidden border border-white/5 mt-4 md:mt-0">
                 <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
                 <Database size={70} className="text-white/20 absolute right-2 bottom-2 group-hover:text-white/30 group-hover:rotate-12 group-hover:scale-105 transition-all duration-700" />
                 <div className="flex flex-col items-center gap-1.5 relative z-10 bg-white/[0.03] px-5 py-3 rounded-xl backdrop-blur-sm border border-white/10">
                    <span className="text-white font-black text-xl sm:text-2xl tracking-tighter drop-shadow-md">DATA AI</span>
                    <span className="text-white/60 text-[8px] font-bold uppercase tracking-[0.25em]">Insights Avanzados</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & Compliance (Rompemos el blanco con Gris Institucional) ── */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#fafafa] border-y border-[#E4E4E7] relative overflow-hidden">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/[0.02] rounded-full blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8B1414]/5 border border-[#8B1414]/10 mb-6">
                 <ShieldCheck size={14} className="text-[#8B1414]" />
                 <h2 className="text-[10px] font-bold text-[#8B1414] uppercase tracking-[0.2em] leading-none pt-px">
                   Infraestructura Blindada
                 </h2>
              </div>
              <h3 className="text-3xl sm:text-4xl md:text-4xl font-bold tracking-tight text-[#0A1628] mb-8 leading-[1.1] text-balance">
                Seguridad de grado militar para la fe pública.
              </h3>
              <div className="grid gap-2 sm:gap-4">
                {[
                  { icon: ShieldCheck, title: "Encriptación de Punto a Punto", desc: "Protocolos AES-256 para proteger toda la información institucional y ciudadana." },
                  { icon: Lock, title: "Trazabilidad Inalterable", desc: "Cada movimiento se registra en una cadena de logs inmodificable para auditorías." },
                  { icon: Server, title: "Disponibilidad Geográfica", desc: "Servidores con replicación en tiempo real para servicio 24/7." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 sm:gap-5 p-4 rounded-2xl hover:bg-white hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#E4E4E7]/60 transition-all duration-300 group">
                    <div className="bg-white border border-[#E4E4E7] shadow-sm p-3 rounded-xl text-[#0A1628] h-fit shrink-0 group-hover:bg-[#0A1628] group-hover:text-white group-hover:border-[#0A1628] transition-colors duration-300">
                      <item.icon size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#0A1628] text-[15px] sm:text-base mb-1">{item.title}</h4>
                      <p className="text-[#71717A] text-[13px] sm:text-sm leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Compact ISO Card */}
            <div className="relative flex justify-center lg:justify-end">
               <div className="absolute inset-0 bg-gradient-to-tr from-[#8B1414]/10 to-transparent rounded-full blur-[80px] -z-10" />
               <div className="bg-[#0A1628] rounded-[2rem] w-full max-w-[340px] flex flex-col items-center justify-center text-center p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(10,22,40,0.4)] border border-[#E4E4E7]/20 relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
                  
                  {/* Decorative animated border */}
                  <div className="absolute inset-0 border border-white/10 rounded-[2rem] group-hover:border-white/20 transition-colors duration-700" />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white/[0.05] transition-all duration-700 backdrop-blur-sm">
                       <Award strokeWidth={2} className="size-10 sm:size-12 text-[#D9B0B0]" />
                    </div>
                    <div className="text-white text-3xl sm:text-4xl font-black tracking-tighter mb-3">ISO 27001</div>
                    <p className="text-white/40 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.25em] max-w-[180px] leading-relaxed">Estándar Global de Seguridad</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats (Densidad Visual) ────────────────────────────── */}
      <section className="py-6 sm:py-8 md:py-10 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="group flex flex-col p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] bg-white border border-[#E4E4E7]/60 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 hover:border-[#0A1628]/20 transition-all duration-300">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.25rem] bg-[#fafafa] border border-[#E4E4E7] flex items-center justify-center text-[#0A1628] mb-6 sm:mb-10 group-hover:bg-[#0A1628] group-hover:text-white group-hover:scale-110 transition-all duration-300">
                  <s.icon className="size-6 sm:size-8" strokeWidth={1.5} />
                </div>
                <div className="font-black tracking-tighter text-[#0A1628] mb-2 sm:mb-3" style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)" }}>{s.n}</div>
                <div className="text-[10px] sm:text-[11px] font-bold text-[#71717A] uppercase tracking-[0.2em] sm:tracking-[0.25em]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosistema de Roles (Alternancia de fondo) ─────────────── */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#fafafa] border-t border-[#E4E4E7]/60">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 md:mb-24">
             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1628]/5 border border-[#0A1628]/10 mb-6">
                <Users size={14} className="text-[#0A1628]" />
                <h2 className="text-[10px] font-bold text-[#0A1628] uppercase tracking-[0.2em] leading-none pt-px">
                  Ecosistema Jerárquico
                </h2>
             </div>
            <h3 className="text-[#0A1628] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 sm:mb-8 text-balance leading-[1.05]">
              Una plataforma para <br className="hidden sm:block" /> toda la institución.
            </h3>
            <p className="text-[#71717A] text-base sm:text-lg md:text-xl font-medium leading-relaxed">
              Diseñado estructuralmente para conectar a cada actor del ecosistema de transporte municipal.
            </p>
          </div>

          {/* Contenedor del Carrusel Horizontal */}
          <div className="relative w-full overflow-hidden">
             {/* Gradientes laterales para indicar scroll */}
             <div className="absolute top-0 left-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-[#fafafa] to-transparent z-10 pointer-events-none" />
             <div className="absolute top-0 right-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-[#fafafa] to-transparent z-10 pointer-events-none" />
             
             <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 sm:gap-6 pb-12 pt-4 px-4 sm:px-8 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
               {ROLES.map((r, i) => (
                 <div key={i} className="shrink-0 w-[280px] sm:w-[320px] snap-center group relative p-8 sm:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] bg-white border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_60px_-15px_rgba(10,22,40,0.15)] hover:-translate-y-2 transition-all duration-500 flex flex-col items-center text-center overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#0A1628]/[0.02] rounded-bl-full -z-10 group-hover:bg-[#0A1628]/[0.05] transition-colors duration-500" />
                   <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-[#fafafa] border border-[#E4E4E7] flex items-center justify-center text-[#0A1628] mb-6 sm:mb-8 group-hover:bg-[#0A1628] group-hover:text-white transition-colors duration-300 shadow-sm">
                     <Users className="size-6 sm:size-7" />
                   </div>
                   <span className="text-lg sm:text-xl font-bold text-[#0A1628] mb-3 sm:mb-4 tracking-tight">{r.role}</span>
                   <span className="text-sm sm:text-[15px] text-[#71717A] font-medium leading-relaxed flex-1">{r.desc}</span>
                   <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-[#E4E4E7]/60 w-full opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                      <span className="text-[10px] font-bold text-[#0A1628] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        Módulos Específicos <ArrowRight size={12} />
                      </span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA (Impacto Visual Máximo) ────────────────────────── */}
      <section className="py-8 sm:py-10 md:py-12 bg-white relative">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl relative">
          <div className="bg-[#0A1628] rounded-[2rem] sm:rounded-[2.5rem] p-8 sm:p-10 md:p-12 text-center relative overflow-hidden shadow-[0_30px_80px_-20px_rgba(10,22,40,0.4)]">
            {/* Efectos de fondo internos */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#DC2626]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute inset-0 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="mb-6 sm:mb-8 flex justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] rotate-12 group hover:rotate-0 hover:scale-110 transition-all duration-700 backdrop-blur-md">
                  <SfitMark size={36} invert />
                </div>
              </div>
              <h2 className="text-white font-bold tracking-tight mb-4 sm:mb-6 leading-[1.05] text-balance text-3xl sm:text-4xl md:text-[2.75rem]">
                El futuro de la gestión <br className="hidden sm:block" /> municipal empieza aquí.
              </h2>
              <p className="text-white/60 text-base sm:text-lg md:text-xl mb-8 sm:mb-10 font-medium leading-relaxed text-balance max-w-2xl mx-auto">
                Únase a la red institucional más avanzada del país y transforme su fiscalización hoy mismo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-5">
                <a href="/login"
                   className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white text-[#0A1628] font-bold text-sm sm:text-base hover:bg-[#f4f4f5] hover:scale-105 transition-all shadow-xl shadow-white/5 w-full sm:w-auto active:scale-95 group">
                  Acceder Ahora
                  <ArrowRight className="size-4 sm:size-5 ml-2 group-hover:translate-x-1.5 transition-transform" />
                </a>
                <a href="mailto:soporte@sfit.pe"
                   className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white/[0.05] border border-white/15 text-white font-bold text-sm sm:text-base hover:bg-white/10 hover:border-white/25 hover:scale-105 transition-all backdrop-blur-sm w-full sm:w-auto active:scale-95">
                  Solicitar Información
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (Premium & Completo) ────────────────────────────── */}
      <footer className="py-10 sm:py-12 md:py-16 bg-[#fafafa] border-t border-[#E4E4E7]/60">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 sm:gap-12 md:gap-16 mb-16 sm:mb-20">
            {/* Branding & Contacto */}
            <div className="sm:col-span-2 lg:col-span-2 pr-0 lg:pr-8">
              <div className="flex items-center gap-4 mb-8 sm:mb-10">
                <div className="bg-gradient-to-br from-[#0A1628] to-[#1a2b4c] p-3 rounded-[1.25rem] shadow-[0_8px_20px_-6px_rgba(10,22,40,0.4)] border border-[#0A1628]/10">
                  <SfitMark size={32} invert />
                </div>
                <div className="flex flex-col">
                  <span className="text-[#0A1628] font-black text-xl sm:text-2xl md:text-3xl tracking-[0.2em] uppercase leading-none">SFIT</span>
                  <span className="text-[#8B1414] text-[10px] font-bold tracking-[0.15em] uppercase mt-1.5">Institucional</span>
                </div>
              </div>
              <p className="text-[#71717A] text-[15px] sm:text-base max-w-md leading-relaxed font-medium mb-8">
                Sistema integral de control y fiscalización del transporte público. Optimizando la seguridad vial y la eficiencia municipal en todo el Perú.
              </p>
              
              <div className="flex flex-col gap-4">
                 <a href="mailto:soporte@sfit.pe" className="flex items-center gap-3 text-[#52525B] text-sm hover:text-[#8B1414] transition-colors group w-fit">
                    <div className="w-8 h-8 rounded-full bg-white border border-[#E4E4E7] flex items-center justify-center group-hover:border-[#8B1414]/30 group-hover:bg-[#8B1414]/5 transition-colors">
                      <Mail size={14} className="group-hover:text-[#8B1414]" />
                    </div>
                    <span className="font-bold">soporte@sfit.pe</span>
                 </a>
                 <div className="flex items-center gap-3 text-[#52525B] text-sm group w-fit">
                    <div className="w-8 h-8 rounded-full bg-white border border-[#E4E4E7] flex items-center justify-center">
                      <Phone size={14} />
                    </div>
                    <span className="font-bold">+51 (01) 345-6789</span>
                 </div>
                 <div className="flex items-center gap-3 text-[#52525B] text-sm group w-fit">
                    <div className="w-8 h-8 rounded-full bg-white border border-[#E4E4E7] flex items-center justify-center">
                      <Clock size={14} />
                    </div>
                    <span className="font-bold text-[#71717A]">Soporte técnico 24/7 para autoridades.</span>
                 </div>
              </div>
            </div>

            {/* Plataforma */}
            <div className="lg:col-span-1">
              <h5 className="text-[#0A1628] font-black text-[11px] uppercase tracking-[0.25em] mb-6 sm:mb-8">Plataforma</h5>
              <ul className="space-y-4 sm:space-y-5">
                <li><a href="/login" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Portal Administrativo</a></li>
                <li><a href="/app" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> App Móvil (Fiscales)</a></li>
                <li><a href="/reportes" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Buzón de Denuncias</a></li>
              </ul>
            </div>

            {/* Marco Legal */}
            <div className="lg:col-span-1">
              <h5 className="text-[#0A1628] font-black text-[11px] uppercase tracking-[0.25em] mb-6 sm:mb-8">Marco Legal</h5>
              <ul className="space-y-4 sm:space-y-5">
                <li><a href="/normativa" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Ley Transp. 27181</a></li>
                <li><a href="/directivas" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Resoluciones MTC</a></li>
                <li><a href="/terminos" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Términos de Servicio</a></li>
                <li><a href="/privacidad" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[14px] transition-colors flex items-center gap-2 group"><span className="w-0 overflow-hidden group-hover:w-2 transition-all duration-300 text-[#8B1414]">-</span> Datos Personales</a></li>
              </ul>
            </div>

            {/* Integraciones */}
            <div className="lg:col-span-2">
              <h5 className="text-[#0A1628] font-black text-[11px] uppercase tracking-[0.25em] mb-6 sm:mb-8">Integraciones Oficiales</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                 
                 {/* RENIEC */}
                 <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-white rounded-xl border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-default">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      <ScanFace size={20} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Identidad</span>
                      <span className="text-[#0A1628] font-black text-sm">RENIEC API</span>
                    </div>
                 </div>

                 {/* SUNAT */}
                 <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-white rounded-xl border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-default">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                      <Briefcase size={20} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Tributario</span>
                      <span className="text-[#0A1628] font-black text-sm">SUNAT Online</span>
                    </div>
                 </div>

                 {/* MTC */}
                 <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-white rounded-xl border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-default">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-[#8B1414] group-hover:bg-[#8B1414] group-hover:text-white transition-colors shrink-0">
                      <CarFront size={20} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Vehicular</span>
                      <span className="text-[#0A1628] font-black text-sm">MTC / SUNARP</span>
                    </div>
                 </div>

                 {/* ISO */}
                 <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-white rounded-xl border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-default">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                      <Award size={20} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Seguridad</span>
                      <span className="text-[#0A1628] font-black text-sm">ISO 27001</span>
                    </div>
                 </div>

              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 sm:pt-10 md:pt-12 border-t border-[#E4E4E7]/80 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            <div className="text-[11px] sm:text-xs font-bold text-[#A1A1AA] tracking-[0.25em] uppercase text-center md:text-left">
              © 2026 SFIT · República del Perú
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 px-5 sm:px-8 py-3.5 rounded-full bg-white border border-[#E4E4E7]/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
               <div className="flex items-center gap-2.5">
                 <ShieldCheck size={18} className="text-[#8B1414]" strokeWidth={2} />
                 <span className="text-[10px] sm:text-[11px] font-bold text-[#52525B] uppercase tracking-widest pt-0.5">TLS 1.3 Seguro</span>
               </div>
               <div className="w-px h-5 bg-[#E4E4E7]" />
               <div className="flex items-center gap-2.5">
                 <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2} />
                 <span className="text-[10px] sm:text-[11px] font-bold text-[#52525B] uppercase tracking-widest pt-0.5">Gobierno Digital</span>
               </div>
            </div>
          </div>
        </div>
      </footer>
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
