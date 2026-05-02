"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Department  = { code: string; name: string };
type Province    = { id: string; name: string; departmentCode?: string };
type Municipality = {
  id: string; name: string;
  ubigeoCode?: string;
  departmentName?: string;
  provinceName?: string;
  active: boolean;
};
type StoredUser  = { role: string; provinceId?: string };

/* ── Tokens visuales ── */
const INK9 = "#18181b"; const INK6 = "#52525b"; const INK5 = "#71717a";
const INK2 = "#e4e4e7"; const INK1 = "#f4f4f5";
const GOLD = "#B8860B"; const GOLD_BG = "#FDF8EC"; const GOLD_BD = "#E8D090";
const RED  = "#b91c1c"; const RED_BG  = "#FFF5F5"; const RED_BD  = "#FCA5A5";
const GRN  = "#15803d"; const GRN_BG  = "#F0FDF4"; const GRN_BD  = "#86EFAC";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";

const FIELD: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 12px",
  border: `1.5px solid ${INK2}`, borderRadius: 9,
  fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};

export default function ActivarMunicipalidadPage() {
  const router = useRouter();
  const [user,             setUser]             = useState<StoredUser | null>(null);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [provinces,        setProvinces]        = useState<Province[]>([]);
  const [results,          setResults]          = useState<Municipality[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [provinceFilter,   setProvinceFilter]   = useState("");
  const [q,                setQ]                = useState("");
  const [loading,          setLoading]          = useState(false);
  const [activatingId,     setActivatingId]     = useState<string | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [recentActivated,  setRecentActivated]  = useState<string[]>([]);

  // ── Cargar usuario y permisos ──
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial"].includes(u.role)) {
      router.replace("/dashboard"); return;
    }
    setUser(u);
  }, [router]);

  const isSA = user?.role === "super_admin";

  // ── Cargar departamentos (super_admin) ──
  useEffect(() => {
    if (!user || !isSA) return;
    const token = localStorage.getItem("sfit_access_token");
    fetch("/api/admin/departamentos", { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then((r) => r.json())
      .then((d) => { if (d?.success) setDepartments(d.data.items ?? []); })
      .catch(() => { /* silent */ });
  }, [user, isSA]);

  // ── Cargar provincias filtradas por depto ──
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("sfit_access_token");
    const qs = new URLSearchParams();
    if (departmentFilter) qs.set("departmentCode", departmentFilter);
    qs.set("limit", "200");
    fetch(`/api/provincias?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then((r) => r.json())
      .then((d) => { if (d?.success) setProvinces(d.data.items ?? []); })
      .catch(() => { /* silent */ });
    setProvinceFilter("");
  }, [user, departmentFilter]);

  // ── Buscar inactivas ──
  const search = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      qs.set("active", "false");
      qs.set("limit", "200");
      if (departmentFilter) qs.set("departmentCode", departmentFilter);
      if (provinceFilter)   qs.set("provinceId", provinceFilter);
      if (q.trim())         qs.set("q", q.trim());
      const res = await fetch(`/api/municipalidades?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/dashboard");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al buscar.");
        return;
      }
      setResults(data.data.items ?? []);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [user, departmentFilter, provinceFilter, q, router]);

  // Auto-buscar cuando cambian los filtros (con pequeño debounce)
  useEffect(() => {
    const t = setTimeout(() => { void search(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Activar ──
  async function activate(m: Municipality) {
    if (!m.ubigeoCode) {
      setError(`"${m.name}" no pertenece al catálogo UBIGEO.`);
      return;
    }
    setActivatingId(m.id); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/admin/municipalidades/${m.id}/activar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo activar.");
        return;
      }
      setResults((prev) => prev.filter((x) => x.id !== m.id));
      setRecentActivated((prev) => [m.name, ...prev].slice(0, 5));
    } catch { setError("Error de conexión."); }
    finally { setActivatingId(null); }
  }

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        kicker="Catálogo UBIGEO INEI"
        title="Activar municipalidad del catálogo"
        subtitle="Busca un distrito y actívalo para incorporarlo al sistema. El catálogo proviene del INEI; no se crean municipalidades a mano."
        action={
          <Link href="/municipalidades">
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

      {recentActivated.length > 0 && (
        <div style={{
          padding: "10px 14px", background: GRN_BG, border: `1.5px solid ${GRN_BD}`,
          borderRadius: 9, color: GRN, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <CheckCircle size={14} />
          <span>Activadas en esta sesión:</span>
          <strong>{recentActivated.join(", ")}</strong>
        </div>
      )}

      <div
        className={isSA ? "muni-nueva-filters muni-nueva-filters--3" : "muni-nueva-filters muni-nueva-filters--2"}
        style={{
          background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
          padding: 18, gap: 12, alignItems: "end",
        }}
      >
        {isSA && (
          <div>
            <label style={LABEL}>Departamento</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={FIELD}
            >
              <option value="">Todos</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={LABEL}>Provincia</label>
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            style={FIELD}
          >
            <option value="">Todas</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL}>Buscar por nombre</label>
          <div style={{ position: "relative" }}>
            <Search size={14} color={INK5} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. Wanchaq, San Sebastián…"
              style={{ ...FIELD, paddingLeft: 34 }}
            />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          padding: "12px 18px", borderBottom: `1px solid ${INK1}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={16} color={INK6} />
            <strong style={{ fontSize: "0.875rem", color: INK9 }}>
              Inactivas en el catálogo
            </strong>
            <span style={{ fontSize: "0.75rem", color: INK5 }}>
              {loading ? "buscando…" : `${results.length} resultado${results.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {results.length === 0 && !loading ? (
          <div style={{ padding: "32px 18px", textAlign: "center", color: INK5, fontSize: "0.875rem" }}>
            No se encontraron municipalidades inactivas con esos filtros.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {results.map((m, i) => (
              <li
                key={m.id}
                className="muni-nueva-row"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", gap: 12,
                  borderTop: i > 0 ? `1px solid ${INK1}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{
                    display: "inline-flex", padding: "2px 8px", borderRadius: 6,
                    background: INK9, color: "#fff",
                    fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem",
                    flexShrink: 0,
                  }}>
                    {m.ubigeoCode ?? "?"}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{m.name}</div>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>
                      {m.provinceName ?? "—"} · {m.departmentName ?? "—"}
                    </div>
                  </div>
                </div>
                <button
                  disabled={activatingId === m.id}
                  onClick={() => void activate(m)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 32, padding: "0 14px", borderRadius: 8,
                    border: `1.5px solid ${GOLD}`, background: GOLD,
                    color: "#fff", fontSize: "0.8125rem", fontWeight: 700,
                    cursor: activatingId === m.id ? "wait" : "pointer",
                    opacity: activatingId === m.id ? 0.6 : 1,
                    fontFamily: "inherit", flexShrink: 0,
                  }}
                >
                  <CheckCircle size={13} />
                  {activatingId === m.id ? "Activando…" : "Activar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{
        background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 10,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: "#fff",
          border: `1.5px solid ${GOLD_BD}`, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Building2 size={14} color={GOLD} />
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#78530A", lineHeight: 1.5 }}>
          Las municipalidades activadas quedan disponibles en el formulario público de registro y en
          los selectores del sistema. Para suspender una municipalidad activa, ve a {" "}
          <Link href="/municipalidades" style={{ color: GOLD, fontWeight: 600 }}>el listado principal</Link>.
        </div>
      </div>
      <div style={{
        padding: "10px 14px", background: INFO_BG, border: `1.5px solid ${INFO_BD}`,
        borderRadius: 9, color: INFO_C, fontSize: "0.75rem",
      }}>
        El catálogo proviene del INEI (UBIGEO oficial). Si necesitas un distrito que no aparece,
        re-siembra con: <code>npx tsx scripts/seed-ubigeo.ts</code>
      </div>
    </div>
  );
}
