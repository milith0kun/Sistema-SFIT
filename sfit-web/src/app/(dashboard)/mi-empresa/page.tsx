"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Car,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MapPin,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { ACTIVE_DISTRICTS, INTERPROV_DESTINATIONS } from "@/lib/scope";
import {
  getCompanyAuthorizationStatus,
  AUTHORIZATION_WARN_DAYS,
} from "@/lib/company-authorization";

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const GRN = "#15803d"; const GRN_BG = "#F0FDF4"; const GRN_BD = "#86EFAC";
const WARN = "#B45309"; const WARN_BG = "#FFFBEB"; const WARN_BD = "#FDE68A";

type Authorization = {
  level?: string;
  scope?: string;
  issuedBy?: string;
  resolutionNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
};

type MiEmpresa = {
  id: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  active: boolean;
  suspendedAt?: string;
  reputationScore: number;
  serviceScope?: string;
  coverage?: { districtCodes: string[] };
  authorizations?: Authorization[];
};

type StoredUser = { role: string };

const SCOPE_LABEL: Record<string, string> = {
  urbano: "Urbano",
  interprovincial: "Interprovincial",
};

function getToken() {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("sfit_access_token") ?? "";
}

export default function MiEmpresaPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [empresa, setEmpresa] = useState<MiEmpresa | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ drivers?: number; vehicles?: number }>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "operador") {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const res = await fetch("/api/operador/mi-empresa", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "No se pudo cargar la empresa.");
        return;
      }
      setEmpresa(body.data);

      // Conteos: drivers + vehicles de mi empresa. Endpoints existentes
      // scoped por sesión operador devuelven solo lo que el operador puede ver.
      void (async () => {
        try {
          const [dRes, vRes] = await Promise.all([
            fetch("/api/conductores?limit=1", {
              headers: { Authorization: `Bearer ${getToken()}` },
            }),
            fetch("/api/vehiculos?limit=1", {
              headers: { Authorization: `Bearer ${getToken()}` },
            }),
          ]);
          const d = await dRes.json().catch(() => ({}));
          const v = await vRes.json().catch(() => ({}));
          setCounts({
            drivers: d?.data?.total ?? 0,
            vehicles: v?.data?.total ?? 0,
          });
        } catch { /* no rompe la pantalla principal */ }
      })();
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  if (missing) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Operador" title="Mi empresa" subtitle="—" />
        <div role="alert" style={{
          padding: 16, background: WARN_BG, border: `1.5px solid ${WARN_BD}`,
          borderRadius: 10, color: "#92400E", display: "flex", gap: 10,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Aún no tienes una empresa asignada
            </div>
            <div style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Para operar el sistema necesitas estar vinculado a una empresa de
              transporte. Si recién te aprobaron, completa el onboarding con tu
              RUC; si ya lo hiciste, contacta al administrador municipal.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !empresa) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Operador" title="Mi empresa" subtitle="Cargando…" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: INK5 }}>
          <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
          Cargando datos…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Operador" title="Mi empresa" />
        <div role="alert" style={{
          padding: 12, background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem",
        }}>
          {error}
        </div>
      </div>
    );
  }

  const auth = getCompanyAuthorizationStatus(empresa.authorizations);
  const isSuspended = !!empresa.suspendedAt;
  const coverageNames = (empresa.coverage?.districtCodes ?? []).map((c) => {
    const found =
      ACTIVE_DISTRICTS.find((d) => d.code === c) ??
      INTERPROV_DESTINATIONS.find((d) => d.code === c);
    return found?.name ?? c;
  });

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Operador · RF-04"
        title={empresa.razonSocial}
        subtitle={`RUC ${empresa.ruc} · ${isSuspended ? "Suspendida" : empresa.active ? "Activa" : "Pendiente de aprobación"}`}
      />

      <KPIStrip
        cols={4}
        items={[
          {
            label: "ESTADO",
            value: isSuspended ? "Suspendida" : empresa.active ? "Activa" : "Pendiente",
            subtitle: isSuspended ? "sin acceso operativo" : empresa.active ? "operativa" : "esperando aprobación",
            icon: Building2,
            accent: isSuspended ? RED : empresa.active ? GRN : WARN,
          },
          {
            label: "REPUTACIÓN",
            value: empresa.reputationScore,
            subtitle: "de 100",
            icon: CheckCircle,
            accent: empresa.reputationScore >= 80 ? GRN : empresa.reputationScore >= 50 ? WARN : RED,
          },
          {
            label: "CONDUCTORES",
            value: counts.drivers ?? "—",
            subtitle: "activos en la empresa",
            icon: Users,
          },
          {
            label: "FLOTA",
            value: counts.vehicles ?? "—",
            subtitle: "vehículos asignados",
            icon: Car,
          },
        ]}
      />

      {/* Banner vigencia autorizaciones — mismo helper que /empresas/[id] */}
      {auth.state !== "valid" && (
        <div role="alert" style={{
          padding: "12px 16px",
          background: auth.state === "expired" ? RED_BG : WARN_BG,
          border: `1px solid ${auth.state === "expired" ? RED_BD : WARN_BD}`,
          borderRadius: 9, display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle
            size={16}
            color={auth.state === "expired" ? RED : WARN}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: auth.state === "expired" ? RED : WARN }}>
              {auth.state === "expired"
                ? "Autorización vencida"
                : auth.state === "expiring_soon"
                ? `Autorización por vencer en ${auth.daysToExpiry} días`
                : "Sin autorización registrada"}
            </div>
            <div style={{ fontSize: "0.75rem", color: INK6, marginTop: 4, lineHeight: 1.5 }}>
              {auth.state === "none"
                ? "Tu empresa no tiene autorización vigente en el sistema. No podrás crear rutas ni iniciar viajes hasta que el administrador municipal cargue la resolución."
                : auth.state === "expired"
                ? "No podrás crear rutas ni iniciar viajes hasta renovar y registrar la nueva resolución."
                : `Renueva la autorización antes de que venza. El sistema avisa cuando faltan ≤${AUTHORIZATION_WARN_DAYS} días.`}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Representante legal */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={14} color={INK6} /> Representante legal
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Row k="Nombre" v={empresa.representanteLegal?.name ?? "—"} />
            <Row k="DNI" v={empresa.representanteLegal?.dni ?? "—"} mono />
            {empresa.representanteLegal?.phone && (
              <Row k="Teléfono" v={empresa.representanteLegal.phone} />
            )}
          </div>
        </div>

        {/* Ámbito y cobertura */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={14} color={INK6} /> Ámbito de servicio
          </h3>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Modalidad
            </div>
            <div style={{ fontSize: "0.875rem", color: INK9, fontWeight: 600 }}>
              {SCOPE_LABEL[empresa.serviceScope ?? "urbano"] ?? empresa.serviceScope}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Cobertura
            </div>
            {coverageNames.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                Sin cobertura declarada — pide al admin que la registre.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {coverageNames.map((n) => (
                  <span key={n} style={{
                    padding: "3px 9px", borderRadius: 5,
                    background: GRN_BG, color: GRN, border: `1px solid ${GRN_BD}`,
                    fontSize: "0.6875rem", fontWeight: 700,
                  }}>{n}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atajos */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <QuickLink href="/conductores" icon={<Users size={14} />} label="Ver mis conductores" />
        <QuickLink href="/vehiculos" icon={<Car size={14} />} label="Ver mis vehículos" />
        <QuickLink href="/rutas" icon={<FileText size={14} />} label="Ver mis rutas" />
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 8px", background: INK1, borderRadius: 6 }}>
      <span style={{ fontSize: "0.75rem", color: INK5 }}>{k}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, fontFamily: mono ? "ui-monospace, monospace" : "inherit" }}>
        {v}
      </span>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href}>
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 14px", borderRadius: 8,
        border: `1px solid ${INK2}`, background: "#fff", color: INK6,
        fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        {icon} {label}
      </button>
    </Link>
  );
}
