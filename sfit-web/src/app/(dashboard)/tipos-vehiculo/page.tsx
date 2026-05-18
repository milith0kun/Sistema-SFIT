"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Settings, Car, CheckCircle2, ClipboardList, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
    key: "transporte_urbano",
    name: "Transporte urbano",
    description:
      "Combis y colectivos que operan dentro de los 6 distritos de Cotabambas. Rutas con paraderos definidos.",
  },
  {
    key: "transporte_interprovincial",
    name: "Transporte interprovincial",
    description:
      "Buses que salen de Cotabambas hacia Cusco, Abancay o Arequipa. Rutas origen-destino sin paraderos intermedios.",
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
  // Solo cuentan los predefinidos del sistema (los que aparecen en PREDEFINED).
  // Auto-seed en GET /api/tipos-vehiculo garantiza que existan los 2.
  const predefItems = items.filter(
    (t) => !t.isCustom && PREDEFINED.some((p) => p.key === t.key),
  );
  const totalActive = predefItems.length;
  const withChecklist = predefItems.filter((t) => t.checklistItems.length > 0).length;
  const withInspection = predefItems.filter((t) => t.inspectionFields.length > 0).length;
  const withReports = predefItems.filter((t) => t.reportCategories.length > 0).length;
  const total = PREDEFINED.length;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader
        kicker="Panel municipal · RF-04"
        title="Tipos de vehículo"
        subtitle={`${totalActive} de ${total} tipos activos · configura sus checklists, inspecciones y reportes`}
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "TIPOS ACTIVOS",  value: `${totalActive}/${total}`,  subtitle: "predefinidos del sistema", icon: Car },
          { label: "CON CHECKLIST",  value: `${withChecklist}/${total}`,  subtitle: "ítems definidos",          icon: ClipboardList,         accent: withChecklist < total ? "#B45309" : undefined },
          { label: "CON INSPECCIÓN", value: `${withInspection}/${total}`, subtitle: "campos en la ficha",       icon: CheckCircle2,          accent: withInspection < total ? "#B45309" : undefined },
          { label: "CON REPORTES",   value: `${withReports}/${total}`,    subtitle: "categorías ciudadanas",    icon: MessageSquareWarning,  accent: withReports < total ? "#B45309" : undefined },
        ]}
      />

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

      {/* Predefinidos — el sistema garantiza que existan; el admin solo configura. */}
      <GroupedSection color="#6C0606" title="Tipos predefinidos del sistema" count={PREDEFINED.length}>
        <p style={{ color: "#52525b", fontSize: "0.875rem", margin: "0 0 14px" }}>
          Configura checklists, inspecciones y categorías de reporte para cada tipo.
          Los dos tipos están activos por defecto en la municipalidad.
        </p>
        {loading && items.length === 0 ? (
          <Card>
            <div style={{ color: "#71717a" }}>Cargando tipos…</div>
          </Card>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PREDEFINED.map((p) => {
            const existing = items.find((t) => t.key === p.key);
            const checklistN  = existing?.checklistItems.length  ?? 0;
            const inspectionN = existing?.inspectionFields.length ?? 0;
            const reportsN    = existing?.reportCategories.length ?? 0;
            return (
              <Card key={p.key} accent={existing ? "gold" : "default"}>
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
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "2px 9px", borderRadius: 6,
                    background: "#fff", color: "#18181b", border: "1px solid #e4e4e7",
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
                    textTransform: "uppercase", flexShrink: 0,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#15803d", flexShrink: 0 }} />
                    Activo
                  </span>
                </div>

                {/* Estado de configuración */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid #e4e4e7",
                }}>
                  <ConfigStat label="Checklist"  count={checklistN}  unit="ítems" />
                  <ConfigStat label="Inspección" count={inspectionN} unit="campos" />
                  <ConfigStat label="Reportes"   count={reportsN}    unit="categorías" />
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                  {existing ? (
                    <Link href={`/tipos-vehiculo/${existing.id}`}>
                      <Button variant="primary" size="sm">
                        <Settings size={14} strokeWidth={1.8} />
                        Configurar
                      </Button>
                    </Link>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                      Inicializando tipo…
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        )}
      </GroupedSection>

      {/* Personalizados — solo si la municipalidad creó alguno fuera de los
          2 predefinidos. Si no hay ninguno, no mostramos la sección para no
          inducir al admin a "crear tipos" que el sistema no espera operar. */}
      {customs.length > 0 && (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customs.map((t) => (
              <Link
                key={t.id}
                href={`/tipos-vehiculo/${t.id}`}
                style={{ textDecoration: "none" }}
              >
                <Card accent="default" className="feature-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span
                        title={t.active ? "Activo" : "Inactivo"}
                        style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: t.active ? "#15803d" : "#a1a1aa",
                          flexShrink: 0,
                        }}
                      />
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
                    </div>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "2px 8px", borderRadius: 6,
                      background: "#fff", color: "#52525b", border: "1px solid #e4e4e7",
                      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}>
                      Personalizado
                    </span>
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
      )}
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

/**
 * Mini-stat con semántica de "configurado / sin configurar".
 * - count > 0 → verde, "{count} {unit}"
 * - count = 0 → ámbar, "Sin {unit}"
 */
function ConfigStat({ label, count, unit }: { label: string; count: number; unit: string }) {
  const hasData = count > 0;
  return (
    <div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 7px", borderRadius: 5,
        background: hasData ? "#F0FDF4" : "#FFFBEB",
        color: hasData ? "#15803d" : "#B45309",
        border: `1px solid ${hasData ? "#86EFAC" : "#FDE68A"}`,
        fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      }}>
        {hasData ? `${count} ${unit}` : `Sin ${unit}`}
      </div>
      <div style={{ color: "#71717a", fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}
