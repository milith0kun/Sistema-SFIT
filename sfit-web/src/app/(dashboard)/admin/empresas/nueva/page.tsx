"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe2, AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Department = { code: string; name: string };
type Municipality = {
  id: string;
  name: string;
  ubigeoCode?: string;
  departmentName?: string;
  active: boolean;
};
type StoredUser = { role: string };

type ServiceScope = "interprovincial_regional" | "interregional_nacional";
type AuthorityLevel = "regional" | "mtc";

interface AuthorizationEntry {
  level: AuthorityLevel;
  issuedBy: string;
  resolutionNumber: string;
  issuedAt: string;
}

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const G   = "#B8860B"; const RED = "#b91c1c"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const GRN = "#15803d"; const GRN_BG = "#F0FDF4";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";

const FIELD: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 12px",
  border: `1.5px solid ${INK2}`, borderRadius: 9,
  fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

export default function NuevaEmpresaNacionalPage() {
  const router = useRouter();
  const [user,         setUser]         = useState<StoredUser | null>(null);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [activeMunis,  setActiveMunis]  = useState<Municipality[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});
  const [loading,      setLoading]      = useState(false);

  // Form fields
  const [razonSocial,  setRazonSocial]  = useState("");
  const [ruc,          setRuc]          = useState("");
  const [serviceScope, setServiceScope] = useState<ServiceScope>("interprovincial_regional");
  const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
  const [municipalityId, setMunicipalityId] = useState("");
  const [repName,      setRepName]      = useState("");
  const [repDni,       setRepDni]       = useState("");
  const [repPhone,     setRepPhone]     = useState("");
  const [auths, setAuths] = useState<AuthorizationEntry[]>([
    { level: "regional", issuedBy: "", resolutionNumber: "", issuedAt: "" },
  ]);

  // ── Permisos ──
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  // ── Cargar departamentos y muni's activas (para sede) ──
  const loadCatalogs = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem("sfit_access_token");
    try {
      const [deptRes, muniRes] = await Promise.all([
        fetch("/api/admin/departamentos", { headers: { Authorization: `Bearer ${token ?? ""}` } }),
        fetch("/api/municipalidades?active=true&limit=200", { headers: { Authorization: `Bearer ${token ?? ""}` } }),
      ]);
      const deptData = await deptRes.json();
      const muniData = await muniRes.json();
      if (deptData?.success) setDepartments(deptData.data.items ?? []);
      if (muniData?.success) setActiveMunis(muniData.data.items ?? []);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { void loadCatalogs(); }, [loadCatalogs]);

  // ── Autorizaciones helpers ──
  function addAuth() {
    setAuths((prev) => [...prev, { level: "regional", issuedBy: "", resolutionNumber: "", issuedAt: "" }]);
  }
  function removeAuth(idx: number) {
    setAuths((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateAuth(idx: number, patch: Partial<AuthorizationEntry>) {
    setAuths((prev) => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
  }

  function toggleDepto(code: string) {
    setSelectedDeptos((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});

    // Client-side validation
    const errs: Record<string, string> = {};
    if (razonSocial.trim().length < 2) errs.razonSocial = "Razón social requerida";
    if (!/^\d{11}$/.test(ruc.trim()))   errs.ruc         = "RUC debe tener 11 dígitos";
    if (!municipalityId)                 errs.municipalityId = "Seleccione sede activa";
    if (repName.trim().length < 2)       errs.repName     = "Nombre del representante requerido";
    if (!/^\d{6,12}$/.test(repDni.trim())) errs.repDni    = "DNI inválido";
    if (selectedDeptos.length === 0)     errs.coverage    = "Seleccione al menos 1 departamento de cobertura";
    if (serviceScope === "interregional_nacional" && selectedDeptos.length < 2)
      errs.coverage = "Servicio nacional requiere al menos 2 departamentos";
    if (auths.length === 0) errs.auths = "Agregue al menos 1 autorización";
    auths.forEach((a, i) => {
      if (!a.issuedBy.trim() || !a.resolutionNumber.trim()) {
        errs[`auth_${i}`] = "Entidad emisora y número de resolución requeridos";
      }
    });
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const body = {
        municipalityId,
        razonSocial: razonSocial.trim(),
        ruc: ruc.trim(),
        representanteLegal: {
          name: repName.trim(),
          dni:  repDni.trim(),
          ...(repPhone.trim() ? { phone: repPhone.trim() } : {}),
        },
        serviceScope,
        coverage: {
          departmentCodes: selectedDeptos,
          provinceCodes: [],
          districtCodes: [],
        },
        authorizations: auths.map((a) => ({
          level: a.level,
          scope: serviceScope,
          ...(a.issuedBy.trim()         ? { issuedBy: a.issuedBy.trim() }                 : {}),
          ...(a.resolutionNumber.trim() ? { resolutionNumber: a.resolutionNumber.trim() } : {}),
          ...(a.issuedAt                ? { issuedAt: new Date(a.issuedAt).toISOString() } : {}),
        })),
      };

      const res = await fetch("/api/admin/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear la empresa.");
        }
        return;
      }
      router.push("/admin/empresas");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        kicker="Vista nacional · super_admin"
        title="Nueva empresa interprovincial / nacional"
        subtitle="Crea empresas con scope mayor a un distrito. Las urbano-distritales se gestionan desde su municipalidad."
        action={
          <Link href="/admin/empresas">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 7, height: 36,
              padding: "0 14px", borderRadius: 9,
              border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
              color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <ArrowLeft size={15} />Volver
            </button>
          </Link>
        }
      />

      {error && (
        <div style={{
          padding: "10px 14px", background: RED_BG, border: `1.5px solid ${RED_BD}`,
          borderRadius: 9, color: RED, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ── Sección 1: Modalidad ── */}
        <Section icon={<Globe2 size={15} color={INFO_C} />} title="Modalidad de servicio">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ScopeOption
              active={serviceScope === "interprovincial_regional"}
              onClick={() => setServiceScope("interprovincial_regional")}
              label="Interprovincial / Regional"
              desc="Entre provincias o departamentos. Autoridad: gobierno regional + MTC."
            />
            <ScopeOption
              active={serviceScope === "interregional_nacional"}
              onClick={() => setServiceScope("interregional_nacional")}
              label="Nacional"
              desc="Entre 2+ departamentos. Autoridad: MTC."
            />
          </div>
        </Section>

        {/* ── Sección 2: Datos generales ── */}
        <Section icon={<Building2 size={15} color={INFO_C} />} title="Datos generales">
          <Row>
            <FieldBlock label="Razón social" error={fieldErrors.razonSocial}>
              <input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej. Cruz del Sur S.A."
                style={{ ...FIELD, borderColor: fieldErrors.razonSocial ? RED : INK2 }}
              />
            </FieldBlock>
            <FieldBlock label="RUC (11 dígitos)" error={fieldErrors.ruc}>
              <input
                value={ruc}
                onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="20100061421"
                inputMode="numeric"
                style={{ ...FIELD, borderColor: fieldErrors.ruc ? RED : INK2, fontFamily: "ui-monospace,monospace" }}
              />
            </FieldBlock>
          </Row>

          <FieldBlock label="Sede (municipalidad activa)" error={fieldErrors.municipalityId}>
            <select
              value={municipalityId}
              onChange={(e) => setMunicipalityId(e.target.value)}
              style={{ ...FIELD, cursor: "pointer", borderColor: fieldErrors.municipalityId ? RED : INK2 }}
            >
              <option value="">Selecciona la municipalidad sede…</option>
              {activeMunis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ubigeoCode ?? "—"} — {m.name} ({m.departmentName ?? "—"})
                </option>
              ))}
            </select>
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: INK5 }}>
              Domicilio fiscal de la empresa. Solo aparecen muni&apos;s incorporadas al sistema.
            </p>
          </FieldBlock>
        </Section>

        {/* ── Sección 3: Cobertura ── */}
        <Section icon={<Globe2 size={15} color={INFO_C} />} title="Cobertura — departamentos donde opera">
          {fieldErrors.coverage && (
            <div style={{ marginBottom: 10, color: RED, fontSize: "0.8125rem", fontWeight: 500 }}>
              {fieldErrors.coverage}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6 }}>
            {departments.map((d) => {
              const checked = selectedDeptos.includes(d.code);
              return (
                <label key={d.code} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8,
                  border: `1.5px solid ${checked ? GRN : INK2}`,
                  background: checked ? GRN_BG : "#fff",
                  cursor: "pointer", fontSize: "0.8125rem", color: INK6,
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDepto(d.code)}
                    style={{ accentColor: GRN, cursor: "pointer" }}
                  />
                  <span style={{
                    fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem",
                    color: checked ? GRN : INK5,
                  }}>{d.code}</span>
                  <span style={{ fontWeight: checked ? 600 : 500, color: checked ? GRN : INK9 }}>
                    {d.name}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: "0.75rem", color: INK5 }}>
            {selectedDeptos.length} departamento{selectedDeptos.length === 1 ? "" : "s"} seleccionado{selectedDeptos.length === 1 ? "" : "s"}
            {serviceScope === "interregional_nacional" && " · Mínimo 2 para servicio nacional"}
          </div>
        </Section>

        {/* ── Sección 4: Representante legal ── */}
        <Section icon={<Building2 size={15} color={INFO_C} />} title="Representante legal">
          <Row>
            <FieldBlock label="Nombre completo" error={fieldErrors.repName}>
              <input
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                placeholder="Ej. Juan Pérez López"
                style={{ ...FIELD, borderColor: fieldErrors.repName ? RED : INK2 }}
              />
            </FieldBlock>
            <FieldBlock label="DNI" error={fieldErrors.repDni}>
              <input
                value={repDni}
                onChange={(e) => setRepDni(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="08123456"
                inputMode="numeric"
                style={{ ...FIELD, borderColor: fieldErrors.repDni ? RED : INK2, fontFamily: "ui-monospace,monospace" }}
              />
            </FieldBlock>
            <FieldBlock label="Teléfono (opcional)">
              <input
                value={repPhone}
                onChange={(e) => setRepPhone(e.target.value)}
                placeholder="+51 999 999 999"
                style={FIELD}
              />
            </FieldBlock>
          </Row>
        </Section>

        {/* ── Sección 5: Autorizaciones ── */}
        <Section
          icon={<CheckCircle size={15} color={INFO_C} />}
          title="Autorizaciones (resoluciones)"
          right={
            <button type="button" onClick={addAuth} style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px",
              borderRadius: 8, border: `1.5px solid ${INK2}`, background: "#fff",
              fontSize: "0.75rem", fontWeight: 600, color: INK6, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Plus size={12} />Agregar
            </button>
          }
        >
          {fieldErrors.auths && (
            <div style={{ marginBottom: 10, color: RED, fontSize: "0.8125rem", fontWeight: 500 }}>
              {fieldErrors.auths}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {auths.map((a, i) => {
              const err = fieldErrors[`auth_${i}`];
              return (
                <div key={i} style={{
                  border: `1.5px solid ${err ? RED : INK2}`, borderRadius: 10, padding: 12,
                  background: err ? RED_BG : "#fafafa",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 150px auto", gap: 10, alignItems: "end" }}>
                    <FieldBlock label="Autoridad">
                      <select
                        value={a.level}
                        onChange={(e) => updateAuth(i, { level: e.target.value as AuthorityLevel })}
                        style={{ ...FIELD, cursor: "pointer" }}
                      >
                        <option value="regional">Gob. Regional</option>
                        <option value="mtc">MTC</option>
                      </select>
                    </FieldBlock>
                    <FieldBlock label="Entidad emisora">
                      <input
                        value={a.issuedBy}
                        onChange={(e) => updateAuth(i, { issuedBy: e.target.value })}
                        placeholder="Ej. Gobierno Regional Cusco"
                        style={FIELD}
                      />
                    </FieldBlock>
                    <FieldBlock label="N° resolución">
                      <input
                        value={a.resolutionNumber}
                        onChange={(e) => updateAuth(i, { resolutionNumber: e.target.value })}
                        placeholder="Ej. RES-2024-001"
                        style={{ ...FIELD, fontFamily: "ui-monospace,monospace" }}
                      />
                    </FieldBlock>
                    <FieldBlock label="Fecha emisión">
                      <input
                        type="date"
                        value={a.issuedAt}
                        onChange={(e) => updateAuth(i, { issuedAt: e.target.value })}
                        style={FIELD}
                      />
                    </FieldBlock>
                    {auths.length > 1 && (
                      <button type="button" onClick={() => removeAuth(i)} title="Eliminar autorización"
                        style={{
                          height: 40, width: 40, borderRadius: 9,
                          border: `1.5px solid ${INK2}`, background: "#fff",
                          color: RED, cursor: "pointer", display: "inline-flex",
                          alignItems: "center", justifyContent: "center",
                        }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {err && (
                    <div style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{err}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Info legal */}
        <div style={{
          padding: "12px 16px", background: INFO_BG, border: `1.5px solid ${INFO_BD}`,
          borderRadius: 9, color: INFO_C, fontSize: "0.8125rem", lineHeight: 1.5,
        }}>
          Las empresas con scope <strong>interprovincial</strong> son fiscalizadas por SUTRAN. Las <strong>nacionales</strong> requieren autorización del MTC. El RUC debe ser único en el sistema (validación SUNAT).
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Link href="/admin/empresas">
            <button type="button" style={{
              height: 42, padding: "0 22px", borderRadius: 10,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Cancelar
            </button>
          </Link>
          <button type="submit" disabled={loading} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 42, padding: "0 24px", borderRadius: 10,
            border: `1.5px solid ${G}`, background: G, color: "#fff",
            fontSize: "0.9375rem", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Creando…" : "Crear empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Helpers de layout ─────────────────────────────────────────────────── */

function Section({
  icon, title, right, children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", borderBottom: `1px solid ${INK1}`, gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: INFO_BG,
            border: `1.5px solid ${INFO_BD}`, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>{icon}</div>
          <strong style={{ fontSize: "0.9375rem", color: INK9 }}>{title}</strong>
        </div>
        {right}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 12, marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function FieldBlock({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {error && (
        <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{error}</p>
      )}
    </div>
  );
}

function ScopeOption({
  active, onClick, label, desc,
}: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      textAlign: "left", padding: 14, borderRadius: 10,
      border: `2px solid ${active ? G : INK2}`,
      background: active ? "#FDF8EC" : "#fff",
      cursor: "pointer", fontFamily: "inherit",
    }}>
      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: active ? "#78530A" : INK9, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.75rem", color: active ? "#92400E" : INK5, lineHeight: 1.4 }}>
        {desc}
      </div>
    </button>
  );
}
