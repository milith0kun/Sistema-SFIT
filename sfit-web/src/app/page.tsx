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
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 transition-all duration-300 border-b border-[#E4E4E7]/50"
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <a href="#" className="flex items-center gap-3 group transition-transform hover:scale-[0.98]">
          <div className="bg-[#0A1628] p-2 rounded-xl shadow-lg shadow-black/10">
            <SfitMark size={32} invert />
          </div>
          <div className="flex flex-col">
            <span className="text-[#0A1628] font-black text-lg tracking-[0.2em] uppercase leading-none">SFIT</span>
            <span className="text-[#8B1414] text-[8px] font-bold tracking-[0.1em] uppercase mt-0.5">Institucional</span>
          </div>
        </a>
        <nav className="flex items-center gap-8">
          <a
            href="/consulta-publica"
            className="hidden md:block text-[13px] font-bold text-[#52525B] hover:text-[#0A1628] transition-colors uppercase tracking-widest"
          >
            Consulta Pública
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#0A1628] text-white text-[13px] font-bold hover:bg-[#111F38] transition-all shadow-xl shadow-black/10 active:scale-95"
          >
            Acceso al Sistema
          </a>
        </nav>
      </header>

      {/* ── Hero Section ────────────────────────── */}
      <section className="relative pt-48 pb-32 overflow-hidden bg-gradient-to-b from-[#fafafa] to-white">
        {/* Subtle background patterns */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: "radial-gradient(#0A1628 1px, transparent 1px)", backgroundSize: "48px 48px" }} 
        />
        <div className="absolute -top-[10%] -right-[5%] w-[800px] h-[800px] bg-[#8B1414]/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-[30%] -left-[10%] w-[600px] h-[600px] bg-[#1E50A0]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 max-w-7xl">
          <div className="flex flex-col items-center text-center">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-[#E4E4E7] shadow-sm mb-10 animate-fade-in">
              <span className="flex h-2 w-2 rounded-full bg-[#8B1414] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717A]">
                Plataforma Nacional de Fiscalización Digital
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[#0A1628] font-bold tracking-tighter mb-8 animate-fade-up leading-[0.95]"
                style={{ fontSize: "clamp(3rem, 8vw, 5.5rem)" }}>
              La infraestructura para el <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B1414] via-[#6C0606] to-[#4A0303]">Transporte Municipal</span>
            </h1>

            {/* Subtext */}
            <p className="max-w-2xl text-[#52525B] text-xl md:text-2xl leading-relaxed mb-14 animate-fade-up delay-100 font-medium text-balance">
              Transformando la fiscalización vehicular en el Perú mediante tecnología 
              de vanguardia para municipalidades modernas y eficientes.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-24 animate-fade-up delay-150">
              <a href="/login" 
                 className="inline-flex items-center justify-center gap-3 px-12 py-5 rounded-2xl bg-[#0A1628] text-white font-bold text-xl hover:bg-[#111F38] hover:-translate-y-1 transition-all shadow-2xl shadow-[#0A1628]/20 group">
                Acceso Institucional
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="/consulta-publica" 
                 className="inline-flex items-center justify-center gap-3 px-12 py-5 rounded-2xl bg-white border-2 border-[#E4E4E7] text-[#0A1628] font-bold text-xl hover:bg-[#f4f4f5] hover:border-[#D4D4D8] transition-all">
                Consulta Vehicular
              </a>
            </div>

            {/* Trusted By / Institutional Bar */}
            <div className="w-full max-w-5xl py-8 border-y border-[#E4E4E7]/60 animate-fade-up delay-200">
              <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-[0.3em] mb-6">Operando bajo normativa de</p>
              <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-40 grayscale contrast-125">
                <span className="text-2xl font-black tracking-tighter text-[#0A1628]">MINISTERIO</span>
                <span className="text-2xl font-black tracking-tighter text-[#0A1628]">MUNICIPALIDAD</span>
                <span className="text-2xl font-black tracking-tighter text-[#0A1628]">GOBIERNO</span>
                <span className="text-2xl font-black tracking-tighter text-[#0A1628]">PERÚ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities Bento Grid (Rompemos el blanco con Navy) ────────── */}
      <section className="py-32 bg-[#0A1628] text-white relative overflow-hidden">
        {/* Pattern decorativo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8">
            <div className="max-w-3xl">
              <h2 className="text-[0.7rem] font-black text-[#D9B0B0] uppercase tracking-[0.4em] mb-6">
                Ecosistema de Módulos
              </h2>
              <h3 className="text-5xl md:text-6xl font-bold tracking-tighter leading-[1.05]">
                Potencia operativa en <br /> cada nivel de gestión.
              </h3>
            </div>
            <div className="text-white/50 font-medium text-lg max-w-xs leading-relaxed">
              SFIT integra todas las fases de la fiscalización en una plataforma única y trazable.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Inspección QR - Grande */}
            <div className="md:col-span-4 bg-white/5 border border-white/10 rounded-[2.5rem] p-12 hover:bg-white/[0.08] transition-all group overflow-hidden relative min-h-[400px] flex flex-col justify-between">
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-10">
                  <QrCode size={40} />
                </div>
                <h4 className="text-4xl font-bold mb-6 tracking-tight">Inspección Digital QR</h4>
                <p className="text-white/60 text-xl leading-relaxed max-w-md font-medium">Validación instantánea con firma electrónica y geolocalización en tiempo real para inspectores de campo.</p>
              </div>
              <div className="absolute top-0 right-0 w-full h-full opacity-[0.05] pointer-events-none translate-x-1/4 -translate-y-1/4">
                 <QrCode size={600} strokeWidth={1} />
              </div>
              <div className="relative z-10 mt-10 flex items-center gap-3 text-white font-bold text-sm uppercase tracking-widest group-hover:gap-6 transition-all cursor-pointer">
                Ver detalles del módulo <ChevronRight size={20} />
              </div>
            </div>

            {/* Fatiga */}
            <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-10 hover:bg-white/[0.08] transition-all group flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-8">
                <Clock size={32} />
              </div>
              <h4 className="text-2xl font-bold mb-4 tracking-tight">Gestión de Fatiga</h4>
              <p className="text-white/50 leading-relaxed font-medium">Monitoreo predictivo de horas de conducción para prevenir accidentes y garantizar seguridad.</p>
            </div>

            {/* Stats Circular - Visual */}
            <div className="md:col-span-2 bg-gradient-to-br from-[#8B1414] to-[#4A0303] rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center shadow-2xl">
              <Activity size={48} className="mb-6 text-white animate-pulse" />
              <div className="text-5xl font-black mb-2 tracking-tighter">99.9%</div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">Uptime Garantizado</div>
            </div>

            {/* Analítica */}
            <div className="md:col-span-4 bg-[#fafafa] rounded-[2.5rem] p-12 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative group">
              <div className="relative z-10 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-8">
                  <BarChart3 size={32} />
                </div>
                <h4 className="text-3xl font-bold text-[#0A1628] mb-4 tracking-tight">Analítica Predictiva</h4>
                <p className="text-[#52525B] text-lg leading-relaxed font-medium">Tome decisiones estratégicas basadas en el rendimiento histórico de la flota y cumplimiento normativo.</p>
              </div>
              <div className="flex-1 w-full h-56 bg-gradient-to-tr from-[#0A1628] to-[#1E50A0] rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden">
                 <Database size={80} className="text-white opacity-20 absolute -right-4 -bottom-4 group-hover:rotate-12 transition-transform duration-500" />
                 <div className="flex flex-col items-center gap-2">
                    <span className="text-white font-black text-5xl tracking-tighter">DATA AI</span>
                    <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">Insights Avanzados</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & Compliance (Rompemos el blanco con Gris Institucional) ── */}
      <section className="py-32 bg-[#fafafa] border-y border-[#E4E4E7] relative">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div>
              <h2 className="text-[0.7rem] font-black text-[#8B1414] uppercase tracking-[0.4em] mb-6">
                Infraestructura Blindada
              </h2>
              <h3 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0A1628] mb-10 leading-[1.1]">
                Seguridad de grado <br /> militar para la fe pública.
              </h3>
              <div className="grid gap-8">
                {[
                  { icon: ShieldCheck, title: "Encriptación de Punto a Punto", desc: "Protocolos AES-256 para proteger toda la información institucional y ciudadana." },
                  { icon: Lock, title: "Trazabilidad Inalterable", desc: "Cada movimiento del sistema se registra en una cadena de logs inmodificable para auditorías." },
                  { icon: Server, title: "Disponibilidad Geográfica", desc: "Servidores con replicación en tiempo real para garantizar el servicio 24/7 sin interrupciones." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 p-6 rounded-2xl bg-white border border-[#E4E4E7] shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-[#8B1414]/5 p-3 rounded-xl text-[#8B1414] h-fit">
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#0A1628] text-lg mb-2">{item.title}</h4>
                      <p className="text-[#71717A] text-[15px] leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
               <div className="absolute inset-0 bg-[#8B1414]/5 rounded-full blur-[100px] -z-10" />
               <div className="bg-[#0A1628] rounded-[3.5rem] aspect-square flex flex-col items-center justify-center text-center p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-white/10 relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity">
                     <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
                  </div>
                  <Award size={120} strokeWidth={1} className="text-[#D9B0B0] mb-10 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                  <div className="text-white text-5xl font-black tracking-tighter mb-4 relative z-10">ISO 27001</div>
                  <p className="text-white/40 font-bold text-xs uppercase tracking-[0.3em] relative z-10">Basado en Estándares de Seguridad de la Información</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats (Densidad Visual) ────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="group flex flex-col p-10 rounded-[2.5rem] bg-[#fafafa] border border-[#E4E4E7] hover:border-[#8B1414]/40 transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-lg shadow-black/5 flex items-center justify-center text-[#8B1414] mb-8 group-hover:scale-110 transition-transform">
                  <s.icon size={28} />
                </div>
                <div className="text-6xl font-black tracking-tighter text-[#0A1628] mb-3 group-hover:text-[#8B1414] transition-colors">{s.n}</div>
                <div className="text-xs font-black text-[#A1A1AA] uppercase tracking-[0.3em]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosistema de Roles (Alternancia de fondo) ─────────────── */}
      <section className="py-32 bg-[#fafafa] border-t border-[#E4E4E7]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-24">
            <h3 className="text-[#0A1628] text-5xl md:text-6xl font-bold tracking-tighter mb-8">
              Una plataforma para <br /> toda la institución.
            </h3>
            <p className="text-[#71717A] text-xl font-medium leading-relaxed">
              Diseñado jerárquicamente para conectar a cada actor del ecosistema de transporte municipal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROLES.map((r, i) => (
              <div key={i} className="group relative p-10 rounded-[2.5rem] bg-white border border-[#E4E4E7] shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#0A1628]/5 flex items-center justify-center text-[#0A1628] mb-8 group-hover:bg-[#0A1628] group-hover:text-white transition-all">
                  <Users size={28} />
                </div>
                <span className="text-xl font-black text-[#0A1628] mb-4 tracking-tight">{r.role}</span>
                <span className="text-[15px] text-[#71717A] font-medium leading-relaxed">{r.desc}</span>
                <div className="mt-8 pt-8 border-t border-[#E4E4E7] w-full opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[10px] font-black text-[#8B1414] uppercase tracking-widest">Módulos Específicos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA (Impacto Visual Máximo) ────────────────────────── */}
      <section className="py-32 bg-white relative">
        <div className="container mx-auto px-6 max-w-7xl relative">
          <div className="bg-[#0A1628] rounded-[4rem] p-16 md:p-32 text-center relative overflow-hidden shadow-[0_48px_80px_-16px_rgba(0,0,0,0.4)]">
            {/* Efectos de fondo internos */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#8B1414]/30 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-20 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-4xl mx-auto">
              <div className="mb-14 flex justify-center">
                <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-tr from-[#8B1414] to-[#4A0303] flex items-center justify-center shadow-2xl shadow-[#8B1414]/40 rotate-12 group hover:rotate-0 transition-transform duration-700">
                  <SfitMark size={48} invert />
                </div>
              </div>
              <h2 className="text-white text-5xl md:text-8xl font-bold tracking-tighter mb-12 leading-[1] text-balance">
                El futuro de la gestión <br /> municipal empieza aquí.
              </h2>
              <p className="text-white/60 text-xl md:text-3xl mb-16 font-medium leading-relaxed text-balance">
                Únase a la red institucional más avanzada del país y transforme su fiscalización hoy mismo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <a href="/login" 
                   className="inline-flex items-center justify-center px-14 py-6 rounded-[1.5rem] bg-white text-[#0A1628] font-black text-2xl hover:bg-[#f4f4f5] transition-all shadow-2xl w-full sm:w-auto active:scale-95 group">
                  Acceder Ahora
                  <ArrowRight size={28} className="ml-2 group-hover:translate-x-2 transition-transform" />
                </a>
                <a href="mailto:184193@unsaac.edu.pe" 
                   className="inline-flex items-center justify-center px-14 py-6 rounded-[1.5rem] border-2 border-white/20 text-white font-bold text-2xl hover:bg-white/5 transition-all w-full sm:w-auto">
                  Solicitar Información
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (Premium & Completo) ────────────────────────────── */}
      <footer className="py-24 bg-[#fafafa] border-t border-[#E4E4E7]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-20 mb-24">
            <div className="md:col-span-3">
              <div className="flex items-center gap-4 mb-10">
                <div className="bg-[#0A1628] p-2.5 rounded-2xl shadow-xl">
                  <SfitMark size={32} invert />
                </div>
                <div className="flex flex-col">
                  <span className="text-[#0A1628] font-black text-2xl tracking-[0.2em] uppercase leading-none">SFIT</span>
                  <span className="text-[#8B1414] text-[9px] font-bold tracking-[0.1em] uppercase mt-1">Institucional</span>
                </div>
              </div>
              <p className="text-[#71717A] text-xl max-w-md leading-relaxed font-medium">
                La plataforma definitiva para la modernización del transporte público y la fiscalización inteligente en el Perú.
              </p>
            </div>
            <div className="md:col-span-1">
              <h5 className="text-[#0A1628] font-black text-xs uppercase tracking-[0.3em] mb-10">Solución</h5>
              <ul className="space-y-6">
                <li><a href="/consulta-publica" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Consulta Pública</a></li>
                <li><a href="/login" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Acceso Institucional</a></li>
                <li><a href="/registro" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Solicitar Acceso</a></li>
              </ul>
            </div>
            <div className="md:col-span-1">
              <h5 className="text-[#0A1628] font-black text-xs uppercase tracking-[0.3em] mb-10">Institucional</h5>
              <ul className="space-y-6">
                <li><a href="/normativa" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Base Legal</a></li>
                <li><a href="/noticias" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Actualizaciones</a></li>
                <li><a href="/manual" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Guías de Usuario</a></li>
              </ul>
            </div>
            <div className="md:col-span-1">
              <h5 className="text-[#0A1628] font-black text-xs uppercase tracking-[0.3em] mb-10">Legal</h5>
              <ul className="space-y-6">
                <li><a href="/privacidad" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Privacidad</a></li>
                <li><a href="/terminos" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Términos</a></li>
                <li><a href="/seguridad" className="text-[#71717A] hover:text-[#0A1628] font-bold text-[15px] transition-colors">Seguridad</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-16 border-t border-[#E4E4E7] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-sm font-black text-[#A1A1AA] tracking-[0.3em] uppercase">
              © 2026 SFIT · República del Perú
            </div>
            <div className="flex items-center gap-8 px-8 py-3 rounded-full bg-white border border-[#E4E4E7] shadow-sm">
               <div className="flex items-center gap-3">
                 <ShieldCheck size={20} className="text-[#8B1414]" />
                 <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-widest">TLS 1.3 Seguro</span>
               </div>
               <div className="w-px h-4 bg-[#E4E4E7]" />
               <div className="flex items-center gap-3">
                 <CheckCircle2 size={20} className="text-emerald-500" />
                 <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-widest">Sistemas Operativos</span>
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
