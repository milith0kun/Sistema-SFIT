"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Users,
  Building2,
  IdCard,
  Truck,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";
import { SectionTabs } from "@/components/dashboard/SectionTabs";
import { hasWebPermission } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";

type StoredUser = { role: string };

type ResumenResponse = {
  counts: {
    users: number;
    companies: number;
    drivers: number;
    vehicles: number;
    driverLicenseExpiringSoon?: number;
    driverLicenseExpired?: number;
    licenseWarnDays?: number;
    total: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    requestedRole: string | null;
    dni: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  companies: Array<{
    id: string;
    razonSocial: string;
    ruc: string;
    representanteLegal: { name: string; dni: string; phone?: string };
    createdAt: string;
  }>;
  drivers: Array<{
    id: string;
    name: string;
    dni: string;
    licenseNumber: string;
    companyName: string | null;
    companyId: string | null;
    createdAt: string;
  }>;
  vehicles: Array<{
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
    vehicleTypeKey: string;
    companyName: string | null;
    companyId: string | null;
    createdAt: string;
  }>;
};

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const WARN = "#B45309"; const WARN_BG = "#FEFCE8";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";

type TabKey = "usuarios" | "empresas" | "conductores" | "vehiculos";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AprobacionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tab, setTab] = useState<TabKey>("usuarios");
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!hasWebPermission(u.role as Role, "aprobaciones", "view")) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/aprobaciones/resumen", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Error al cargar aprobaciones");
        return;
      }
      setData(body.data);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  // Aprobar/verificar item: cada acción dispara su endpoint y refresca el listado.
  // Para usuarios usamos PATCH /api/admin/usuarios/[id] con status=activo
  // (reusa el flujo existente que también dispara email + notificación).
  const act = useCallback(async (kind: TabKey, id: string) => {
    setBusyId(id);
    const config =
      kind === "empresas"
        ? { url: `/api/empresas/${id}/aprobar`, method: "POST", body: undefined, label: "Empresa aprobada" }
        : kind === "conductores"
          ? { url: `/api/conductores/${id}/verificar`, method: "POST", body: undefined, label: "Conductor verificado" }
          : kind === "vehiculos"
            ? { url: `/api/vehiculos/${id}/verificar`, method: "POST", body: undefined, label: "Vehículo verificado" }
            : { url: `/api/admin/usuarios/${id}`, method: "PATCH", body: JSON.stringify({ status: "activo" }), label: "Usuario aprobado" };
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(config.url, {
        method: config.method,
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          ...(config.body ? { "Content-Type": "application/json" } : {}),
        },
        body: config.body,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setToast(body.error ?? "No se pudo completar la acción");
      } else {
        setToast(config.label);
        await load();
      }
    } catch {
      setToast("Error de conexión");
    } finally {
      setBusyId(null);
      setTimeout(() => setToast(null), 3000);
    }
  }, [load]);

  const kpis: KPIItem[] = useMemo(() => {
    const c = data?.counts;
    const expiringSoon = c?.driverLicenseExpiringSoon ?? 0;
    const expired = c?.driverLicenseExpired ?? 0;
    const warnDays = c?.licenseWarnDays ?? 30;
    return [
      { label: "USUARIOS",    value: c?.users    ?? "…", subtitle: "pendientes",      icon: Users,     accent: c && c.users > 0 ? WARN : undefined },
      { label: "EMPRESAS",    value: c?.companies ?? "…", subtitle: "por aprobar",    icon: Building2, accent: c && c.companies > 0 ? WARN : undefined },
      { label: "CONDUCTORES", value: c?.drivers  ?? "…", subtitle: "sin verificar",   icon: IdCard,    accent: c && c.drivers > 0 ? WARN : undefined },
      { label: "VEHÍCULOS",   value: c?.vehicles ?? "…", subtitle: "sin verificar",   icon: Truck,     accent: c && c.vehicles > 0 ? WARN : undefined },
      { label: "LIC. POR VENCER", value: expiringSoon, subtitle: `≤${warnDays} días`, icon: IdCard, accent: expiringSoon > 0 ? WARN : undefined },
      { label: "LIC. VENCIDAS",   value: expired,      subtitle: "requieren renovar", icon: IdCard, accent: expired > 0 ? RED : undefined },
    ];
  }, [data]);

  if (!user) return null;

  const action = (
    <button
      onClick={() => { void load(); }}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${INK2}`,
        background: "#fff", color: INK6, fontSize: "0.8125rem",
        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
      Actualizar
    </button>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Administración · RF-04"
        title="Centro de aprobaciones"
        subtitle="Revisa y aprueba los registros pendientes de tu municipalidad"
        action={action}
      />

      <KPIStrip items={kpis} cols={6} />

      {error && (
        <div role="alert" style={{ padding: "11px 16px", background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 10, color: RED, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div>
        <SectionTabs
          value={tab}
          onChange={(k) => setTab(k as TabKey)}
          tabs={[
            { key: "usuarios",    label: `Usuarios${data ? ` (${data.counts.users})` : ""}` },
            { key: "empresas",    label: `Empresas${data ? ` (${data.counts.companies})` : ""}` },
            { key: "conductores", label: `Conductores${data ? ` (${data.counts.drivers})` : ""}` },
            { key: "vehiculos",   label: `Vehículos${data ? ` (${data.counts.vehicles})` : ""}` },
          ]}
        />
      </div>

      {/* Tabla por tab */}
      <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12, overflow: "hidden" }}>
        {tab === "usuarios" && (
          <PendingList
            emptyTitle="Sin usuarios pendientes"
            emptyDesc="Todos los registros de tu municipalidad han sido revisados."
            items={data?.users ?? []}
            renderRow={(u) => (
              <Row
                key={u.id}
                title={u.name}
                subtitle={u.email + (u.requestedRole ? ` · solicita ${u.requestedRole}` : "")}
                meta={fmtDate(u.createdAt)}
                actionLabel="Aprobar"
                onAction={() => act("usuarios", u.id)}
                busy={busyId === u.id}
                onDetail={() => router.push(`/usuarios/${u.id}`)}
              />
            )}
          />
        )}

        {tab === "empresas" && (
          <PendingList
            emptyTitle="Sin empresas por aprobar"
            emptyDesc="Las empresas activas o suspendidas no aparecen aquí."
            items={data?.companies ?? []}
            renderRow={(c) => (
              <Row
                key={c.id}
                title={c.razonSocial}
                subtitle={`RUC ${c.ruc} · Rep. ${c.representanteLegal.name}`}
                meta={fmtDate(c.createdAt)}
                actionLabel="Aprobar"
                onAction={() => act("empresas", c.id)}
                busy={busyId === c.id}
                onDetail={() => router.push(`/empresas/${c.id}`)}
              />
            )}
          />
        )}

        {tab === "conductores" && (
          <PendingList
            emptyTitle="Sin conductores sin verificar"
            emptyDesc="Todos los conductores activos están verificados."
            items={data?.drivers ?? []}
            renderRow={(d) => (
              <Row
                key={d.id}
                title={d.name}
                subtitle={`DNI ${d.dni} · Lic. ${d.licenseNumber}${d.companyName ? ` · ${d.companyName}` : ""}`}
                meta={fmtDate(d.createdAt)}
                actionLabel="Verificar"
                onAction={() => act("conductores", d.id)}
                busy={busyId === d.id}
                onDetail={() => router.push(`/conductores/${d.id}`)}
              />
            )}
          />
        )}

        {tab === "vehiculos" && (
          <PendingList
            emptyTitle="Sin vehículos sin verificar"
            emptyDesc="Todos los vehículos están verificados."
            items={data?.vehicles ?? []}
            renderRow={(v) => (
              <Row
                key={v.id}
                title={`${v.plate}`}
                subtitle={`${v.brand} ${v.model} (${v.year})${v.companyName ? ` · ${v.companyName}` : ""}`}
                meta={fmtDate(v.createdAt)}
                actionLabel="Verificar"
                onAction={() => act("vehiculos", v.id)}
                busy={busyId === v.id}
                onDetail={() => router.push(`/vehiculos/${v.id}`)}
              />
            )}
          />
        )}
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 50,
          padding: "10px 16px", background: APTO_BG, border: `1px solid ${APTO_BD}`,
          borderRadius: 10, color: APTO, fontSize: "0.875rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function PendingList<T>({
  items, renderRow, emptyTitle, emptyDesc,
}: {
  items: T[];
  renderRow: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyDesc: string;
}) {
  if (items.length === 0) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <CheckCircle2 size={28} color={APTO} style={{ margin: "0 auto 8px" }} />
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, marginBottom: 4 }}>{emptyTitle}</div>
        <div style={{ fontSize: "0.8125rem", color: INK5 }}>{emptyDesc}</div>
      </div>
    );
  }
  return <div>{items.map((it) => renderRow(it))}</div>;
}

function Row({
  title, subtitle, meta, actionLabel, actionHint, onAction, onDetail, busy,
}: {
  title: string;
  subtitle: string;
  meta: string;
  actionLabel: string;
  actionHint?: string;
  onAction: () => void;
  onDetail?: () => void;
  busy: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      borderBottom: `1px solid ${INK1}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: INK9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        <div style={{ fontSize: "0.8125rem", color: INK6, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {subtitle}
        </div>
      </div>
      <div style={{ fontSize: "0.75rem", color: INK5, fontWeight: 500, whiteSpace: "nowrap" }}>
        {meta}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {onDetail && (
          <button
            onClick={onDetail}
            style={{
              height: 32, padding: "0 12px", borderRadius: 7,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Detalle
          </button>
        )}
        <button
          onClick={onAction}
          disabled={busy}
          title={actionHint}
          style={{
            height: 32, padding: "0 14px", borderRadius: 7,
            border: "none", background: INK9, color: "#fff",
            fontSize: "0.8125rem", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: busy ? 0.6 : 1,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {busy ? "…" : <CheckCircle2 size={13} />}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
