"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Eye, Check, X, Download, Camera, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

type ReportStatus = "pendiente" | "revision" | "validado" | "rechazado";
type FraudLayer = { layer: string; passed: boolean; detail: string };
type Report = {
  id: string;
  vehicle?: { plate: string; vehicleTypeKey: string } | null;
  citizen?: { name: string } | null;
  category: string;
  citizenReputationLevel: number;
  status: ReportStatus;
  description: string;
  evidenceUrl?: string;
  imageUrls?: string[];
  fraudScore: number;
  fraudLayers: FraudLayer[];
  createdAt: string;
};
type StatusCounts = Partial<Record<ReportStatus, number>>;

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF"; const INFOBD = "#BFDBFE";
const G = "#6C0606"; const GD = "#4A0303"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function fmtAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };
const btnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6 };

export default function ReportesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Report[]>([]);
  const [tab, setTab] = useState<ReportStatus>("pendiente");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [sel, setSel] = useState<Report | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ status: tab, limit: "50" });
      const res = await fetch(`/api/reportes?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      const newItems: Report[] = data.data.items ?? [];
      setItems(newItems);
      setCounts(data.data.statusCounts ?? {});
      // Mantener selección si sigue presente
      setSel((prev) => {
        if (prev) {
          const refreshed = newItems.find((r) => r.id === prev.id);
          if (refreshed) return refreshed;
        }
        return newItems[0] ?? null;
      });
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, tab, router]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: ReportStatus) => {
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/reportes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo actualizar el reporte"); return; }
      void load();
    } catch { setError("Error de conexión"); }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      if (tab) qs.set("status", tab);
      const res = await fetch(`/api/admin/exportar/reportes?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) { setError("No se pudo exportar el CSV"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reportes_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Error de conexión al exportar"); }
  };

  const columns = useMemo<ColumnDef<Report, unknown>[]>(() => [
    {
      id: "reporte",
      header: "Reporte",
      accessorFn: (row) => `RC-${row.id.slice(-6).toUpperCase()} ${row.vehicle?.plate ?? ""}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>
            RC-{row.original.id.slice(-6).toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            {row.original.vehicle && (
              <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem" }}>
                {row.original.vehicle.plate}
              </span>
            )}
            <span style={{ fontSize: "0.75rem", color: INK5 }}>{fmtAgo(row.original.createdAt)}</span>
          </div>
        </div>
      ),
    },
    {
      id: "categoria",
      header: "Categoría",
      accessorFn: (row) => `${row.category} ${row.description}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.category}</div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            Nivel {row.original.citizenReputationLevel} reputación
          </div>
        </div>
      ),
    },
    {
      id: "descripcion",
      header: "Descripción",
      accessorFn: (row) => row.description,
      cell: ({ row }) => (
        <div style={{ fontSize: "0.8125rem", color: INK6, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.original.description}
        </div>
      ),
    },
    {
      id: "veracidad",
      header: "Veracidad",
      accessorFn: (row) => row.fraudScore,
      cell: ({ row }) => {
        const score = row.original.fraudScore;
        const color = score >= 80 ? APTO : score >= 60 ? RIESGO : NO;
        return (
          <div style={{ minWidth: 80 }}>
            <div style={{ fontWeight: 800, color }}>
              {score}<span style={{ fontWeight: 400, fontSize: "0.75rem", color: INK5 }}>/100</span>
            </div>
            <div style={{ height: 4, background: INK1, borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", background: color, width: `${score}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Link href={`/reportes/${row.original.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
        </div>
      ),
    },
  ], []);

  if (!user) return null;

  const TAB_LABELS: Record<ReportStatus, string> = { pendiente: "Pendientes", revision: "En revisión", validado: "Validados", rechazado: "Rechazados" };

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Ciudadanía · RF-12" title="Reportes ciudadanos"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnOut} onClick={exportCSV} disabled={items.length === 0}>
              <Download size={16} />Exportar CSV
            </button>
          </div>
        } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { ico: <Flag size={18} />, lbl: "Pendientes", val: counts.pendiente ?? 0, bg: GBG, ic: GD },
          { ico: <Eye size={18} />, lbl: "En revisión", val: counts.revision ?? 0, bg: INFOBG, ic: INFO },
          { ico: <Check size={18} />, lbl: "Validados (mes)", val: counts.validado ?? 0, bg: APTOBG, ic: APTO },
          { ico: <X size={18} />, lbl: "Rechazados", val: counts.rechazado ?? 0, bg: NOBG, ic: NO },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${INK2}`, marginBottom: 18 }}>
        {(["pendiente","revision","validado","rechazado"] as ReportStatus[]).map(k => (
          <div key={k} onClick={() => { setTab(k); setSel(null); }}
            style={{ padding: "10px 14px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", borderBottom: tab === k ? `2px solid ${G}` : "2px solid transparent", marginBottom: -1, color: tab === k ? INK9 : INK5 }}>
            {TAB_LABELS[k]} <span style={{ marginLeft: 6, fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 999, background: tab === k ? GBG : INK1, color: tab === k ? GD : INK5, fontWeight: 700 }}>{counts[k] ?? 0}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          onRowClick={(row) => setSel(row)}
          searchPlaceholder="Buscar por placa, categoría, descripción…"
          emptyTitle={`Sin reportes ${TAB_LABELS[tab].toLowerCase()}`}
          emptyDescription="No se encontraron reportes en esta categoría."
        />

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}`, gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>RC-{sel.id.slice(-6).toUpperCase()} · {sel.category}</div>
                <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{fmtAgo(sel.createdAt)} · Nivel {sel.citizenReputationLevel}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, background: GBG, color: GD, border: `1px solid ${GBR}` }}>Score {sel.fraudScore}</span>
            </div>
            <div style={{ padding: 18 }}>
              {(() => {
                // La app móvil envía imageUrls[]; el dashboard antiguo usaba evidenceUrl.
                // Soportamos ambos: priorizamos imageUrls (puede haber varias fotos),
                // con fallback a evidenceUrl.
                const imgs: string[] = sel.imageUrls && sel.imageUrls.length > 0
                  ? sel.imageUrls
                  : (sel.evidenceUrl ? [sel.evidenceUrl] : []);
                if (imgs.length === 0) {
                  return (
                    <div style={{ aspectRatio: "16/9", borderRadius: 10, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, flexDirection: "column", gap: 8 }}>
                      <Camera size={28} />
                      <div style={{ fontSize: "0.75rem" }}>Sin evidencia adjunta</div>
                    </div>
                  );
                }
                const first = imgs[0];
                const isImage = /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(first);
                return (
                  <div>
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={first}
                        alt={`Evidencia RC-${sel.id.slice(-6).toUpperCase()}`}
                        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10, border: `1px solid ${INK2}` }}
                      />
                    ) : (
                      <a href={first} target="_blank" rel="noopener noreferrer" style={{ display: "flex", aspectRatio: "16/9", borderRadius: 10, background: INK1, border: `1px solid ${INK2}`, alignItems: "center", justifyContent: "center", color: INK6, flexDirection: "column", gap: 8, textDecoration: "none" }}>
                        <Camera size={28} />
                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Ver evidencia adjunta</div>
                      </a>
                    )}
                    {imgs.length > 1 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {imgs.slice(1).map((u, i) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ width: 56, height: 56, borderRadius: 7, overflow: "hidden", border: `1px solid ${INK2}`, flexShrink: 0 }}>
                            <img src={u} alt={`Foto ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div style={{ marginTop: 14, padding: 12, background: INK1, borderRadius: 10, fontSize: "0.8125rem", lineHeight: 1.5, color: INK6 }}>&ldquo;{sel.description}&rdquo;</div>

              {sel.fraudLayers.length > 0 && (
                <>
                  <p className="kicker" style={{ margin: "16px 0 8px" }}>Capas anti-fraude</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {sel.fraudLayers.map((l, i) => (
                      <div key={i} style={{ padding: 10, border: `1px solid ${INK2}`, borderRadius: 9, display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: l.passed ? APTOBG : RIESGOBG, color: l.passed ? APTO : RIESGO, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {l.passed ? <Check size={12} /> : <AlertTriangle size={12} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.layer}</div>
                          <div style={{ fontSize: "0.6875rem", color: INK5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sel.status === "pendiente" && (
                <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  <button style={{ ...btnSm, flex: 1, minWidth: 110 }} onClick={() => updateStatus(sel.id, "revision")}><Eye size={14} />Tomar para revisión</button>
                  <button style={{ ...btnSm, flex: 1, minWidth: 100 }} onClick={() => updateStatus(sel.id, "rechazado")}><X size={14} />Rechazar</button>
                  <button style={{ ...btnInk, flex: 1, minWidth: 100, height: 32, fontSize: "0.8125rem" }} onClick={() => updateStatus(sel.id, "validado")}><Check size={14} />Validar</button>
                </div>
              )}
              {sel.status === "revision" && (
                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <button style={{ ...btnSm, flex: 1 }} onClick={() => updateStatus(sel.id, "rechazado")}><X size={14} />Rechazar</button>
                  <button style={{ ...btnInk, flex: 1, height: 32, fontSize: "0.8125rem" }} onClick={() => updateStatus(sel.id, "validado")}><Check size={14} />Validar</button>
                </div>
              )}
              {(sel.status === "validado" || sel.status === "rechazado") && (
                <div style={{ marginTop: 18, padding: 12, background: INK1, borderRadius: 9, fontSize: "0.8125rem", color: INK5, textAlign: "center" }}>
                  Reporte resuelto · estado: <strong style={{ color: INK9 }}>{sel.status}</strong>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Seleccione un reporte</div>
        )}
      </div>
    </div>
  );
}
