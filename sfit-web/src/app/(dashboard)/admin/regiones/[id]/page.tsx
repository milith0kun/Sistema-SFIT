"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Globe2, MapPin, Save, AlertTriangle, Power, Check, Loader2, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { Badge } from "@/components/ui/Badge";

type Province = {
  id: string;
  name: string;
  active: boolean;
  ubigeoCode?: string;
};

type RegionDetail = {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  provinces: Province[];
  createdAt?: string;
  updatedAt?: string;
};

type StoredUser = {
  role: string;
  regionId?: string;
  provinceId?: string;
  municipalityId?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
};

interface Props { params: Promise<{ id: string }> }

// Tokens — paleta sobria
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  border: `1px solid ${INK2}`, borderRadius: 8,
  fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

export default function RegionDetailPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state — solo super_admin
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Danger zone
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Auth gate — super_admin o admin_regional (limitado a su región)
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_regional"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    // admin_regional sólo puede ver su propia región
    if (u.role === "admin_regional" && u.regionId && u.regionId !== id) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router, id]);

  const isSA = user?.role === "super_admin";

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/regiones/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json() as ApiResponse<RegionDetail>;
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? "No se pudo cargar la región.");
        return;
      }
      setRegion(data.data);
      setName(data.data.name);
      setCode(data.data.code ?? "");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [user, id, router]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isSA) return;
    const errs: Record<string, string> = {};
    const nameTrim = name.trim();
    if (!nameTrim) errs.name = "El nombre es obligatorio.";
    else if (nameTrim.length < 2) errs.name = "Mínimo 2 caracteres.";
    else if (nameTrim.length > 100) errs.name = "Máximo 100 caracteres.";
    const codeTrim = code.trim();
    if (codeTrim && !/^\d{2}$/.test(codeTrim)) errs.code = "Debe ser exactamente 2 dígitos UBIGEO.";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true); setError(null); setFieldErrors({}); setSuccess(false);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const body: { name: string; code?: string } = { name: nameTrim };
      if (codeTrim) body.code = codeTrim;
      const res = await fetch(`/api/regiones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json() as ApiResponse<RegionDetail>;
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else { setError(data.error ?? "No se pudo guardar."); }
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Recargar datos completos para refrescar provincias
      void load();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!isSA) return;
    setDeactivating(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/regiones/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json() as ApiResponse<{ id: string; active: boolean }>;
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo desactivar la región.");
        return;
      }
      // Refrescar y volver al listado
      router.push("/admin/regiones");
    } catch { setError("Error de conexión."); }
    finally { setDeactivating(false); setConfirmDeactivate(false); }
  }

  if (notFound) return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        kicker="Red nacional · Jerarquía geográfica"
        title="Región no encontrada"
        action={
          <Link href="/admin/regiones">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px",
              borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <ArrowLeft size={15} />Volver
            </button>
          </Link>
        }
      />
      <div style={{
        padding: "32px 24px", background: "#fff", border: `1.5px solid ${INK2}`,
        borderRadius: 14, color: INK6, textAlign: "center",
      }}>
        La región solicitada no existe o fue eliminada.
      </div>
    </div>
  );

  if (!user) return null;

  if (loading || !region) return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader kicker="Red nacional · Jerarquía geográfica" title="Cargando región…" />
      <LoadingState rows={5} />
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        kicker="Red nacional · Jerarquía geográfica"
        title={region.name}
        subtitle={`${region.provinces.length} ${region.provinces.length === 1 ? "provincia asociada" : "provincias asociadas"}`}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge variant={region.active ? "activo" : "inactivo"}>
              {region.active ? "Activa" : "Inactiva"}
            </Badge>
            <Link href="/admin/regiones">
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 14px", borderRadius: 9,
                border: `1.5px solid ${INK2}`, background: "#fff",
                color: INK6, fontSize: "0.875rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                <ArrowLeft size={15} />Volver
              </button>
            </Link>
          </div>
        }
      />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      {success && (
        <div role="status" style={{
          padding: "10px 14px", background: GRNBG, border: `1px solid ${GRNBD}`,
          borderRadius: 8, color: GRN, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={14} />Cambios guardados correctamente.
        </div>
      )}

      {/* Sección 1 — Editar región (solo super_admin) */}
      {isSA && (
        <SectionCard
          icon={<Globe2 size={14} color={INK6} />}
          title="Editar región"
          description="Actualiza el nombre y el código UBIGEO de la región."
        >
          <form onSubmit={handleSave} style={{
            padding: 20, display: "flex", flexDirection: "column", gap: 18,
          }}>
            <div>
              <label style={LABEL}>Nombre de la región</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cusco, Arequipa"
                maxLength={100}
                style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK9; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK2; }}
              />
              {fieldErrors.name && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label style={LABEL}>
                Código UBIGEO
                <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                  (opcional, 2 dígitos)
                </span>
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="08"
                inputMode="numeric"
                maxLength={2}
                style={{
                  ...FIELD,
                  fontFamily: "ui-monospace, monospace",
                  borderColor: fieldErrors.code ? RED : INK2,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = fieldErrors.code ? RED : INK9; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.code ? RED : INK2; }}
              />
              {fieldErrors.code && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>
                  {fieldErrors.code}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "none", background: INK9, color: "#fff",
                  fontSize: "0.875rem", fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />Guardando…</>
                  : <><Save size={14} />Guardar cambios</>}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* Sección 2 — Provincias asociadas */}
      <SectionCard
        icon={<MapPin size={14} color={INK6} />}
        title="Provincias asociadas"
        description={
          region.provinces.length === 0
            ? "Esta región aún no tiene provincias vinculadas."
            : `${region.provinces.length} ${region.provinces.length === 1 ? "provincia" : "provincias"} en el catálogo UBIGEO de esta región.`
        }
      >
        {region.provinces.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: INK5, fontSize: "0.8125rem" }}>
            Sin provincias asociadas.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>UBIGEO</th>
                  <th style={TH_STYLE}>Provincia</th>
                  <th style={TH_STYLE}>Estado</th>
                  <th style={{ ...TH_STYLE, textAlign: "right" }}>Distritos</th>
                </tr>
              </thead>
              <tbody>
                {region.provinces.map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: idx < region.provinces.length - 1 ? `1px solid ${INK1}` : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                      {p.ubigeoCode ? (
                        <span style={{
                          display: "inline-flex", padding: "2px 8px", borderRadius: 5,
                          background: INK6, color: "#fff",
                          fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem",
                        }}>
                          {p.ubigeoCode}
                        </span>
                      ) : <span style={{ color: INK5, fontSize: "0.75rem" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                      <span style={{ fontWeight: 600, color: INK9 }}>{p.name}</span>
                    </td>
                    <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                      <Badge variant={p.active ? "activo" : "inactivo"}>
                        {p.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 16px", verticalAlign: "middle", textAlign: "right" }}>
                      <Link
                        href={`/municipalidades?provinceId=${p.id}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "6px 10px", borderRadius: 7,
                          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                          fontSize: "0.75rem", fontWeight: 600,
                          textDecoration: "none", fontFamily: "inherit",
                        }}
                      >
                        Ver distritos
                        <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Sección 3 — Acciones peligrosas (solo super_admin) */}
      {isSA && (
        <DangerZone
          regionActive={region.active}
          confirmDeactivate={confirmDeactivate}
          setConfirmDeactivate={setConfirmDeactivate}
          deactivating={deactivating}
          onDeactivate={() => { void handleDeactivate(); }}
        />
      )}
    </div>
  );
}

/* ── Estilos compartidos ── */
const TH_STYLE: React.CSSProperties = {
  textAlign: "left", padding: "10px 16px",
  fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.09em", textTransform: "uppercase",
  color: INK5, background: "#F8F9FA",
  borderBottom: `1px solid ${INK2}`,
  whiteSpace: "nowrap",
};

/* ── SectionCard reutilizable ── */
function SectionCard({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 18px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: INK1,
          border: `1px solid ${INK2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>
              {description}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Zona de peligro ── */
function DangerZone({
  regionActive, confirmDeactivate, setConfirmDeactivate, deactivating, onDeactivate,
}: {
  regionActive: boolean;
  confirmDeactivate: boolean;
  setConfirmDeactivate: (v: boolean) => void;
  deactivating: boolean;
  onDeactivate: () => void;
}) {
  if (!regionActive) {
    return (
      <div style={{
        background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
        padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: INK1,
          border: `1px solid ${INK2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Power size={15} color={INK5} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, marginBottom: 2 }}>
            Región inactiva
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.45 }}>
            Esta región ya está desactivada. Para reactivarla, edita el campo Estado vía API o reactivarla manualmente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff", border: `1px solid ${REDBD}`, borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 18px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
        background: REDBG,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: "#fff",
          border: `1px solid ${REDBD}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={14} color={RED} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: RED, lineHeight: 1.25 }}>
            Acciones peligrosas
          </div>
          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.3, marginTop: 1 }}>
            Cambios irreversibles que afectan a usuarios y provincias asociadas.
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {!confirmDeactivate ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, marginBottom: 4 }}>
                Desactivar región
              </div>
              <p style={{ fontSize: "0.8125rem", color: INK6, lineHeight: 1.5, margin: 0 }}>
                La región dejará de aparecer como activa. Los administradores regionales asignados perderán acceso al instante.
              </p>
            </div>
            <button
              onClick={() => setConfirmDeactivate(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 36, padding: "0 14px", borderRadius: 8,
                border: `1px solid ${REDBD}`, background: REDBG, color: RED,
                fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <Power size={13} />Desactivar región
            </button>
          </div>
        ) : (
          <div style={{
            background: REDBG, border: `1px solid ${REDBD}`, borderRadius: 8,
            padding: "12px 14px",
          }}>
            <div style={{ fontWeight: 700, color: RED, marginBottom: 4, fontSize: "0.875rem" }}>
              ¿Confirmar desactivación?
            </div>
            <p style={{ fontSize: "0.8125rem", color: INK6, marginBottom: 12, lineHeight: 1.5 }}>
              Esta acción es reversible vía API, pero no desde esta interfaz. Asegúrate antes de continuar.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onDeactivate}
                disabled={deactivating}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 32, padding: "0 14px", borderRadius: 7,
                  border: "none", background: RED, color: "#fff",
                  fontSize: "0.8125rem", fontWeight: 700,
                  cursor: deactivating ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: deactivating ? 0.7 : 1,
                }}
              >
                {deactivating
                  ? <><Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} />Desactivando…</>
                  : <><Power size={12} />Sí, desactivar</>}
              </button>
              <button
                onClick={() => setConfirmDeactivate(false)}
                disabled={deactivating}
                style={{
                  height: 32, padding: "0 14px", borderRadius: 7,
                  border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                  fontSize: "0.8125rem", fontWeight: 600,
                  cursor: deactivating ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: deactivating ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
