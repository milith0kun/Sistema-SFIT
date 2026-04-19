import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Reference — SFIT",
  description: "Documentación de la API REST del Sistema de Fiscalización Inteligente de Transporte.",
};

interface EndpointDef {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  roles?: string;
  tag: string;
}

const METHOD_COLORS: Record<EndpointDef["method"], string> = {
  GET:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  POST:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PATCH:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  PUT:    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const ENDPOINTS: EndpointDef[] = [
  // Auth
  { method: "POST",   path: "/api/auth/login",          description: "Iniciar sesión con credenciales (email + password)", auth: false, tag: "Autenticación" },
  { method: "POST",   path: "/api/auth/register",       description: "Registrar nueva cuenta. Estado inicial: pendiente",   auth: false, tag: "Autenticación" },
  { method: "POST",   path: "/api/auth/google",         description: "Iniciar sesión con Google OAuth (ID Token)",          auth: false, tag: "Autenticación" },
  { method: "POST",   path: "/api/auth/refresh",        description: "Renovar access token usando el refresh token",        auth: false, tag: "Autenticación" },
  { method: "POST",   path: "/api/auth/logout",         description: "Invalidar la sesión activa",                          auth: true,  tag: "Autenticación" },
  // Inspecciones
  { method: "GET",    path: "/api/inspecciones",        description: "Listar inspecciones vehiculares (paginado)",          auth: true,  roles: "fiscal, admin_municipal, super_admin", tag: "Inspecciones" },
  { method: "POST",   path: "/api/inspecciones",        description: "Crear inspección vehicular. Dispara webhook inspection.created", auth: true, roles: "fiscal, admin_municipal, super_admin", tag: "Inspecciones" },
  { method: "GET",    path: "/api/inspecciones/{id}",   description: "Obtener detalle de una inspección",                  auth: true,  tag: "Inspecciones" },
  // Reportes
  { method: "GET",    path: "/api/reportes",            description: "Listar reportes ciudadanos con conteo por estado",    auth: true,  roles: "fiscal, admin_municipal, super_admin", tag: "Reportes Ciudadanos" },
  { method: "POST",   path: "/api/reportes",            description: "Enviar reporte ciudadano (otorga 5 SFITCoins)",       auth: true,  roles: "ciudadano", tag: "Reportes Ciudadanos" },
  { method: "GET",    path: "/api/reportes/{id}",       description: "Obtener detalle de un reporte",                      auth: true,  tag: "Reportes Ciudadanos" },
  { method: "PATCH",  path: "/api/reportes/{id}",       description: "Actualizar estado del reporte. Si pasa a validado dispara webhook report.validated y otorga 20 SFITCoins", auth: true, roles: "fiscal, admin_municipal", tag: "Reportes Ciudadanos" },
  // Apelaciones
  { method: "GET",    path: "/api/apelaciones",         description: "Listar apelaciones de sanciones",                    auth: true,  roles: "conductor, fiscal, admin_municipal", tag: "Apelaciones" },
  { method: "POST",   path: "/api/apelaciones",         description: "Presentar apelación contra una sanción",             auth: true,  roles: "conductor", tag: "Apelaciones" },
  { method: "PATCH",  path: "/api/apelaciones/{id}",    description: "Resolver apelación (aprobada / rechazada)",          auth: true,  roles: "admin_municipal, super_admin", tag: "Apelaciones" },
  // Flota
  { method: "GET",    path: "/api/flota",               description: "Listar asignaciones conductor-vehículo",             auth: true,  roles: "operador, admin_municipal", tag: "Flota" },
  { method: "POST",   path: "/api/flota",               description: "Registrar asignación de flota",                      auth: true,  roles: "operador, admin_municipal", tag: "Flota" },
  // Conductor / Fatiga
  { method: "GET",    path: "/api/conductor/fatiga",    description: "Estado de fatiga del conductor autenticado (apto / riesgo / no_apto)", auth: true, roles: "conductor", tag: "Conductor" },
  // Ciudadano / Coins
  { method: "GET",    path: "/api/ciudadano/coins",     description: "Saldo e historial de SFITCoins del ciudadano",       auth: true,  roles: "ciudadano", tag: "SFITCoins" },
  // Webhooks
  { method: "GET",    path: "/api/admin/webhooks",      description: "Listar webhooks del municipio (secret oculto)",      auth: true,  roles: "admin_municipal, super_admin", tag: "Webhooks" },
  { method: "POST",   path: "/api/admin/webhooks",      description: "Crear webhook. Devuelve el secret una sola vez",     auth: true,  roles: "admin_municipal, super_admin", tag: "Webhooks" },
  { method: "DELETE", path: "/api/admin/webhooks/{id}", description: "Eliminar webhook por ID",                           auth: true,  roles: "admin_municipal, super_admin", tag: "Webhooks" },
  // Sistema
  { method: "GET",    path: "/api/health",              description: "Health check: estado de MongoDB, Firebase y OCR",    auth: false, tag: "Sistema" },
  { method: "GET",    path: "/api/docs",                description: "Especificación OpenAPI 3.0 en formato JSON",         auth: false, tag: "Sistema" },
];

// Agrupar por tag
const TAGS = Array.from(new Set(ENDPOINTS.map((e) => e.tag)));

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold font-[--font-syne] text-gray-900 dark:text-white">
              SFIT
            </span>
            <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-mono">
              v1.5.0
            </span>
          </div>
          <h1 className="text-3xl font-bold font-[--font-syne] text-gray-900 dark:text-white mb-2">
            API Reference
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            API REST del Sistema de Fiscalización Inteligente de Transporte. Multi-tenant:
            la mayoría de endpoints operan sobre la municipalidad implícita del token JWT.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-3 py-1.5 text-gray-700 dark:text-gray-300">
              Base URL: <code className="font-mono">/api</code>
            </div>
            <div className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-3 py-1.5 text-gray-700 dark:text-gray-300">
              Auth: <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>
            </div>
            <Link
              href="/api/docs"
              target="_blank"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 transition-colors"
            >
              Descargar OpenAPI JSON
            </Link>
          </div>
        </div>

        {/* Notas generales */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8 text-sm text-amber-800 dark:text-amber-300">
          <strong>Autenticación:</strong> Todos los endpoints marcados con{" "}
          <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">SI</span> requieren
          el header <code className="font-mono">Authorization: Bearer &lt;access_token&gt;</code>. El token
          se obtiene en <code className="font-mono">/api/auth/login</code> o <code className="font-mono">/api/auth/google</code>.
        </div>

        {/* Tabla por sección */}
        {TAGS.map((tag) => {
          const endpoints = ENDPOINTS.filter((e) => e.tag === tag);
          return (
            <section key={tag} className="mb-10">
              <h2 className="text-lg font-semibold font-[--font-syne] text-gray-800 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-800">
                {tag}
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="text-left px-4 py-3 w-20">Método</th>
                      <th className="text-left px-4 py-3">Endpoint</th>
                      <th className="text-left px-4 py-3">Descripción</th>
                      <th className="text-center px-4 py-3 w-16">Auth</th>
                      <th className="text-left px-4 py-3">Roles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {endpoints.map((ep, i) => (
                      <tr
                        key={i}
                        className="bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block font-mono font-semibold text-xs px-2 py-0.5 rounded ${METHOD_COLORS[ep.method]}`}
                          >
                            {ep.method}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                            {ep.path}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {ep.description}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ep.auth ? (
                            <span className="text-xs font-semibold text-green-700 dark:text-green-400">SI</span>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">NO</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ep.roles ? (
                            <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                              {ep.roles}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {/* Webhooks note */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-5 mb-8 text-sm text-gray-700 dark:text-gray-300">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Verificación de Webhooks</h3>
          <p className="mb-2">
            Cada petición de webhook incluye el header{" "}
            <code className="font-mono bg-gray-200 dark:bg-gray-800 px-1 rounded">X-SFIT-Signature: sha256=&lt;hmac&gt;</code>.
          </p>
          <p>
            Para verificar: <code className="font-mono bg-gray-200 dark:bg-gray-800 px-1 rounded">
              HMAC-SHA256(secret, body)
            </code> debe coincidir con el valor del header. El body es el JSON completo de la petición.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-600 pt-6 border-t border-gray-200 dark:border-gray-800">
          SFIT API v1.5.0 — Sistema de Fiscalización Inteligente de Transporte
        </div>
      </div>
    </main>
  );
}
