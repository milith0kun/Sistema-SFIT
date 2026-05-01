"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

type InspectionFieldType = "boolean" | "scale" | "text";
type InspectionField = { key: string; label: string; type: InspectionFieldType };
type VehicleType = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon?: string;
  checklistItems: string[];
  inspectionFields: InspectionField[];
  reportCategories: string[];
  isCustom: boolean;
  active: boolean;
};

type StoredUser = { role: string };

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarTipoVehiculoPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [vt, setVt] = useState<VehicleType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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
  }, [id, router]);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/tipos-vehiculo/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar.");
        return;
      }
      setVt(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function save(patch: Partial<VehicleType>) {
    if (!vt) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/tipos-vehiculo/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setVt(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!vt) return;
    if (!window.confirm(`¿Eliminar el tipo "${vt.name}"?`)) return;
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/tipos-vehiculo/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo eliminar.");
        return;
      }
      router.push("/tipos-vehiculo");
    } catch {
      window.alert("Error de conexión.");
    }
  }

  if (notFound) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)" }}>Tipo no encontrado</h3>
        <div style={{ marginTop: 16 }}>
          <Link href="/tipos-vehiculo">
            <Button variant="outline">Volver</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (loading || !vt) {
    return (
      <Card>
        <div style={{ color: "#71717a" }}>Cargando…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Tipos de vehículo"
        title={vt.name}
        subtitle={vt.description || "Configura los formularios y categorías."}
        action={
          <Link href="/tipos-vehiculo">
            <Button variant="outline">
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver
            </Button>
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "3px 10px", borderRadius: 6,
          background: "#fff", color: "#18181b", border: "1px solid #e4e4e7",
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {vt.isCustom ? "Personalizado" : "Predefinido"}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 6,
          background: "#fff", color: "#18181b", border: "1px solid #e4e4e7",
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: vt.active ? "#15803d" : "#a1a1aa", flexShrink: 0,
          }} />
          {vt.active ? "Activo" : "Inactivo"}
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
            color: "#DC2626",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Datos generales */}
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
          Datos generales
        </h3>
        <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8 }}>Nombre</label>
            <input
              className="field"
              value={vt.name}
              onChange={(e) => setVt({ ...vt, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8 }}>Descripción</label>
            <textarea
              className="field"
              rows={3}
              style={{ height: "auto", padding: "14px 18px", resize: "vertical" }}
              value={vt.description}
              onChange={(e) => setVt({ ...vt, description: e.target.value })}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={vt.active}
              onChange={(e) => setVt({ ...vt, active: e.target.checked })}
            />
            <span>Activo</span>
          </label>
        </div>
      </Card>

      {/* Checklist */}
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
          Checklist de pre-salida
        </h3>
        <StringListEditor
          items={vt.checklistItems.length > 0 ? vt.checklistItems : [""]}
          onChange={(next) => setVt({ ...vt, checklistItems: next })}
          placeholder="Ej. Luces funcionan"
        />
      </Card>

      {/* Inspección */}
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
          Formulario de inspección
        </h3>
        <InspectionEditor
          items={vt.inspectionFields.length > 0 ? vt.inspectionFields : [{ key: "", label: "", type: "boolean" }]}
          onChange={(next) => setVt({ ...vt, inspectionFields: next })}
        />
      </Card>

      {/* Categorías */}
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
          Categorías de reporte ciudadano
        </h3>
        <StringListEditor
          items={vt.reportCategories.length > 0 ? vt.reportCategories : [""]}
          onChange={(next) => setVt({ ...vt, reportCategories: next })}
          placeholder="Ej. Conducción peligrosa"
        />
      </Card>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <Button
          variant="primary"
          size="lg"
          loading={saving}
          onClick={() =>
            save({
              name: vt.name,
              description: vt.description,
              active: vt.active,
              checklistItems: vt.checklistItems.map((v) => v.trim()).filter(Boolean),
              inspectionFields: vt.inspectionFields
                .map((f) => ({ ...f, key: f.key.trim(), label: f.label.trim() }))
                .filter((f) => f.key && f.label),
              reportCategories: vt.reportCategories.map((v) => v.trim()).filter(Boolean),
            })
          }
        >
          Guardar cambios
        </Button>
        {vt.isCustom && (
          <Button variant="danger" size="lg" onClick={handleDelete}>
            Eliminar tipo
          </Button>
        )}
      </div>
    </div>
  );
}

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((val, idx) => (
        <div key={idx} style={{ display: "flex", gap: 8 }}>
          <input
            className="field"
            value={val}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[idx] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="md"
            aria-label="Eliminar"
            onClick={() => {
              if (items.length === 1) onChange([""]);
              else onChange(items.filter((_, i) => i !== idx));
            }}
          >
            <X size={16} strokeWidth={2} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
      >
        <Plus size={14} strokeWidth={2} />
        Agregar
      </Button>
    </div>
  );
}

function InspectionEditor({
  items,
  onChange,
}: {
  items: InspectionField[];
  onChange: (next: InspectionField[]) => void;
}) {
  function update(idx: number, patch: Partial<InspectionField>) {
    const next = items.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {items.map((f, idx) => (
        <div key={idx} className="sfit-stops-row" style={{ gap: 8 }}>
          <input
            className="field"
            placeholder="Key"
            value={f.key}
            onChange={(e) => update(idx, { key: e.target.value })}
          />
          <input
            className="field"
            placeholder="Etiqueta visible"
            value={f.label}
            onChange={(e) => update(idx, { label: e.target.value })}
          />
          <select
            className="field"
            value={f.type}
            onChange={(e) => update(idx, { type: e.target.value as InspectionFieldType })}
          >
            <option value="boolean">Cumple / No cumple</option>
            <option value="scale">Escala (1-5)</option>
            <option value="text">Texto libre</option>
          </select>
          <Button
            type="button"
            variant="ghost"
            size="md"
            aria-label="Eliminar"
            onClick={() => {
              if (items.length === 1) onChange([{ key: "", label: "", type: "boolean" }]);
              else onChange(items.filter((_, i) => i !== idx));
            }}
          >
            <X size={16} strokeWidth={2} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { key: "", label: "", type: "boolean" }])}
      >
        <Plus size={14} strokeWidth={2} />
        Agregar campo
      </Button>
    </div>
  );
}
