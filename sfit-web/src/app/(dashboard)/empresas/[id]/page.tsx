"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

type Company = {
  id: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  documents: { name: string; url: string }[];
  active: boolean;
  reputationScore: number;
  status?: "activo" | "suspendido" | "pendiente";
};

type VehicleType = { id: string; key: string; name: string };
type StoredUser = { role: string };

interface Props {
  params: Promise<{ id: string }>;
}

function scoreColor(score: number): { bg: string; color: string; border: string } {
  if (score >= 80) return { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC" };
  if (score >= 50) return { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D" };
  return { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5" };
}

export default function EmpresaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["admin_municipal", "fiscal", "admin_provincial", "super_admin"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
    void load();
    void loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la empresa.");
        return;
      }
      setCompany(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setTypes(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function toggleActive() {
    if (!company) return;
    const isActive = company.active && company.status !== "suspendido";
    const msg = isActive
      ? `¿Suspender la empresa "${company.razonSocial}"? No podrá registrar nuevos viajes.`
      : `¿Reactivar la empresa "${company.razonSocial}"?`;
    if (!window.confirm(msg)) return;
    setActionPending(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          active: !isActive,
          status: isActive ? "suspendido" : "activo",
        }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo actualizar.");
        return;
      }
      setCompany(data.data);
    } catch {
      window.alert("Error de conexión.");
    } finally {
      setActionPending(false);
    }
  }

  if (notFound) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)" }}>Empresa no encontrada</h3>
        <div style={{ marginTop: 16 }}>
          <Link href="/empresas">
            <Button variant="outline">Volver</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (loading || !company) {
    return (
      <Card>
        <div style={{ color: "#71717a" }}>Cargando…</div>
      </Card>
    );
  }

  const sc = scoreColor(company.reputationScore);
  const typeMap = new Map(types.map((t) => [t.key, t.name]));
  const canManage = user?.role === "admin_municipal";
  const isSuspended = !company.active || company.status === "suspendido";

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Empresas"
        title={company.razonSocial}
        subtitle={`RUC ${company.ruc}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/empresas">
              <Button variant="outline">
                <ArrowLeft size={16} strokeWidth={1.8} />
                Volver
              </Button>
            </Link>
            {canManage && (
              <Button
                variant={isSuspended ? "primary" : "danger"}
                loading={actionPending}
                onClick={toggleActive}
              >
                {isSuspended ? "Reactivar" : "Suspender"}
              </Button>
            )}
          </div>
        }
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isSuspended ? (
          <Badge variant="suspendido">Suspendida</Badge>
        ) : (
          <Badge variant="activo">Activa</Badge>
        )}
        <span
          className="num"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            background: sc.bg,
            color: sc.color,
            border: `1px solid ${sc.border}`,
            fontSize: "0.8125rem",
            fontWeight: 700,
          }}
        >
          Reputación: {company.reputationScore}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#b91c1c",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
            Representante legal
          </h3>
          <InfoRow label="Nombre" value={company.representanteLegal.name} />
          <InfoRow label="DNI" value={company.representanteLegal.dni} />
          <InfoRow label="Teléfono" value={company.representanteLegal.phone ?? "—"} />
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
            Flota autorizada
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {company.vehicleTypeKeys.length === 0 ? (
              <span style={{ color: "#a1a1aa" }}>Sin tipos asignados.</span>
            ) : (
              company.vehicleTypeKeys.map((k) => (
                <Badge key={k} variant="info">
                  {typeMap.get(k) ?? k}
                </Badge>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
            Vehículos
          </h3>
          <p style={{ color: "#71717a" }}>Próximamente.</p>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
            Conductores
          </h3>
          <p style={{ color: "#71717a" }}>Próximamente.</p>
        </Card>
      </div>

      {company.documents && company.documents.length > 0 && (
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
            Documentos
          </h3>
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {company.documents.map((d, i) => (
              <li key={i}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#B8860B", fontWeight: 600 }}
                >
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
      <span
        style={{
          color: "#71717a",
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          width: 120,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: "#18181b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
