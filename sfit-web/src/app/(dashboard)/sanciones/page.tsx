"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Check, X, Download, Mail, Phone, Bell, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

import { hasWebPermission } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";
type SanctionStatus = "emitida" | "notificada" | "apelada" | "confirmada" | "anulada";
type Notification = { channel: string; target: string; status: string; sentAt?: string };
type Sanction = {
  id: string;
  vehicle: { plate: string };
  driver?: { name: string } | null;
  company?: { razonSocial: string } | null;
  faultType: string;
  amountSoles: number;
  amountUIT: string;
  status: SanctionStatus;
  notifications: Notification[];
  appealNotes?: string;
  createdAt: string;
};
type Stats = { emitida: number; notificada: number; apelada: number; confirmada: number; anulada: number; montoConfirmado: number };

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const G = "#6C0606"; const GD = "#4A0303"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function StepFlow({ status }: { status: SanctionStatus }) {
  const steps = [
    { k: "emitida", l: "Emitida" }, { k: "notificada", l: "Notificada" },
    { k: "apelacion", l: "Apelación" }, { k: "resuelta", l: "Resuelta" },
  ];
  const stepIdx = { emitida: 1, notificada: 2, apelada: 3, confirmada: 4, anulada: 4 }[status] ?? 1;
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "8px 0 18px" }}>
      {steps.map((s, i) => {
        const isDone = stepIdx > i + 1 || (stepIdx === i + 1 && status !== "emitida" && i === 0);
        const isCur = stepIdx === i + 1;
        const isApelada = status === "apelada" && i === 2;
        return (
          <div key={s.k} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8125rem", flexShrink: 0, background: isDone || (stepIdx > i + 1) ? APTO : isApelada ? "#fff" : isCur ? "#fff" : INK1, color: isDone || (stepIdx > i + 1) ? "#fff" : isApelada ? GD : isCur ? GD : INK5, border: isApelada || (isCur && i >= 1) ? `2px solid ${G}` : "2px solid transparent" }}>
                {(isDone || stepIdx > i + 1) ? <Check size={14} /> : i + 1}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: (isDone || stepIdx > i + 1) || isCur ? INK9 : INK5 }}>{s.l}</div>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: (stepIdx > i + 2) ? APTO : INK2, margin: "0 4px", marginBottom: 20 }} />}
          </div>
        );
      })}
    </div>
  );
}

const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };


export default function SancionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Sanction[]>([]);
  const [stats, setStats] = useState<Stats>({ emitida: 0, notificada: 0, apelada: 0, confirmada: 0, anulada: 0, montoConfirmado: 0 });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sel, setSel] = useState<Sanction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!hasWebPermission(u.role as Role, "sanciones", "view")) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: "50" });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/sanciones?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      const newItems: Sanction[] = data.data.items ?? [];
      setItems(newItems);
      if (data.data.stats) setStats(data.data.stats as Stats);
      // Mantener selección si sigue presente; si no, seleccionar la primera
      setSel((prev) => {
        if (prev) {
          const refreshed = newItems.find((i) => i.id === prev.id);
          if (refreshed) return refreshed;
        }
        return newItems[0] ?? null;
      });
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, statusFilter, router]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Reenvía la notificación de la sanción. El endpoint deriva canal y
   * destinatario automáticamente (email al operador por defecto) y agrega
   * una entrada en `notifications[]`. Si el status estaba "emitida", pasa
   * a "notificada" cuando se confirma la entrega.
   */
  const handleReenviar = async (id: string) => {
    if (reenviandoId) return;
    setReenviandoId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}/notificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ channel: "email" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setActionError(data.error ?? "No se pudo enviar la notificación");
        return;
      }
      setActionSuccess(
        data.data?.lastDelivery === "enviado"
          ? "Notificación enviada correctamente."
          : "Notificación registrada (entrega pendiente).",
      );
      setTimeout(() => setActionSuccess(null), 3500);
      void load();
    } catch { setActionError("Error de conexión"); }
    finally { setReenviandoId(null); }
  };

  const exportCSV = () => {
    if (items.length === 0) return;
    setExporting(true);
    try {
      const header = ["ID", "Placa", "Conductor", "Empresa", "Infracción", "Monto S/", "UIT", "Estado", "Fecha"];
      const rows = items.map(s => [
        `S-${(s.id ?? "").slice(-10).toUpperCase()}`,
        s.vehicle?.plate ?? "",
        s.driver?.name ?? "",
        s.company?.razonSocial ?? "",
        s.faultType,
        s.amountSoles.toString(),
        s.amountUIT,
        s.status,
        new Date(s.createdAt).toISOString().slice(0, 10),
      ]);
      const csv = [header, ...rows].map(r =>
        r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanciones_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { setExporting(false); }
  };

  const emitidas = stats.emitida;
  const apeladas = stats.apelada;
  const confirmadas = stats.confirmada;
  const anuladas = stats.anulada;
  const totalMonto = stats.montoConfirmado;

  const columns = useMemo<ColumnDef<Sanction, unknown>[]>(() => [
    {
      id: "sancion",
      header: "Sanción",
      accessorFn: (row) => `S-${(row.id ?? "").slice(-10).toUpperCase()} ${row.vehicle?.plate ?? ""}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>
            S-{(row.original.id ?? "").slice(-10).toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem" }}>
              {row.original.vehicle?.plate ?? "—"}
            </span>
            <span style={{ fontSize: "0.75rem", color: INK5 }}>
              {new Date(row.original.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "infraccion",
      header: "Infracción",
      accessorFn: (row) => `${row.faultType} ${row.company?.razonSocial ?? ""}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.faultType}</div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>{row.original.company?.razonSocial ?? "—"}</div>
        </div>
      ),
    },
    {
      id: "monto",
      header: "Monto",
      accessorFn: (row) => row.amountSoles,
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            S/ {row.original.amountSoles.toLocaleString("es-PE")}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>{row.original.amountUIT}</div>
        </div>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row }) => {
        const s = row.original.status;
        const variantMap: Record<SanctionStatus, React.ComponentProps<typeof Badge>["variant"]> = {
          emitida: "gold",
          notificada: "activo",
          apelada: "pendiente",
          confirmada: "suspendido",
          anulada: "inactivo",
        };
        const labelMap: Record<SanctionStatus, string> = {
          emitida: "EMITIDA",
          notificada: "NOTIFICADA",
          apelada: "APELADA",
          confirmada: "CONFIRMADA",
          anulada: "ANULADA",
        };
        return <Badge variant={variantMap[s]}>{labelMap[s]}</Badge>;
      },
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const isReenviando = reenviandoId === row.original.id;
        const canReenviar = row.original.status !== "anulada";
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
            {canReenviar && (
              <button
                onClick={() => { void handleReenviar(row.original.id); }}
                disabled={isReenviando}
                title="Reenviar notificación"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, borderRadius: 7,
                  border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                  cursor: isReenviando ? "not-allowed" : "pointer",
                  opacity: isReenviando ? 0.5 : 1, fontFamily: "inherit",
                }}
              >
                <Bell size={14} />
              </button>
            )}
            <Link href={`/sanciones/${row.original.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
          </div>
        );
      },
    },
  ], [reenviandoId]);

  if (!user) return null;

  const notifIcon = (ch: string) => ch === "email" ? <Mail size={14} /> : ch === "whatsapp" ? <Phone size={14} /> : <Bell size={14} />;
  const notifLabel = (ch: string) => ch === "email" ? "Correo a empresa" : ch === "whatsapp" ? "WhatsApp al operador" : "Push al conductor";

  // Las sanciones se emiten exclusivamente desde la app móvil del fiscal.
  // En web son read-only para todos los admins; no hay CTA de creación.

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Ciudadanía · RF-13" title="Sanciones"
        action={<div style={{ display: "flex", gap: 8 }}>
          <button style={btnOut} onClick={exportCSV} disabled={items.length === 0 || exporting}>
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>
        </div>} />

      {actionSuccess && (
        <div role="status" style={{
          padding: "8px 14px", borderRadius: 8,
          background: APTOBG, border: `1px solid ${APTOBD}`, color: APTO,
          fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={14} /> {actionSuccess}
        </div>
      )}
      {actionError && (
        <div role="alert" style={{
          padding: "8px 14px", borderRadius: 8,
          background: NOBG, border: `1px solid ${NOBD}`, color: NO,
          fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} /> {actionError}
        </div>
      )}

      <div className="cols-4-responsive">
        {[
          { ico: <AlertTriangle size={18} />, lbl: "Emitidas", val: emitidas, bg: GBG, ic: GD },
          { ico: <FileText size={18} />, lbl: "En apelación", val: apeladas, bg: RIESGOBG, ic: RIESGO },
          { ico: <Check size={18} />, lbl: "Confirmadas", val: confirmadas, bg: NOBG, ic: NO },
          { ico: <X size={18} />, lbl: "Anuladas", val: anuladas, bg: INK1, ic: INK5 },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
            {i === 2 && !loading && totalMonto > 0 && <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>S/ {totalMonto.toLocaleString("es-PE")}</div>}
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div className="cols-2-responsive" style={{ gap: 20 }}>
        <div>
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            onRowClick={(s) => setSel(s)}
            searchPlaceholder="Buscar por placa, infracción…"
            emptyTitle="Sin sanciones registradas"
            emptyDescription="No se encontraron sanciones en este período."
            toolbarEnd={
              <div style={{ display: "flex", gap: 6 }}>
                {[["", "Todas"], ["emitida", "Emitidas"], ["notificada", "Notificadas"], ["apelada", "Apeladas"], ["confirmada", "Confirmadas"], ["anulada", "Anuladas"]].map(([k, l]) => (
                  <button key={k} onClick={() => setStatusFilter(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: statusFilter === k ? INK9 : "#fff", color: statusFilter === k ? "#fff" : INK6, border: statusFilter === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>{l}</button>
                ))}
              </div>
            }
          />
        </div>

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}`, gap: 12 }}>
              <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>S-{sel.id.slice(-10).toUpperCase()}</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{sel.faultType}</div></div>
              <Badge variant={{ emitida: "gold", notificada: "activo", apelada: "pendiente", confirmada: "suspendido", anulada: "inactivo" }[sel.status] as React.ComponentProps<typeof Badge>["variant"]}>
                {sel.status.toUpperCase()}
              </Badge>
            </div>
            <div style={{ padding: 22 }}>
              <StepFlow status={sel.status} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Vehículo</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}><span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 5, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>{sel.vehicle?.plate ?? "—"}</span></div>
                </div>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Conductor</div>
                  <div style={{ fontWeight: 700, marginTop: 2, fontSize: "0.875rem" }}>{sel.driver?.name ?? "—"}</div>
                </div>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Empresa</div>
                  <div style={{ fontWeight: 700, marginTop: 2, fontSize: "0.8125rem" }}>{sel.company?.razonSocial ?? "—"}</div>
                </div>
                <div style={{ padding: 12, background: GBG, borderRadius: 10, border: `1px solid ${GBR}` }}>
                  <div style={{ fontSize: "0.75rem", color: GD }}>Monto sanción</div>
                  <div style={{ fontWeight: 800, marginTop: 2, fontSize: "1.125rem", color: GD, fontVariantNumeric: "tabular-nums" }}>S/ {sel.amountSoles.toLocaleString("es-PE")}</div>
                </div>
              </div>

              {sel.notifications.length > 0 && (
                <>
                  <p className="kicker" style={{ margin: "18px 0 8px" }}>Notificaciones</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sel.notifications.map((n, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: INK1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: INK6 }}>{notifIcon(n.channel)}</div>
                        <div style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600 }}>{notifLabel(n.channel)}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5 }}>{n.status === "pendiente" ? "Pendiente" : n.status === "leido" ? "Leído" : "Entregado"}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {actionError && (
                <div style={{ marginTop: 14, padding: "8px 12px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 8, color: NO, fontSize: "0.8125rem" }}>
                  {actionError}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Seleccione una sanción</div>
        )}
      </div>

    </div>
  );
}
