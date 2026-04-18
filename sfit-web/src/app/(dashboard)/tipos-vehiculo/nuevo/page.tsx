"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type StoredUser = { role: string };
type InspectionFieldType = "boolean" | "scale" | "text";
type InspectionField = { key: string; label: string; type: InspectionFieldType };

export default function NuevoTipoVehiculoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [checklist, setChecklist] = useState<string[]>([""]);
  const [inspection, setInspection] = useState<InspectionField[]>([
    { key: "", label: "", type: "boolean" },
  ]);
  const [reportCategories, setReportCategories] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "admin_municipal") router.replace("/dashboard");
  }, [router]);

  function slugify(v: string): string {
    return v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const cleanChecklist = checklist.map((v) => v.trim()).filter(Boolean);
    const cleanInspection = inspection
      .map((f) => ({ ...f, key: f.key.trim(), label: f.label.trim() }))
      .filter((f) => f.key && f.label);
    const cleanCategories = reportCategories.map((v) => v.trim()).filter(Boolean);

    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = "El nombre es obligatorio.";
    if (!description.trim()) localErrors.description = "La descripción es obligatoria.";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setLoading(false);
      return;
    }

    const key = slugify(name);

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          key,
          name: name.trim(),
          description: description.trim(),
          icon: icon.trim() || undefined,
          checklistItems: cleanChecklist,
          inspectionFields: cleanInspection,
          reportCategories: cleanCategories,
          isCustom: true,
        }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear el tipo.");
        }
        return;
      }
      router.push("/tipos-vehiculo");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Tipos de vehículo"
        title="Nuevo tipo personalizado"
        subtitle="Crea un tipo de vehículo con formularios de inspección y categorías de reporte propios."
      />

      {error && (
        <div
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

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Datos generales
          </h3>
          <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="name" style={{ display: "block", marginBottom: 8 }}>
                Nombre
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`field${fieldErrors.name ? " field-error" : ""}`}
                placeholder="Ej. Camión recolector de residuos orgánicos"
              />
              {fieldErrors.name && (
                <p style={{ color: "#DC2626", fontSize: "0.8125rem", marginTop: 6 }}>{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="description" style={{ display: "block", marginBottom: 8 }}>
                Descripción
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`field${fieldErrors.description ? " field-error" : ""}`}
                style={{ height: "auto", padding: "14px 18px", resize: "vertical" }}
              />
              {fieldErrors.description && (
                <p style={{ color: "#DC2626", fontSize: "0.8125rem", marginTop: 6 }}>{fieldErrors.description}</p>
              )}
            </div>
            <div>
              <label htmlFor="icon" style={{ display: "block", marginBottom: 8 }}>
                Ícono (opcional)
              </label>
              <input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="field"
                placeholder="Ej. truck, recycle"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Checklist de pre-salida
          </h3>
          <StringListEditor
            items={checklist}
            onChange={setChecklist}
            placeholder="Ej. Luces delanteras funcionan"
          />
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Formulario de inspección
          </h3>
          <InspectionEditor items={inspection} onChange={setInspection} />
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Categorías de reporte ciudadano
          </h3>
          <StringListEditor
            items={reportCategories}
            onChange={setReportCategories}
            placeholder="Ej. Conducción peligrosa"
          />
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Crear tipo
          </Button>
          <Link href="/tipos-vehiculo">
            <Button type="button" variant="outline" size="lg">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
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
            variant="ghost"
            type="button"
            size="md"
            onClick={() => {
              if (items.length === 1) {
                onChange([""]);
              } else {
                onChange(items.filter((_, i) => i !== idx));
              }
            }}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
      >
        + Agregar
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
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 180px auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            className="field"
            placeholder="Key (ej. frenos)"
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
            onClick={() => {
              if (items.length === 1) {
                onChange([{ key: "", label: "", type: "boolean" }]);
              } else {
                onChange(items.filter((_, i) => i !== idx));
              }
            }}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...items, { key: "", label: "", type: "boolean" }])
        }
      >
        + Agregar campo
      </Button>
    </div>
  );
}
