"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, AlertTriangle, CheckCircle, Building2, Hash,
  Loader2, Truck,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { useToast } from "@/hooks/useToast";

/**
 * Mi empresa — vista del operador para consultar datos de su empresa
 * y editar campos de contacto. Los datos legales (razón social, RUC,
 * representante, scope) son read-only y solo el admin municipal puede
 * cambiarlos.
 */

type StoredUser = { role: string };

interface CompanyDetail {
  id: string;
  municipalityId: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  documents: { name: string; url: string }[];
  active: boolean;
  reputationScore: number;
  serviceScope?: string;
}

interface ContactForm {
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}

const ALLOWED = ["operador"];

const SERVICE_SCOPE_LABEL: Record<string, string> = {
  urbano_distrital: "Urbano distrital",
  urbano_provincial: "Urbano provincial",
  interprovincial_regional: "Interprovincial regional",
  interregional_nacional: "Interregional nacional",
};

/* Paleta */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif",
};
const READ: React.CSSProperties = { ...FIELD, background: INK1, color: INK6 };
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

export default function MiEmpresaPage() {
  const router = useRouter();
  const toast = useToast();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [contact, setContact] = useState<ContactForm>({
    address: "", phone: "", email: "", logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sfit_user") : null;
    if (!raw) { router.replace("/login"); return; }
    let u: StoredUser;
    try { u = JSON.parse(raw) as StoredUser; }
    catch { router.replace("/login"); return; }
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/operador/mi-empresa", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la empresa.");
        return;
      }
      const c: CompanyDetail = data.data;
      setCompany(c);
      // Los campos editables aún no están en el modelo Company; los
      // mantenemos en estado local con stub de localStorage hasta que
      // backend exponga PATCH para address/phone/email/logoUrl directos.
      const draftRaw = localStorage.getItem(`sfit_company_contact_${c.id}`);
      if (draftRaw) {
        try { setContact(JSON.parse(draftRaw)); } catch { /* ignore */ }
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!company) return;
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      // El modelo Company actual no expone address/phone/email/logoUrl como
      // campos top-level. Mientras el backend agrega esos campos, persistimos
      // localmente para que el operador no pierda lo que escribió y enviamos
      // SOLO los campos que el endpoint sí acepta (vehicleTypeKeys es uno de
      // los whitelisted en /api/empresas/[id] PATCH; no lo tocamos aquí
      // porque queremos que esto sea una operación inocua).
      // Si hay logoUrl válido, lo agregamos a documents como "Logo de la empresa".
      const payload: Record<string, unknown> = {};
      if (contact.logoUrl) {
        const docs = (company.documents ?? []).filter(d => d.name !== "logo");
        if (contact.logoUrl.match(/^https?:\/\//)) {
          docs.push({ name: "logo", url: contact.logoUrl });
        }
        payload.documents = docs;
      }

      // Persiste contacto localmente
      localStorage.setItem(`sfit_company_contact_${company.id}`, JSON.stringify(contact));

      // Solo PATCHeamos si hay algo válido para el backend
      if (Object.keys(payload).length > 0) {
        const res = await fetch(`/api/empresas/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) {
          toast.warn("Tu rol no permite editar el logo. Cambios guardados localmente.");
        } else {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.success) {
            setError(data?.error ?? "No se pudo guardar el logo.");
            return;
          }
        }
      }

      toast.success("Datos de contacto actualizados.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Mi cuenta · Empresa" title="Sin empresa asignada" />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          Aún no tienes una empresa asociada a tu cuenta de operador.
          <br />
          Pídele al administrador municipal que te asigne a la empresa
          que vas a gestionar.
        </div>
        <Link href="/dashboard" style={{
          alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
          height: 36, padding: "0 14px", borderRadius: 8,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
        }}>
          <ArrowLeft size={13} />Volver al dashboard
        </Link>
      </div>
    );
  }

  if (loading || !company) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Mi cuenta · Empresa" title="Cargando empresa…" />
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const scopeLabel = company.serviceScope
    ? SERVICE_SCOPE_LABEL[company.serviceScope] ?? company.serviceScope
    : "—";

  const heroAction = (
    <div style={{ display: "flex", gap: 6 }}>
      <Link href="/dashboard" style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
        fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
      }}>
        <ArrowLeft size={12} />Volver
      </Link>
      <button onClick={handleSave} disabled={saving}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px",
          borderRadius: 7, border: "none", background: "#fff", color: INK9,
          fontWeight: 700, fontSize: "0.8125rem", cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={12} />}
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Mi cuenta · Empresa"
        title={company.razonSocial}
        pills={[
          { label: "RUC", value: company.ruc },
          { label: "Modalidad", value: scopeLabel },
          { label: "Estado", value: company.active ? "Operativa" : "Suspendida", warn: !company.active },
        ]}
        action={heroAction}
      />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }} className="cols-2-responsive">

        {/* Columna principal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Datos legales (read-only) */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Datos legales"
            subtitle="Solo el administrador municipal puede modificarlos"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>Razón social</label>
                <input value={company.razonSocial} readOnly disabled style={READ} />
              </div>
              <div>
                <label style={LABEL}>RUC</label>
                <input value={company.ruc} readOnly disabled style={{ ...READ, fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em" }} />
              </div>
              <div>
                <label style={LABEL}>Modalidad de servicio</label>
                <input value={scopeLabel} readOnly disabled style={READ} />
              </div>
              <div>
                <label style={LABEL}>Representante legal</label>
                <input value={company.representanteLegal?.name ?? "—"} readOnly disabled style={READ} />
              </div>
              <div>
                <label style={LABEL}>DNI representante</label>
                <input value={company.representanteLegal?.dni ?? "—"} readOnly disabled style={{ ...READ, fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em" }} />
              </div>
            </div>
          </SectionCard>

          {/* Datos de contacto (editables) */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Datos de contacto"
            subtitle="Mantén tu información de contacto al día"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="address" style={LABEL}>Dirección fiscal</label>
                <input id="address" value={contact.address}
                  onChange={e => setContact(c => ({ ...c, address: e.target.value }))}
                  placeholder="Av. La Cultura 123, Cusco" style={FIELD} />
              </div>
              <div>
                <label htmlFor="phone" style={LABEL}>Teléfono</label>
                <input id="phone" value={contact.phone}
                  onChange={e => setContact(c => ({ ...c, phone: e.target.value }))}
                  placeholder="+51 984 ..." style={FIELD} />
              </div>
              <div>
                <label htmlFor="email" style={LABEL}>Email</label>
                <input id="email" type="email" value={contact.email}
                  onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                  placeholder="contacto@empresa.pe" style={FIELD} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="logoUrl" style={LABEL}>Logo (URL)</label>
                <input id="logoUrl" value={contact.logoUrl}
                  onChange={e => setContact(c => ({ ...c, logoUrl: e.target.value }))}
                  placeholder="https://…/logo.png" style={FIELD} />
                <p style={{ marginTop: 5, fontSize: "0.75rem", color: INK5 }}>
                  Sube el archivo a un servicio de almacenamiento y pega la URL aquí.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Tipos de vehículo autorizados */}
          <SectionCard
            icon={<Truck size={14} color={INK6} />}
            title="Tipos de vehículo autorizados"
            subtitle="Definidos por el administrador municipal según tu autorización"
          >
            {company.vehicleTypeKeys.length === 0 ? (
              <div style={{ color: INK5, fontSize: "0.8125rem", padding: "8px 0" }}>
                Aún no se han autorizado tipos de vehículo para tu empresa.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {company.vehicleTypeKeys.map(k => (
                  <span key={k} style={{
                    fontSize: "0.75rem", fontWeight: 600, color: INK6,
                    background: INK1, border: `1px solid ${INK2}`,
                    borderRadius: 999, padding: "4px 10px",
                  }}>{k}</span>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}` }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5,
              }}>Información del registro</div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Row k="ID empresa" v={company.id.slice(-8).toUpperCase()} mono icon={<Hash size={11} color={INK5} />} />
              <Row k="Reputación" v={`${company.reputationScore} / 100`} />
              <Row k="Estado" v={company.active ? "Operativa" : "Suspendida"} tone={company.active ? "apto" : "red"} />
              {company.documents && company.documents.length > 0 && (
                <Row k="Documentos" v={`${company.documents.length}`} />
              )}
            </div>
          </div>

          <div style={{
            background: APTO_BG, border: `1px solid ${APTO_BD}`, borderRadius: 12,
            padding: "12px 14px", display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <CheckCircle size={14} color={APTO} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
              Los datos legales (razón social, RUC, representante) son
              <strong> inmutables desde aquí</strong>. Para cambios contacta al
              administrador municipal de tu jurisdicción.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponentes ── */

function SectionCard({
  icon, title, subtitle, children,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: INK1, border: `1px solid ${INK2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function Row({
  k, v, mono, tone, icon,
}: {
  k: string; v: string; mono?: boolean;
  tone?: "apto" | "red"; icon?: React.ReactNode;
}) {
  const color = tone === "apto" ? "#15803d" : tone === "red" ? "#DC2626" : INK9;
  const bg = tone === "apto" ? APTO_BG : tone === "red" ? "#FFF5F5" : INK1;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, background: bg, gap: 8,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: INK5, flexShrink: 0 }}>
        {icon}{k}
      </span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 700, color,
        textAlign: "right",
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        letterSpacing: mono ? "0.04em" : 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{v}</span>
    </div>
  );
}
