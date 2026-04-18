"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
  status?: string;
};

type NavItem = { href: string; label: string; d: string; roles: string[] };

/** Menú completo; cada item declara qué roles pueden verlo. */
const NAV: NavItem[] = [
  { href: "/dashboard",      label: "Dashboard",            d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  { href: "/admin/users",    label: "Aprobaciones",         d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/municipalidades",label: "Municipalidades",      d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", roles: ["super_admin","admin_provincial"] },
  { href: "/tipos-vehiculo", label: "Tipos de vehículo",    d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4", roles: ["admin_municipal"] },
  { href: "/empresas",       label: "Empresas",             d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", roles: ["admin_municipal"] },
  { href: "/conductores",    label: "Conductores",          d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", roles: ["admin_municipal","operador","fiscal"] },
  { href: "/vehiculos",      label: "Vehículos / QR",       d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4", roles: ["admin_municipal","operador","fiscal"] },
  { href: "/flota",          label: "Flota del día",        d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", roles: ["operador"] },
  { href: "/rutas",          label: "Rutas y zonas",        d: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3", roles: ["admin_municipal","operador","fiscal"] },
  { href: "/viajes",         label: "Viajes",               d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", roles: ["admin_municipal","operador","fiscal"] },
  { href: "/inspecciones",   label: "Inspecciones",         d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", roles: ["admin_municipal","fiscal"] },
  { href: "/reportes",       label: "Reportes ciudadanos",  d: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H13.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9", roles: ["admin_municipal","fiscal"] },
  { href: "/sanciones",      label: "Sanciones",            d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", roles: ["admin_municipal","fiscal"] },
  { href: "/estadisticas",   label: "Estadísticas",         d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", roles: ["super_admin","admin_provincial","admin_municipal","operador"] },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin:       "Super Admin",
  admin_provincial:  "Admin Provincial",
  admin_municipal:   "Admin Municipal",
  fiscal:            "Fiscal / Inspector",
  operador:          "Operador",
  conductor:         "Conductor",
  ciudadano:         "Ciudadano",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const parsed = JSON.parse(raw) as StoredUser;
    if (parsed.status && parsed.status !== "activo") {
      router.replace(parsed.status === "rechazado" ? "/rejected" : "/pending");
      return;
    }
    setUser(parsed);
  }, [router]);

  function logout() {
    localStorage.clear();
    document.cookie = "sfit_access_token=; path=/; max-age=0";
    router.replace("/login");
  }

  if (!user) return null;

  const visible = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="flex h-screen" style={{ background: "#F4F4F5" }}>
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col" style={{ background: "#0A1628" }}>
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <SfitMark size={26} />
          <span className="text-white font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-syne)", fontSize: "0.9375rem" }}>
            SFIT
          </span>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {visible.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150"
                style={{
                  background: active ? "rgba(184,134,11,0.12)" : "transparent",
                  color: active ? "#D4A827" : "rgba(255,255,255,0.55)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  borderLeft: active ? "2px solid #D4A827" : "2px solid transparent",
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(184,134,11,0.22)", color: "#D4A827", fontSize: "0.8125rem", fontWeight: 700, fontFamily: "var(--font-syne)" }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}>{user.name}</div>
              <div className="truncate" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem" }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 mt-1 w-full rounded-lg transition-all duration-150"
            style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8125rem", fontWeight: 500 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "transparent"; }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function SfitMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3L29 16L16 29L3 16Z" stroke="#B8860B" strokeWidth="1.5" />
      <path d="M16 9.5L22.5 16L16 22.5L9.5 16Z" fill="#B8860B" />
    </svg>
  );
}
