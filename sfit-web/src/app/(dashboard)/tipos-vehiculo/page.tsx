"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Settings, Car, Boxes, Sparkles, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { GroupedSection } from "@/components/dashboard/GroupedSection";

type VehicleType = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon?: string;
  checklistItems: string[];
  inspectionFields: { key: string; label: string; type: "boolean" | "scale" | "text" }[];
  reportCategories: string[];
  isCustom: boolean;
  active: boolean;
};

type StoredUser = { role: string; municipalityId?: string };

const PREDEFINED = [
  {
    key: "transporte_publico",
    name: "Transporte público",
    description: "Buses, combis y colectivos de rutas concesionadas.",
  },
  {
    key: "limpieza_residuos",
    name: "Limpieza y residuos",
    description: "Camiones de basura, barredoras, volquetes de residuos.",
  },
  {
    key: "emergencia",
    name: "Emergencia",
    description: "Ambulancias y vehículos de bomberos.",
  },
  {
    key: "maquinaria",
    name: "Maquinaria municipal",
    description: "Retroexcavadoras, motoniveladoras, compactadoras.",
  },
  {
    key: "municipal_general",
    name: "Vehículo municipal general",
    description: "Camionetas y sedanes de uso administrativo.",
  },
];

export default function TiposVehiculoPage() {
  const router = useRouter();
  const [items, setItems] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "admin_municipal") {
      router.replace("/dashboard");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar los tipos de vehículo.");
        return;
      }
      setItems(data.data.items ?? []);
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePredefined(key: string, name: string) {
    setActivating(key);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const existing = items.find((t) => t.key === key);
      if (existing) {
        const res = await fetch(`/api/tipos-vehiculo/${existing.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({ active: !existing.active }),
        });
        if (res.status === 401) return router.replace("/login");
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "No se pudo actualizar el tipo.");
          return;
        }
        setItems((prev) => prev.map((t) => (t.id === existing.id ? data.data : t)));
      } else {
        const res = await fetch("/api/tipos-vehiculo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({
            key,
            name,
            description: PREDEFINED.find((p) => p.key === key)?.description ?? "",
            isCustom: false,
            checklistItems: [],
            inspectionFields: [],
            reportCategories: [],
          }),
        });
        if (res.status === 401) return router.replace("/login");
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "No se pudo activar el tipo.");
          return;
        }
        setItems((prev) => [...prev, data.data]);
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setActivating(null);
    }
  }

  if (forbidden) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", marginBottom: 8 }}>Acceso denegado</h3>
        <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
      </Card>
    );
  }

  const customs = items.filter((t) => t.isCustom);
  const predefActive = items.filter((t) => !t.isCustom && t.active).length;
  const withChecklist = items.filter((t) => t.checklistItems.length > 0).length;
  const totalActive = items.filter((t) => t.active).length;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <DashboardHero
        kicker="Panel municipal"
        rfCode="RF-04"
        title="Tipos de vehículo"
        pills={[
          { label: "Activos", value: totalActive },
          { label: "Predefinidos", value: predefActive },
          { label: "Personalizados", value: customs.length },
        ]}
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "ACTIVOS", value: totalActive, subtitle: "en uso", accent: "#15803d", icon: Car },
          { label: "PREDEFINIDOS", value: predefActive, subtitle: `de ${PREDEFINED.length} disponibles`, accent: "#6C0606", icon: Boxes },
          { label: "PERSONALIZADOS", value: customs.length, subtitle: "creados por la municipalidad", accent: "#0A1628", icon: Sparkles },
          { label: "CON CHECKLIST", value: withChecklist, subtitle: "listos para operar", accent: "#B45309", icon: ListChecks },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/tipos-vehiculo/nuevo">
          <Button variant="primary">
            <Plus size={16} strokeWidth={2} />
            Nuevo tipo
          </Button>
        </Link>
      </div>

      {error && (
        <div
          className="animate-fade-up"
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#DC2626",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Predefinidos */}
      <GroupedSection color="#6C0606" title="Tipos predefinidos del sistema" count={PREDEFINED.length}>
        <p style={{ color: "#52525b", fontSize: "0.875rem", margin: "0 0 14px" }}>
          Activa los tipos que su municipalidad maneja. Luego podrás configurar sus checklists, inspecciones y categorías de reporte.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PREDEFINED.map((p) => {
            const existing = items.find((t) => t.key === p.key);
            const isActive = existing?.active ?? false;
            return (
              <Card key={p.key} accent={isActive ? "gold" : "default"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontFamily: "var(--font-inter)",
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "#09090b",
                        margin: 0,
                      }}
                    >
                      {p.name}
                    </h3>
                    <p style={{ color: "#52525b", fontSize: "0.8125rem", marginTop: 8, lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  </div>
                  {isActive && <Badge variant="activo">Activo</Badge>}
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={activating === p.key}
                      onChange={() => togglePredefined(p.key, p.name)}
                    />
                    <span style={{ fontSize: "0.875rem", color: "#18181b" }}>
                      {isActive ? "Activado" : "Activar"}
                    </span>
                  </label>
                  {existing && (
                    <Link href={`/tipos-vehiculo/${existing.id}`} style={{ marginLeft: "auto" }}>
                      <Button variant="ghost" size="sm">
                        <Settings size={14} strokeWidth={1.8} />
                        Configurar
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </GroupedSection>

      {/* Personalizados */}
      <GroupedSection color="#0A1628" title="Tipos personalizados" count={customs.length}>
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "-8px 0 14px" }}>
          <Link href="/tipos-vehiculo/nuevo">
            <Button variant="outline" size="sm">
              <Plus size={14} strokeWidth={2} />
              Nuevo personalizado
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card>
            <div style={{ color: "#71717a" }}>Cargando tipos…</div>
          </Card>
        ) : customs.length === 0 ? (
          <EmptyState
            title="Sin tipos personalizados"
            subtitle="Crea un tipo con formularios propios si su municipalidad opera un vehículo distinto a los predefinidos."
            cta={
              <Link href="/tipos-vehiculo/nuevo">
                <Button variant="primary">Nuevo tipo personalizado</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customs.map((t) => (
              <Link
                key={t.id}
                href={`/tipos-vehiculo/${t.id}`}
                style={{ textDecoration: "none" }}
              >
                <Card accent={t.active ? "gold" : "default"} className="feature-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <h3
                      style={{
                        fontFamily: "var(--font-inter)",
                        fontSize: "1.0625rem",
                        fontWeight: 700,
                        color: "#09090b",
                        margin: 0,
                      }}
                    >
                      {t.name}
                    </h3>
                    <Badge variant="gold">Personalizado</Badge>
                  </div>
                  <p style={{ color: "#52525b", fontSize: "0.8125rem", marginTop: 10, lineHeight: 1.5 }}>
                    {t.description || "Sin descripción."}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 10,
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: "1px solid #e4e4e7",
                    }}
                  >
                    <Stat label="Checklist" value={t.checklistItems.length} />
                    <Stat label="Inspección" value={t.inspectionFields.length} />
                    <Stat label="Categorías" value={t.reportCategories.length} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </GroupedSection>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        className="num"
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#09090b",
          lineHeight: 1,
          letterSpacing: "-0.015em",
        }}
      >
        {value}
      </div>
      <div style={{ color: "#71717a", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}
