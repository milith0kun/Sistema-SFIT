"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { name: string; email: string; role: string };

const ROLE_CONTEXT: Record<string, { kicker: string; title: string; subtitle: string; modules: ModuleCard[] }> = {
  super_admin: {
    kicker:   "Panel global",
    title:    "Plataforma SFIT",
    subtitle: "Visibilidad completa sobre todas las provincias y municipalidades.",
    modules: [
      { label: "Provincias",        href: "/municipalidades", icon: "globe" },
      { label: "Municipalidades",   href: "/municipalidades", icon: "building" },
      { label: "Estadísticas globales", href: "/estadisticas",  icon: "chart" },
      { label: "Aprobaciones",      href: "/admin/users",     icon: "check" },
    ],
  },
  admin_provincial: {
    kicker:   "Panel provincial",
    title:    "Tu provincia",
    subtitle: "Estadísticas agregadas de todas tus municipalidades.",
    modules: [
      { label: "Municipalidades",    href: "/municipalidades", icon: "building" },
      { label: "Estadísticas",       href: "/estadisticas",    icon: "chart" },
      { label: "Aprobaciones",       href: "/admin/users",     icon: "check" },
      { label: "Sanciones del mes",  href: "/sanciones",       icon: "alert" },
    ],
  },
  admin_municipal: {
    kicker:   "Panel municipal",
    title:    "Tu municipalidad",
    subtitle: "Gestiona usuarios, flota, inspecciones y reportes ciudadanos.",
    modules: [
      { label: "Aprobaciones pendientes", href: "/admin/users",     icon: "check", accent: "gold" },
      { label: "Empresas de transporte",  href: "/empresas",        icon: "building" },
      { label: "Tipos de vehículo",       href: "/tipos-vehiculo",  icon: "truck" },
      { label: "Conductores",             href: "/conductores",     icon: "user" },
      { label: "Inspecciones",            href: "/inspecciones",    icon: "shield" },
      { label: "Reportes ciudadanos",     href: "/reportes",        icon: "flag" },
      { label: "Sanciones",               href: "/sanciones",       icon: "alert" },
      { label: "Estadísticas",            href: "/estadisticas",    icon: "chart" },
    ],
  },
  operador: {
    kicker:   "Panel de operador",
    title:    "Tu flota",
    subtitle: "Gestión de vehículos, conductores y operaciones diarias.",
    modules: [
      { label: "Flota del día",   href: "/flota",       icon: "truck", accent: "gold" },
      { label: "Conductores",     href: "/conductores", icon: "user" },
      { label: "Vehículos",       href: "/vehiculos",   icon: "truck" },
      { label: "Viajes",          href: "/viajes",      icon: "route" },
      { label: "Estadísticas",    href: "/estadisticas", icon: "chart" },
    ],
  },
  fiscal: {
    kicker:   "Panel de fiscal",
    title:    "Fiscalización en campo",
    subtitle: "Inspecciones, actas digitales y reportes de campo.",
    modules: [
      { label: "Inspecciones",        href: "/inspecciones", icon: "shield" },
      { label: "Vehículos / QR",      href: "/vehiculos",    icon: "truck" },
      { label: "Conductores",         href: "/conductores",  icon: "user" },
      { label: "Reportes ciudadanos", href: "/reportes",     icon: "flag" },
      { label: "Sanciones",           href: "/sanciones",    icon: "alert" },
    ],
  },
};

type ModuleCard = {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  accent?: "gold";
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  if (!user) return null;

  const ctx = ROLE_CONTEXT[user.role] ?? ROLE_CONTEXT.admin_municipal;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="kicker mb-3">{ctx.kicker}</p>
        <h1
          className="font-black text-[#09090b]"
          style={{ fontFamily: "var(--font-syne)", fontSize: "2.5rem", lineHeight: 0.95, letterSpacing: "-0.035em" }}
        >
          Hola, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-3" style={{ color: "#52525b", fontSize: "1.0625rem", lineHeight: 1.55 }}>
          {ctx.subtitle}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-100">
        {[
          { label: "Vehículos activos",   value: "—", accent: "#B8860B", bg: "#FDF8EC", border: "#E8D090" },
          { label: "Conductores APTOS",   value: "—", accent: "#15803d", bg: "#F0FDF4", border: "#86EFAC" },
          { label: "Reportes pendientes", value: "—", accent: "#b45309", bg: "#FFFBEB", border: "#FCD34D" },
          { label: "Sanciones del mes",   value: "—", accent: "#b91c1c", bg: "#FFF5F5", border: "#FCA5A5" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl p-6"
            style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: m.bg, border: `1px solid ${m.border}` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: m.accent }} />
            </div>
            <div className="font-black text-[#09090b] leading-none mb-2" style={{ fontFamily: "var(--font-syne)", fontSize: "2rem", letterSpacing: "-0.03em" }}>
              {m.value}
            </div>
            <div style={{ color: "#52525b", fontSize: "0.8125rem", fontWeight: 500 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Módulos por rol */}
      <section className="animate-fade-up delay-200">
        <h2
          className="mb-5"
          style={{ fontFamily: "var(--font-syne)", fontSize: "1.25rem", fontWeight: 700, color: "#09090b", letterSpacing: "-0.02em" }}
        >
          Tus módulos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ctx.modules.map((m) => (
            <Link
              key={m.href + m.label}
              href={m.href}
              className="feature-card rounded-xl p-5 transition-all"
              style={{
                background: m.accent === "gold" ? "#FDF8EC" : "#ffffff",
                border: m.accent === "gold" ? "1.5px solid #E8D090" : "1.5px solid #e4e4e7",
                textDecoration: "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: m.accent === "gold" ? "#F6E5B1" : "#f4f4f5",
                  color: m.accent === "gold" ? "#926A09" : "#3F3F46",
                }}
              >
                {ICONS[m.icon]}
              </div>
              <div style={{ fontFamily: "var(--font-syne)", fontSize: "0.9375rem", fontWeight: 700, color: m.accent === "gold" ? "#926A09" : "#09090b", letterSpacing: "-0.01em" }}>
                {m.label}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  globe:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>,
  chart:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 13l3-3 4 4 5-5"/></svg>,
  check:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  truck:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  user:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  shield:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  flag:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  route:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 1 0 0-7h-11a3.5 3.5 0 1 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>,
};
