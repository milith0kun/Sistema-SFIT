"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Check, X, Download, Plus, Mail, Phone, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

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
type VehicleOpt = { id: string; plate: string };
type DriverOpt = { id: string; name: string };
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

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };
const btnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6 };

const inputStyle: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 12px", borderRadius: 8,
  border: `1.5px solid ${INK2}`, fontSize: "0.875rem", outline: "none",
  fontFamily: "inherit", boxSizing: "border-box", color: INK9, background: "#fff",
};
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: INK6, letterSpacing: "0.04em", display: "block", marginBottom: 6 };

const FAULT_TYPES = [
  "Exceso de velocidad",
  "Falta de documentos (SOAT vencido)",
  "Falta de revisión técnica",
  "Vehículo en mal estado",
  "Conductor sin licencia vigente",
  "Incumplimiento de ruta autorizada",
  "Sobrecarga de pasajeros",
  "Conducción bajo influencia de alcohol",
  "Incumplimiento de horario",
  "Infracción al reglamento de tránsito",
  "Otra infracción",
];

const UIT_OPTIONS = [
  "0.1 UIT", "0.25 UIT", "0.5 UIT", "1 UIT", "1.5 UIT", "2 UIT", "3 UIT", "5 UIT",
];

export default function SancionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Sanction[]>([]);
  const [stats, setStats] = useState<Stats>({ emitida: 0, notificada: 0, apelada: 0, confirmada: 0, anulada: 0, montoConfirmado: 0 });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sanction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [form, setForm] = useState({
    vehicleId: "", driverId: "", faultType: "", faultTypeCustom: "",
    amountSoles: "", amountUIT: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const loadModalData = useCallback(async () => {
    const token = localStorage.getItem("sfit_access_token");
    const headers = { Authorization: `Bearer ${token ?? ""}` };
    const [vRes, dRes] = await Promise.all([
      fetch("/api/vehiculos?limit=100", { headers }),
      fetch("/api/conductores?limit=100", { headers }),
    ]);
    const [vData, dData] = await Promise.all([vRes.json(), dRes.json()]);
    if (vData.success) setVehicles((vData.data.items ?? []).map((v: { id: string; plate: string }) => ({ id: v.id, plate: v.plate })));
    if (dData.success) setDrivers((dData.data.items ?? []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
  }, []);

  const openModal = () => {
    setForm({ vehicleId: "", driverId: "", faultType: "", faultTypeCustom: "", amountSoles: "", amountUIT: "" });
    setFormError(null);
    setShowModal(true);
    void loadModalData();
  };

  const handleSubmit = async () => {
    const faultTypeValue = form.faultType === "Otra infracción" ? form.faultTypeCustom.trim() : form.faultType;
    if (!form.vehicleId) { setFormError("Seleccione un vehículo"); return; }
    if (!faultTypeValue) { setFormError("Ingresa el tipo de infracción"); return; }
    const amountSoles = parseFloat(form.amountSoles);
    if (isNaN(amountSoles) || amountSoles < 0) { setFormError("Monto inválido"); return; }
    if (!form.amountUIT) { setFormError("Seleccione el monto en UIT"); return; }

    setSubmitting(true); setFormError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const body: Record<string, unknown> = {
        vehicleId: form.vehicleId,
        faultType: faultTypeValue,
        amountSoles,
        amountUIT: form.amountUIT,
      };
      if (form.driverId) body.driverId = form.driverId;

      const res = await fetch("/api/sanciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setFormError(data.error ?? "Error al crear sanción"); return; }
      setShowModal(false);
      void load();
    } catch { setFormError("Error de conexión"); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (id: string, status: SanctionStatus) => {
    setActionError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setActionError(data.error ?? "No se pudo actualizar la sanción");
        return;
      }
      void load();
    } catch { setActionError("Error de conexión"); }
  };

  const exportCSV = () => {
    if (items.length === 0) return;
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
    URL.revokeObjectURL(url);
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
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Link href={`/sanciones/${row.original.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
        </div>
      ),
    },
  ], []);

  if (!user) return null;

  const notifIcon = (ch: string) => ch === "email" ? <Mail size={14} /> : ch === "whatsapp" ? <Phone size={14} /> : <Bell size={14} />;
  const notifLabel = (ch: string) => ch === "email" ? "Correo a empresa" : ch === "whatsapp" ? "WhatsApp al operador" : "Push al conductor";

  const canCreate = ["admin_municipal", "fiscal", "super_admin"].includes(user.role);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Ciudadanía · RF-13" title="Sanciones"
        action={<div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btnOut, opacity: items.length === 0 ? 0.5 : 1, cursor: items.length === 0 ? "not-allowed" : "pointer" }} onClick={exportCSV} disabled={items.length === 0}><Download size={16} />Exportar CSV</button>
          {canCreate && <button style={btnInk} onClick={openModal}><Plus size={16} />Emitir sanción</button>}
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
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

              {canCreate && sel.status !== "confirmada" && sel.status !== "anulada" && (
                <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  {sel.status === "emitida" && (
                    <button style={{ ...btnSm, flex: 1, minWidth: 130 }} onClick={() => updateStatus(sel.id, "notificada")}><Bell size={14} />Marcar notificada</button>
                  )}
                  {sel.status === "notificada" && (
                    <button style={{ ...btnSm, flex: 1, minWidth: 130 }} onClick={() => updateStatus(sel.id, "apelada")}><FileText size={14} />Registrar apelación</button>
                  )}
                  {sel.status === "apelada" && (
                    <button style={{ ...btnSm, flex: 1, minWidth: 130 }} onClick={() => updateStatus(sel.id, "confirmada")}><Check size={14} />Confirmar</button>
                  )}
                  <button style={{ ...btnInk, flex: 1, minWidth: 130, height: 32, fontSize: "0.8125rem" }} onClick={() => updateStatus(sel.id, "anulada")}><X size={14} />Anular</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Seleccione una sanción</div>
        )}
      </div>

      {/* Modal: Emitir sanción */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(9,9,11,.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !submitting && setShowModal(false)}>
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, width: 540, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${INK2}` }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: INK9 }}>Emitir nueva sanción</div>
                <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Los campos marcados con * son obligatorios</div>
              </div>
              <button onClick={() => !submitting && setShowModal(false)} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${INK2}`, background: "#fff", color: INK6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Vehículo */}
              <div>
                <label style={labelStyle}>VEHÍCULO *</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}
                  style={{ ...inputStyle, appearance: "auto" }}>
                  <option value="">Seleccione un vehículo…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
                {vehicles.length === 0 && <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>Cargando vehículos…</div>}
              </div>

              {/* Conductor */}
              <div>
                <label style={labelStyle}>CONDUCTOR (opcional)</label>
                <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}
                  style={{ ...inputStyle, appearance: "auto" }}>
                  <option value="">Sin conductor asignado</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Tipo de infracción */}
              <div>
                <label style={labelStyle}>TIPO DE INFRACCIÓN *</label>
                <select value={form.faultType} onChange={e => setForm(f => ({ ...f, faultType: e.target.value, faultTypeCustom: "" }))}
                  style={{ ...inputStyle, appearance: "auto" }}>
                  <option value="">Seleccione un tipo…</option>
                  {FAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {form.faultType === "Otra infracción" && (
                  <input
                    value={form.faultTypeCustom}
                    onChange={e => setForm(f => ({ ...f, faultTypeCustom: e.target.value }))}
                    placeholder="Describe la infracción…"
                    style={{ ...inputStyle, marginTop: 8 }}
                  />
                )}
              </div>

              {/* Montos */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>MONTO EN SOLES (S/) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.amountSoles}
                    onChange={e => setForm(f => ({ ...f, amountSoles: e.target.value }))}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>EQUIVALENCIA UIT *</label>
                  <select value={form.amountUIT} onChange={e => setForm(f => ({ ...f, amountUIT: e.target.value }))}
                    style={{ ...inputStyle, appearance: "auto" }}>
                    <option value="">Selecciona…</option>
                    {UIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div style={{ padding: "10px 14px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 8, color: NO, fontSize: "0.875rem", display: "flex", gap: 8, alignItems: "center" }}>
                  <AlertTriangle size={15} />{formError}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button style={{ ...btnOut, flex: 1 }} onClick={() => !submitting && setShowModal(false)} disabled={submitting}>Cancelar</button>
                <button style={{ ...btnInk, flex: 1, opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Emitiendo…" : <><AlertTriangle size={15} />Emitir sanción</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
