"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronDown, MapPin, Globe2, Building2, Users,
  Search, Inbox, Check, Loader2, X, BarChart3, Truck, ArrowLeft,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMobileOverlayBack } from "@/hooks/useMobileOverlayBack";

type Province = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  totalMunicipalities: number;
  activeMunicipalities: number;
};
type Department = {
  code: string;
  name: string;
  provinces: Province[];
  totalProvinces: number;
  totalMunicipalities: number;
  activeMunicipalities: number;
  companiesByScope: Record<string, number>;
};
type District = {
  id: string;
  name: string;
  ubigeoCode?: string;
  active: boolean;
};
type StoredUser = { role: string };
type StateFilter = "all" | "with_active" | "without_active";

// Tokens — paleta sobria (gris + acento verde sólo para "activo", rojo para errores)
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN = "#15803d";

function getToken() {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default function RedNacionalPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totals, setTotals] = useState<{
    departments: number; provinces: number; municipalities: number;
    activeMunicipalities: number; coveredDepartments: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selección + expansión interna del detalle
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [openProvs, setOpenProvs] = useState<Set<string>>(new Set());
  const [districtsByProv, setDistrictsByProv] = useState<Record<string, District[]>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Filtros
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");

  // Permisos
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const refreshTree = useCallback(async () => {
    const res = await fetch("/api/admin/red-nacional", { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    if (data?.success) {
      setDepartments(data.data.departments ?? []);
      setTotals(data.data.totals ?? null);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (!user) return;
    setLoading(true); setError(null);
    fetch("/api/admin/red-nacional", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => {
        if (!data?.success) { setError(data?.error ?? "Error al cargar."); return; }
        setDepartments(data.data.departments ?? []);
        setTotals(data.data.totals ?? null);
      })
      .catch(() => setError("Error de conexión."))
      .finally(() => setLoading(false));
  }, [user]);

  // Lazy load de distritos por provincia
  const loadDistricts = useCallback(async (provinceId: string) => {
    if (districtsByProv[provinceId]) return;
    try {
      const res = await fetch(`/api/municipalidades?provinceId=${provinceId}&limit=200`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data?.success) {
        setDistrictsByProv(prev => ({
          ...prev,
          [provinceId]: data.data.items.map((m: { id: string; name: string; ubigeoCode?: string; active: boolean }) => ({
            id: m.id, name: m.name, ubigeoCode: m.ubigeoCode, active: m.active,
          })),
        }));
      }
    } catch { /* silent */ }
  }, [districtsByProv]);

  async function toggleMuni(districtId: string, provinceId: string, makeActive: boolean) {
    setTogglingId(districtId);
    try {
      const res = await fetch(`/api/admin/municipalidades/${districtId}/activar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ active: makeActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data?.error ?? "Error al activar."); return; }
      setDistrictsByProv(prev => ({
        ...prev,
        [provinceId]: (prev[provinceId] ?? []).map(d =>
          d.id === districtId ? { ...d, active: makeActive } : d
        ),
      }));
      void refreshTree();
    } catch { setError("Error de conexión."); }
    finally { setTogglingId(null); }
  }

  function toggleProv(provId: string) {
    setOpenProvs(prev => {
      const next = new Set(prev);
      if (next.has(provId)) next.delete(provId);
      else { next.add(provId); void loadDistricts(provId); }
      return next;
    });
  }

  // Lista filtrada
  const filteredDepartments = useMemo(() => {
    const q = norm(query.trim());
    return departments.filter(d => {
      if (stateFilter === "with_active" && d.activeMunicipalities === 0) return false;
      if (stateFilter === "without_active" && d.activeMunicipalities > 0) return false;
      if (!q) return true;
      if (norm(d.name).includes(q) || d.code.includes(q)) return true;
      return d.provinces.some(p => norm(p.name).includes(q) || p.code.includes(q));
    });
  }, [departments, query, stateFilter]);

  // Auto-seleccionar el primero SÓLO en desktop. En mobile abriria el
  // overlay fullscreen al entrar a la pagina sin que el usuario lo pidiera.
  useEffect(() => {
    if (filteredDepartments.length === 0) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 901px)").matches;
    if (!isDesktop) return;
    if (!selectedCode) {
      setSelectedCode(filteredDepartments[0].code);
    } else if (!filteredDepartments.find(d => d.code === selectedCode)) {
      setSelectedCode(filteredDepartments[0]?.code ?? null);
    }
  }, [filteredDepartments, selectedCode]);

  const selected = useMemo(
    () => departments.find(d => d.code === selectedCode) ?? null,
    [departments, selectedCode]
  );

  // Back del navegador en mobile cierra el overlay en lugar de salir.
  useMobileOverlayBack(
    Boolean(selected),
    useCallback(() => setSelectedCode(null), []),
    "red-nacional-detail"
  );

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <PageHeader
        kicker="Vista nacional · super_admin"
        title="Red nacional"
        subtitle={`${totals?.departments ?? 0} departamentos · ${totals?.activeMunicipalities ?? 0} municipalidades activas`}
      />

      <KPIStrip cols={4} items={[
        { label: "DEPARTAMENTOS", value: totals?.departments ?? "—",
          subtitle: `${totals?.coveredDepartments ?? 0} con muni activa`, icon: Globe2 },
        { label: "PROVINCIAS", value: totals?.provinces ?? "—",
          subtitle: "del país", icon: MapPin },
        { label: "DISTRITOS", value: totals?.municipalities ?? "—",
          subtitle: "en el catálogo", icon: Building2 },
        { label: "ACTIVOS", value: totals?.activeMunicipalities ?? "—",
          subtitle: "incorporados", icon: Users, accent: GRN },
      ]} />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 9, color: RED, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <X size={14} />{error}
        </div>
      )}

      <Toolbar
        query={query} setQuery={setQuery}
        stateFilter={stateFilter} setStateFilter={setStateFilter}
        totalCount={departments.length}
        filteredCount={filteredDepartments.length}
      />

      {/* Grid: lista de deptos + detalle. En mobile la columna desktop se
          oculta y al seleccionar se abre overlay fullscreen. */}
      <div className="red-nacional-grid">
        {/* Lista de departamentos */}
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <ListSkeleton />
          ) : filteredDepartments.length === 0 ? (
            <ListEmpty hasData={departments.length > 0} onClear={() => { setQuery(""); setStateFilter("all"); }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredDepartments.map(d => (
                <DepartmentRow
                  key={d.code}
                  dept={d}
                  selected={selectedCode === d.code}
                  onSelect={() => { setSelectedCode(d.code); setOpenProvs(new Set()); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panel de detalle desktop (≥901px) */}
        <div className="red-nacional-detail-desktop" style={{ position: "sticky", top: 16, minWidth: 0 }}>
          {selected ? (
            <DepartmentDetail
              dept={selected}
              openProvs={openProvs}
              districtsByProv={districtsByProv}
              togglingId={togglingId}
              onToggleProv={toggleProv}
              onToggleMuni={toggleMuni}
            />
          ) : (
            <DetailEmpty />
          )}
        </div>
      </div>

      {/* ── Overlay mobile (≤900px) ─────────────────────────────────────────
          Al tap-ear un departamento en mobile abrimos el detalle como sheet
          fullscreen — caso contrario la lista y el detalle compartían
          ancho insuficiente y todo quedaba ilegible. */}
      {selected && typeof document !== "undefined" && createPortal(
        <div className="red-nacional-detail-mobile-overlay" role="dialog" aria-modal="true" aria-label="Detalle del departamento">
          <div style={{
            position: "sticky", top: 0, zIndex: 2,
            background: "#fff", borderBottom: `1px solid ${INK2}`,
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <button
              onClick={() => setSelectedCode(null)}
              aria-label="Volver al listado"
              style={{
                width: 38, height: 38, borderRadius: 9,
                border: `1.5px solid ${INK2}`, background: "#fff",
                color: INK9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700,
                color: INK5, letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>Departamento</div>
              <div style={{
                fontSize: "0.8125rem", color: INK9, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginTop: 2,
              }}>{selected.code} · {selected.name}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 24px" }}>
            <DepartmentDetail
              dept={selected}
              openProvs={openProvs}
              districtsByProv={districtsByProv}
              togglingId={togglingId}
              onToggleProv={toggleProv}
              onToggleMuni={toggleMuni}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─────────── Toolbar ─────────── */

function Toolbar({
  query, setQuery, stateFilter, setStateFilter, totalCount, filteredCount,
}: {
  query: string; setQuery: (v: string) => void;
  stateFilter: StateFilter; setStateFilter: (v: StateFilter) => void;
  totalCount: number; filteredCount: number;
}) {
  const tabs: { id: StateFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "with_active", label: "Con activa" },
    { id: "without_active", label: "Sin activa" },
  ];
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      padding: "10px 12px",
      display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    }}>
      <div style={{ position: "relative", flex: "1 1 280px", minWidth: 240 }}>
        <Search size={14} color={INK5} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none",
        }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar departamento, provincia o código UBIGEO…"
          style={{
            width: "100%", height: 34, paddingLeft: 34, paddingRight: query ? 32 : 12,
            borderRadius: 8, border: `1px solid ${INK2}`,
            fontSize: "0.8125rem", color: INK9, fontFamily: "inherit",
            outline: "none", background: "#fff", boxSizing: "border-box",
          }}
          onFocus={e => { e.target.style.borderColor = INK9; }}
          onBlur={e => { e.target.style.borderColor = INK2; }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 22, height: 22, borderRadius: 6, border: "none",
              background: INK1, color: INK6, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ display: "inline-flex", gap: 4 }}>
        {tabs.map(t => {
          const active = stateFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setStateFilter(t.id)}
              style={{
                padding: "5px 11px", borderRadius: 7,
                border: active ? `1px solid ${INK9}` : `1px solid ${INK2}`,
                background: active ? INK9 : "#fff",
                color: active ? "#fff" : INK6,
                fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 120ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{
        marginLeft: "auto", fontSize: "0.75rem", color: INK5,
        fontVariantNumeric: "tabular-nums",
      }}>
        {filteredCount} / {totalCount} departamentos
      </div>
    </div>
  );
}

/* ─────────── Fila de departamento ─────────── */

function DepartmentRow({
  dept, selected, onSelect,
}: {
  dept: Department; selected: boolean; onSelect: () => void;
}) {
  const pct = dept.totalMunicipalities > 0
    ? Math.round((dept.activeMunicipalities / dept.totalMunicipalities) * 100)
    : 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      style={{
        background: selected ? INK1 : "#fff",
        border: `1px solid ${selected ? INK9 : INK2}`,
        borderLeft: `3px solid ${selected ? INK9 : INK2}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "border-color 120ms, background 120ms",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = INK5; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = INK2; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 28, height: 22, padding: "0 6px", borderRadius: 5,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem",
          flexShrink: 0,
        }}>
          {dept.code}
        </span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: "0.875rem", fontWeight: 600,
          color: INK9,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {dept.name}
        </span>
        {dept.activeMunicipalities > 0 && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: GRN, flexShrink: 0,
          }} aria-label="con muni activa" />
        )}
        <span style={{
          fontSize: "0.75rem", color: INK6,
          fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0,
        }}>
          {dept.activeMunicipalities}/{dept.totalMunicipalities}
        </span>
        <ChevronRight size={14} color={INK5} style={{ flexShrink: 0 }} />
      </div>
      {/* Microbar de progreso */}
      <div style={{
        marginTop: 7, height: 3, borderRadius: 2,
        background: INK2, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: pct === 0 ? "transparent" : INK9,
          transition: "width 200ms",
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 4,
        fontSize: "0.6875rem", color: INK5,
      }}>
        <span>{dept.totalProvinces} prov</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: INK6, fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/* ─────────── Panel detalle ─────────── */

function DepartmentDetail({
  dept, openProvs, districtsByProv, togglingId, onToggleProv, onToggleMuni,
}: {
  dept: Department;
  openProvs: Set<string>;
  districtsByProv: Record<string, District[]>;
  togglingId: string | null;
  onToggleProv: (provId: string) => void;
  onToggleMuni: (distId: string, provId: string, active: boolean) => void;
}) {
  const urb =
    (dept.companiesByScope?.urbano_distrital ?? 0) +
    (dept.companiesByScope?.urbano_provincial ?? 0);
  const interprov = dept.companiesByScope?.interprovincial_regional ?? 0;
  const nacional  = dept.companiesByScope?.interregional_nacional ?? 0;
  const totalEmp  = urb + interprov + nacional;
  const pct = dept.totalMunicipalities > 0
    ? Math.round((dept.activeMunicipalities / dept.totalMunicipalities) * 100)
    : 0;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header neutro */}
      <div style={{
        borderBottom: `1px solid ${INK2}`,
        padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 32, height: 24, padding: "0 8px", borderRadius: 5,
            background: INK9, color: "#fff",
            fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem",
            flexShrink: 0,
          }}>
            {dept.code}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: INK5, marginBottom: 2,
            }}>
              Departamento
            </div>
            <div style={{
              fontSize: "1.0625rem", fontWeight: 700, color: INK9,
              letterSpacing: "-0.01em", lineHeight: 1.2, wordBreak: "break-word",
            }}>
              {dept.name}
            </div>
          </div>
        </div>

        {/* Mini KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          <MiniStat icon={<MapPin size={11} />} label="Provincias" value={dept.totalProvinces} />
          <MiniStat icon={<Building2 size={11} />} label="Distritos" value={dept.totalMunicipalities} />
          <MiniStat
            icon={<Check size={11} />}
            label="Activos"
            value={`${dept.activeMunicipalities}`}
            sub={`${pct}%`}
            highlight={dept.activeMunicipalities > 0}
          />
        </div>

        {totalEmp > 0 && (
          <div style={{
            marginTop: 10, padding: "8px 10px", borderRadius: 8,
            background: INK1, border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", gap: 8,
            flexWrap: "wrap",
          }}>
            <Truck size={12} color={INK6} />
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: INK6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Empresas
            </span>
            <div style={{
              display: "flex", gap: 10, marginLeft: "auto",
              fontSize: "0.75rem", color: INK6, flexWrap: "wrap",
            }}>
              <span><strong style={{ color: INK9, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{urb}</strong> urb</span>
              <span><strong style={{ color: INK9, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{interprov}</strong> interprov</span>
              <span><strong style={{ color: INK9, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{nacional}</strong> nac</span>
            </div>
          </div>
        )}
      </div>

      {/* Lista de provincias */}
      <div style={{ padding: "12px 12px 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 4px 8px",
        }}>
          <span style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: INK5,
          }}>
            Provincias del departamento
          </span>
          <span style={{
            fontSize: "0.6875rem", color: INK5, fontVariantNumeric: "tabular-nums",
          }}>
            {dept.provinces.length}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dept.provinces.map(p => (
            <ProvinceItem
              key={p.id}
              prov={p}
              isOpen={openProvs.has(p.id)}
              districts={districtsByProv[p.id] ?? null}
              togglingId={togglingId}
              onToggle={() => onToggleProv(p.id)}
              onToggleMuni={(distId, active) => onToggleMuni(distId, p.id, active)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProvinceItem({
  prov, isOpen, districts, togglingId, onToggle, onToggleMuni,
}: {
  prov: Province; isOpen: boolean;
  districts: District[] | null;
  togglingId: string | null;
  onToggle: () => void;
  onToggleMuni: (distId: string, active: boolean) => void;
}) {
  const pct = prov.totalMunicipalities > 0
    ? Math.round((prov.activeMunicipalities / prov.totalMunicipalities) * 100)
    : 0;
  return (
    <div style={{
      border: `1px solid ${isOpen ? INK5 : INK2}`,
      borderRadius: 8,
      overflow: "hidden",
      background: "#fff",
      transition: "border-color 140ms",
    }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", width: "100%", alignItems: "center", gap: 10,
          padding: "9px 12px", background: isOpen ? INK1 : "#fff",
          border: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          transition: "background 120ms",
        }}
      >
        {isOpen ? <ChevronDown size={13} color={INK6} /> : <ChevronRight size={13} color={INK6} />}
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 36, height: 20, padding: "0 6px", borderRadius: 4,
          background: INK6, color: "#fff",
          fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem",
        }}>
          {prov.code}
        </span>
        <span style={{
          flex: 1, fontSize: "0.8125rem", fontWeight: 600, color: INK9,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {prov.name}
        </span>
        {prov.activeMunicipalities > 0 && (
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GRN, flexShrink: 0 }} aria-label="activa" />
        )}
        <span style={{
          fontSize: "0.75rem", color: INK6,
          fontWeight: 600, fontVariantNumeric: "tabular-nums",
        }}>
          {prov.activeMunicipalities}/{prov.totalMunicipalities}
        </span>
        <span style={{
          fontSize: "0.6875rem", color: INK5, fontVariantNumeric: "tabular-nums",
          minWidth: 32, textAlign: "right",
        }}>
          {pct}%
        </span>
      </button>

      {isOpen && (
        <div style={{ borderTop: `1px solid ${INK2}`, background: INK1 }}>
          {districts === null ? (
            <div style={{
              padding: "14px 14px 14px 38px", color: INK5, fontSize: "0.75rem",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} />
              Cargando distritos…
            </div>
          ) : districts.length === 0 ? (
            <div style={{ padding: "14px 14px 14px 38px", color: INK5, fontSize: "0.75rem" }}>
              Sin distritos en este catálogo.
            </div>
          ) : (
            <div>
              {/* Sub-header indicando jerarquía: estos son distritos de la provincia */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px 6px 38px",
                fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5,
              }}>
                <span>Distritos de {prov.name}</span>
                <span style={{ flex: 1, height: 1, background: INK2 }} />
                <span style={{ fontVariantNumeric: "tabular-nums", color: INK6 }}>{districts.length}</span>
              </div>

              {/* Lista de distritos con indentación + línea vertical conectora */}
              <div style={{
                position: "relative",
                paddingLeft: 22, // espacio para la línea conectora
                paddingRight: 8,
                paddingBottom: 8,
              }}>
                {/* Línea vertical jerárquica que conecta la provincia con sus distritos */}
                <div aria-hidden style={{
                  position: "absolute",
                  left: 22, top: 0, bottom: 12,
                  width: 1, background: INK2,
                }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {districts.map((dist) => {
                    const isLoading = togglingId === dist.id;
                    return (
                      <div key={dist.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px 7px 18px",
                        background: "#fff", border: `1px solid ${INK2}`, borderRadius: 6,
                        position: "relative",
                      }}>
                        {/* Pequeño tick horizontal saliendo de la línea vertical */}
                        <span aria-hidden style={{
                          position: "absolute", left: -10, top: "50%",
                          width: 10, height: 1, background: INK2,
                        }} />
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 52, height: 18, padding: "0 6px", borderRadius: 4,
                          background: "#fff", color: INK6, border: `1px solid ${INK2}`,
                          fontFamily: "ui-monospace,monospace", fontWeight: 600, fontSize: "0.625rem",
                          flexShrink: 0, letterSpacing: "0.02em",
                        }}>
                          {dist.ubigeoCode ?? "?"}
                        </span>
                        {dist.active && (
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GRN, flexShrink: 0 }} aria-label="activa" />
                        )}
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontSize: "0.8125rem",
                          color: INK9,
                          fontWeight: dist.active ? 600 : 500,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {dist.name}
                        </span>
                        <button
                          disabled={isLoading}
                          onClick={() => onToggleMuni(dist.id, !dist.active)}
                          title={dist.active ? "Desactivar municipalidad" : "Activar municipalidad"}
                          style={{
                            height: 22, padding: "0 9px", borderRadius: 5,
                            border: `1px solid ${INK2}`,
                            background: dist.active ? INK9 : "#fff",
                            color: dist.active ? "#fff" : INK6,
                            fontSize: "0.6875rem", fontWeight: 600,
                            cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                            opacity: isLoading ? 0.5 : 1,
                            display: "inline-flex", alignItems: "center", gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          {isLoading
                            ? <Loader2 size={10} style={{ animation: "spin 0.7s linear infinite" }} />
                            : dist.active ? <Check size={10} /> : null}
                          {dist.active ? "Activa" : "Activar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Mini stat ─────────── */

function MiniStat({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode; label: string;
  value: string | number; sub?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "9px 11px", borderRadius: 8,
      background: INK1, border: `1px solid ${INK2}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: INK6, marginBottom: 4,
      }}>
        {icon}{label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{
          fontSize: "1.125rem", fontWeight: 800, color: INK9,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
        }}>
          {value}
        </span>
        {sub && (
          <span style={{
            fontSize: "0.75rem", fontWeight: 600,
            color: highlight ? GRN : INK5,
            fontVariantNumeric: "tabular-nums",
          }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Estados vacíos / loading ─────────── */

function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 9,
          padding: "10px 12px",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="skeleton-shimmer" style={{ width: 32, height: 22, borderRadius: 5, flexShrink: 0 }} />
            <div className="skeleton-shimmer" style={{ flex: 1, height: 14, borderRadius: 5 }} />
            <div className="skeleton-shimmer" style={{ width: 40, height: 14, borderRadius: 5, flexShrink: 0 }} />
          </div>
          <div className="skeleton-shimmer" style={{ marginTop: 8, height: 4, borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

function ListEmpty({ hasData, onClear }: { hasData: boolean; onClear: () => void }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      padding: "48px 24px", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hasData ? <Search size={24} color={INK5} strokeWidth={1.5} /> : <Inbox size={24} color={INK5} strokeWidth={1.5} />}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, marginBottom: 3 }}>
          {hasData ? "Sin resultados" : "Catálogo vacío"}
        </div>
        <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 260, lineHeight: 1.5 }}>
          {hasData
            ? "Ningún departamento coincide con los filtros aplicados."
            : "No hay datos en el catálogo. Ejecuta seed-ubigeo.ts."}
        </div>
      </div>
      {hasData && (
        <button onClick={onClear} style={{
          height: 32, padding: "0 14px", borderRadius: 8,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function DetailEmpty() {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14,
      padding: "60px 24px", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BarChart3 size={22} color={INK5} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>Selecciona un departamento</div>
      <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 280, lineHeight: 1.5 }}>
        Haz clic en cualquier departamento de la lista para ver sus provincias y distritos, y activar municipalidades.
      </div>
    </div>
  );
}
