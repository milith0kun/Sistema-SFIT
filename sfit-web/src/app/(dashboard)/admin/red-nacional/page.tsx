"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronDown, MapPin, Globe2, Building2, Users,
  Search, Maximize2, Minimize2, X,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

type Province = {
  id: string;
  code: string;        // 4 dígitos
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

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const G    = "#B8860B";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4";

export default function RedNacionalPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<StoredUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totals,      setTotals]      = useState<{
    departments: number; provinces: number; municipalities: number;
    activeMunicipalities: number; coveredDepartments: number;
  } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [openDepts,   setOpenDepts]   = useState<Set<string>>(new Set());
  const [openProvs,   setOpenProvs]   = useState<Set<string>>(new Set());
  const [districtsByProv, setDistrictsByProv] = useState<Record<string, District[]>>({});
  // Filtros / búsqueda
  const [query,         setQuery]         = useState("");
  const [statusFilter,  setStatusFilter]  = useState<"all" | "with_active" | "without_active">("all");

  // ── Permisos ──
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  // ── Cargar tree depto/provincias ──
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("sfit_access_token");
    setLoading(true); setError(null);
    fetch("/api/admin/red-nacional", { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.success) { setError(data?.error ?? "Error al cargar."); return; }
        setDepartments(data.data.departments ?? []);
        setTotals(data.data.totals ?? null);
      })
      .catch(() => setError("Error de conexión."))
      .finally(() => setLoading(false));
  }, [user]);

  // ── Lazy load de distritos por provincia ──
  const loadDistricts = useCallback(async (provinceId: string) => {
    if (districtsByProv[provinceId]) return;
    const token = localStorage.getItem("sfit_access_token");
    try {
      const res = await fetch(`/api/municipalidades?provinceId=${provinceId}&limit=200`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (data?.success) {
        setDistrictsByProv((prev) => ({
          ...prev,
          [provinceId]: data.data.items.map((m: { id: string; name: string; ubigeoCode?: string; active: boolean }) => ({
            id: m.id, name: m.name, ubigeoCode: m.ubigeoCode, active: m.active,
          })),
        }));
      }
    } catch { /* silent */ }
  }, [districtsByProv]);

  // ── Toggle activar muni desde el tree ──
  async function toggleMuni(districtId: string, provinceId: string, makeActive: boolean) {
    const token = localStorage.getItem("sfit_access_token");
    try {
      const res = await fetch(`/api/admin/municipalidades/${districtId}/activar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: makeActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data?.error ?? "Error al activar."); return; }

      // Update local
      setDistrictsByProv((prev) => ({
        ...prev,
        [provinceId]: (prev[provinceId] ?? []).map((d) =>
          d.id === districtId ? { ...d, active: makeActive } : d,
        ),
      }));
      // Refrescar conteos del tree
      const r = await fetch("/api/admin/red-nacional", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const j = await r.json();
      if (j?.success) {
        setDepartments(j.data.departments ?? []);
        setTotals(j.data.totals ?? null);
      }
    } catch { setError("Error de conexión."); }
  }

  function toggleDept(code: string) {
    setOpenDepts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function toggleProv(provId: string) {
    setOpenProvs((prev) => {
      const next = new Set(prev);
      if (next.has(provId)) next.delete(provId);
      else { next.add(provId); void loadDistricts(provId); }
      return next;
    });
  }

  // ── Filtrado en cliente (búsqueda + estado) ───────────────────────────────
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const filteredDepartments = useMemo(() => {
    const q = norm(query.trim());
    return departments
      .filter((d) => {
        if (statusFilter === "with_active"    && d.activeMunicipalities === 0) return false;
        if (statusFilter === "without_active" && d.activeMunicipalities >  0) return false;
        if (!q) return true;
        // Match en depto, o en alguna provincia que contenga
        if (norm(d.name).includes(q) || d.code.includes(q)) return true;
        return d.provinces.some(
          (p) => norm(p.name).includes(q) || p.code.includes(q),
        );
      })
      .map((d) => {
        if (!q) return d;
        // Si hay query, también filtramos las provincias dentro del depto
        // (a menos que el depto matchee directamente — entonces mostramos todas)
        if (norm(d.name).includes(q) || d.code.includes(q)) return d;
        return {
          ...d,
          provinces: d.provinces.filter(
            (p) => norm(p.name).includes(q) || p.code.includes(q),
          ),
        };
      });
  }, [departments, query, statusFilter]);

  // Auto-abrir resultados cuando hay búsqueda
  useEffect(() => {
    if (query.trim() === "") return;
    setOpenDepts(new Set(filteredDepartments.map((d) => d.code)));
  }, [query, filteredDepartments]);

  function expandAll() {
    setOpenDepts(new Set(filteredDepartments.map((d) => d.code)));
  }
  function collapseAll() {
    setOpenDepts(new Set());
    setOpenProvs(new Set());
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Vista nacional · super_admin"
        title="Red nacional"
        subtitle="Catálogo UBIGEO con incorporación al sistema. Click en un departamento para ver sus provincias y distritos."
      />

      <KPIStrip cols={4} items={[
        { label: "DEPARTAMENTOS", value: totals?.departments ?? "—",
          subtitle: `${totals?.coveredDepartments ?? 0} con muni activa`, icon: Globe2 },
        { label: "PROVINCIAS", value: totals?.provinces ?? "—",
          subtitle: "del país", icon: MapPin },
        { label: "DISTRITOS", value: totals?.municipalities ?? "—",
          subtitle: "en el catálogo", icon: Building2 },
        { label: "ACTIVOS", value: totals?.activeMunicipalities ?? "—",
          subtitle: "incorporados al sistema", icon: Users, accent: GRN },
      ]} />

      {error && (
        <div style={{
          padding: "10px 14px", background: "#FFF5F5", border: "1px solid #FCA5A5",
          borderRadius: 9, color: "#b91c1c", fontSize: "0.8125rem",
        }}>{error}</div>
      )}

      {/* ── Toolbar de búsqueda y filtros ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
        padding: "10px 12px",
      }}>
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 240 }}>
          <Search size={14} color={INK5} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none",
          }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar departamento, provincia o código UBIGEO…"
            style={{
              width: "100%", height: 36, paddingLeft: 34, paddingRight: query ? 32 : 12,
              borderRadius: 8, border: `1.5px solid ${INK2}`,
              fontSize: "0.8125rem", color: INK9, fontFamily: "inherit",
              outline: "none", background: "#fff", boxSizing: "border-box",
            }}
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{
            height: 36, padding: "0 10px", borderRadius: 8,
            border: `1.5px solid ${INK2}`, background: "#fff",
            fontSize: "0.8125rem", color: INK6, cursor: "pointer", fontFamily: "inherit",
            minWidth: 170,
          }}
        >
          <option value="all">Todos los departamentos</option>
          <option value="with_active">Con muni activa</option>
          <option value="without_active">Sin muni activa</option>
        </select>

        <div style={{ display: "inline-flex", gap: 6 }}>
          <button
            onClick={expandAll}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px",
              borderRadius: 8, border: `1.5px solid ${INK2}`, background: "#fff",
              fontSize: "0.75rem", fontWeight: 600, color: INK6, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Maximize2 size={13} />
            Expandir
          </button>
          <button
            onClick={collapseAll}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px",
              borderRadius: 8, border: `1.5px solid ${INK2}`, background: "#fff",
              fontSize: "0.75rem", fontWeight: 600, color: INK6, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Minimize2 size={13} />
            Colapsar
          </button>
        </div>

        <div style={{
          marginLeft: "auto", fontSize: "0.75rem", color: INK5,
          fontVariantNumeric: "tabular-nums",
        }}>
          {filteredDepartments.length} / {departments.length} departamentos
        </div>
      </div>

      <div style={{
        background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
        padding: 4, overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: INK5, fontSize: "0.875rem" }}>
            Cargando red nacional…
          </div>
        ) : departments.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: INK5, fontSize: "0.875rem" }}>
            No hay datos en el catálogo. Ejecuta seed-ubigeo.ts.
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: INK5, fontSize: "0.875rem" }}>
            Sin resultados para los filtros aplicados.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filteredDepartments.map((d) => {
              const isOpen = openDepts.has(d.code);
              const interprovincial = d.companiesByScope?.interprovincial_regional ?? 0;
              const nacional = d.companiesByScope?.interregional_nacional ?? 0;
              const urbano = (d.companiesByScope?.urbano_distrital ?? 0) +
                             (d.companiesByScope?.urbano_provincial ?? 0);
              return (
                <li key={d.code} style={{ borderBottom: `1px solid ${INK1}` }}>
                  <button
                    onClick={() => toggleDept(d.code)}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 10,
                      padding: "12px 16px", background: "transparent", border: 0,
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    }}
                  >
                    {isOpen ? <ChevronDown size={15} color={INK6} /> : <ChevronRight size={15} color={INK6} />}
                    <span style={{
                      display: "inline-flex", padding: "1px 7px", borderRadius: 5,
                      background: INK9, color: "#fff",
                      fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem",
                    }}>{d.code}</span>
                    <strong style={{ fontSize: "0.9375rem", color: INK9, flex: 1 }}>{d.name}</strong>
                    <span style={{ fontSize: "0.75rem", color: GRN, fontWeight: 700 }}>
                      {d.activeMunicipalities}/{d.totalMunicipalities} activos
                    </span>
                    <span style={{ fontSize: "0.75rem", color: INK5 }}>
                      {d.totalProvinces} prov
                    </span>
                    {(urbano + interprovincial + nacional) > 0 && (
                      <span style={{ fontSize: "0.6875rem", color: INK6 }}>
                        {urbano} urb · {interprovincial} interprov · {nacional} nac
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <ul style={{ listStyle: "none", margin: 0, padding: "0 0 8px 36px", background: "#fafafa" }}>
                      {d.provinces.map((p) => {
                        const provOpen = openProvs.has(p.id);
                        const districts = districtsByProv[p.id] ?? null;
                        return (
                          <li key={p.id}>
                            <button
                              onClick={() => toggleProv(p.id)}
                              style={{
                                display: "flex", width: "100%", alignItems: "center", gap: 10,
                                padding: "8px 14px", background: "transparent", border: 0,
                                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                                borderTop: `1px solid ${INK1}`,
                              }}
                            >
                              {provOpen ? <ChevronDown size={13} color={INK6} /> : <ChevronRight size={13} color={INK6} />}
                              <span style={{
                                display: "inline-flex", padding: "1px 6px", borderRadius: 5,
                                background: G, color: "#fff",
                                fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.625rem",
                              }}>{p.code}</span>
                              <span style={{ fontSize: "0.875rem", color: INK9, flex: 1 }}>{p.name}</span>
                              <span style={{ fontSize: "0.7rem", color: GRN, fontWeight: 600 }}>
                                {p.activeMunicipalities}/{p.totalMunicipalities}
                              </span>
                            </button>

                            {provOpen && (
                              <ul style={{
                                listStyle: "none", margin: 0,
                                padding: "0 0 6px 32px", background: "#fff",
                              }}>
                                {districts === null ? (
                                  <li style={{ padding: "8px 12px", color: INK5, fontSize: "0.75rem" }}>
                                    Cargando distritos…
                                  </li>
                                ) : districts.length === 0 ? (
                                  <li style={{ padding: "8px 12px", color: INK5, fontSize: "0.75rem" }}>
                                    Sin distritos.
                                  </li>
                                ) : (
                                  districts.map((dist) => (
                                    <li key={dist.id} style={{
                                      display: "flex", alignItems: "center", gap: 10,
                                      padding: "6px 12px", borderTop: `1px solid ${INK1}`,
                                      background: dist.active ? GRNBG : "#fff",
                                    }}>
                                      <span style={{
                                        display: "inline-flex", padding: "1px 6px", borderRadius: 5,
                                        background: dist.active ? GRN : INK9, color: "#fff",
                                        fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.625rem",
                                      }}>{dist.ubigeoCode ?? "?"}</span>
                                      <span style={{
                                        flex: 1, fontSize: "0.8125rem",
                                        color: dist.active ? GRN : INK6,
                                        fontWeight: dist.active ? 600 : 400,
                                      }}>{dist.name}</span>
                                      <button
                                        onClick={() => void toggleMuni(dist.id, p.id, !dist.active)}
                                        style={{
                                          height: 22, padding: "0 8px", borderRadius: 6,
                                          border: `1.5px solid ${dist.active ? GRN : INK2}`,
                                          background: dist.active ? GRN : "#fff",
                                          color: dist.active ? "#fff" : INK6,
                                          fontSize: "0.6875rem", fontWeight: 700,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >
                                        {dist.active ? "Activa" : "Activar"}
                                      </button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
