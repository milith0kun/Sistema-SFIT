export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <svg
            className="w-16 h-16 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
            />
          </svg>
        </div>

        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-blue-400">SFIT</span>
        </h1>

        <p className="text-xl text-slate-300 max-w-lg mx-auto">
          Sistema de Fiscalización Inteligente de Transporte
        </p>

        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Plataforma multi-tenant para la fiscalización y gestión del transporte
          y flota vehicular municipal.
        </p>

        <div className="flex gap-4 justify-center mt-8">
          <a
            href="/login"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-blue-600/25"
          >
            Iniciar Sesión
          </a>
          <a
            href="/register"
            className="px-8 py-3 border border-slate-600 hover:border-slate-400 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
          >
            Registrarse
          </a>
        </div>

        <div className="pt-12 grid grid-cols-3 gap-8 text-center max-w-2xl mx-auto">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-blue-400">Multi-Tenant</div>
            <p className="text-sm text-slate-400">
              Una instancia, múltiples municipalidades
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-emerald-400">IA</div>
            <p className="text-sm text-slate-400">
              Extracción automática de documentos
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-amber-400">Tiempo Real</div>
            <p className="text-sm text-slate-400">
              Fiscalización y alertas en vivo
            </p>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs text-slate-500">
        SFIT © 2026 — Plataforma de fiscalización y gestión de flota vehicular municipal
      </footer>
    </main>
  );
}
