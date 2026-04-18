"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

type SanctionStatus = "emitida" | "notificada" | "apelada" | "confirmada" | "anulada";
type Notification = { channel: string; target: string; status: string; sentAt?: string };

type Sanction = {
  id: string;
  vehicle: { _id: string; plate: string };
  driver?: { _id: string; name: string };
  company?: { _id: string; razonSocial: string };
  inspectionId?: string;
  reportId?: string;
  faultType: string;
  amountSoles: number;
  amountUIT: string;
  status: SanctionStatus;
  notifications: Notification[];
  appealNotes?: string;
  resolvedAt?: string;
  createdAt: string;
};

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const STATUS_STYLE: Record<SanctionStatus, { bg: string; color: string; border: string; label: string }> = {
  emitida:    { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5", label: "Emitida" },
  notificada: { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D", label: "Notificada" },
  apelada:    { bg: "#EFF6FF", color: "#1d4ed8", border: "#93C5FD", label: "Apelada" },
  confirmada: { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", label: "Confirmada" },
  anulada:    { bg: INK1, color: INK5, border: INK2, label: "Anulada" },
};

const FAULT_LABELS: Record<string, string> = {
  soat_vencido: "SOAT vencido",
  revision_tecnica_vencida: "Revisión técnica vencida",
  exceso_velocidad: "Exceso de velocidad",
  conduccion_temeraria: "Conducción temeraria",
  cobro_excesivo: "Cobro excesivo",
  ruta_no_autorizada: "Ruta no autorizada",
  documentacion_irregular: "Documentación irregular",
  estado_mecanico_deficiente: "Estado mecánico deficiente",
  conduccion_bajo_influencia: "Conducción bajo influencia",
  otro: "Otro",
};

const ALLOWED = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

interface Props { params: Promise<{ id: string }> }

export default function SancionDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<SanctionStatus | "">("");

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUserRole(u.role);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar sanción."); return; }
      setSanction(data.data);
      setNewStatus(data.data.status);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function handleStatusUpdate() {
    if (!newStatus || newStatus === sanction?.status) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      void load();
    } catch { setError("Error de conexión."); }
    finally { setUpdating(false); }
  }

  const canEdit = ["fiscal", "admin_municipal", "super_admin"].includes(userRole);

  if (loading) return <div style={{ color: INK5, padding: 40 }}>Cargando sanción…</div>;
  if (notFound) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: INK5, marginBottom: 16 }}>Sanción no encontrada.</p>
      <Link href="/sanciones"><Button variant="outline">Volver a Sanciones</Button></Link>
    </div>
  );
  if (error && !sanction) return <div style={{ padding: "12px 16px", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, color: "#b91c1c" }}>{error}</div>;
  if (!sanction) return null;

  const st = STATUS_STYLE[sanction.status];

  return (
    <div className="space-y-8 animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/sanciones" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: INK5, textDecoration: "none", fontSize: "0.875rem" }}>
          <ArrowLeft size={16} /> Sanciones
        </Link>
      </div>

      <PageHeader
        kicker={`Sanción · ${sanction.vehicle?.plate ?? "—"}`}
        title={FAULT_LABELS[sanction.faultType] ?? sanction.faultType}
        subtitle={`Emitida el ${new Date(sanction.createdAt).toLocaleDateString("es-PE", { dateStyle: "long" })}`}
      />

      {error && <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: "#b91c1c", fontSize: "0.9375rem", fontWeight: 500 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div className="space-y-6">
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Infractor</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["Vehículo",  sanction.vehicle?.plate ?? "—"],
                ["Conductor", sanction.driver?.name ?? "No especificado"],
                ["Empresa",   sanction.company?.razonSocial ?? "No especificada"],
                ["Tipo de infracción", FAULT_LABELS[sanction.faultType] ?? sanction.faultType],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: 14, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, color: INK9 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Monto de la sanción</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ padding: 20, background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12 }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b91c1c", marginBottom: 6 }}>Monto en soles</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#b91c1c" }}>S/ {sanction.amountSoles.toLocaleString("es-PE")}</div>
              </div>
              <div style={{ padding: 20, background: INK1, borderRadius: 12 }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Equivalente UIT</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: INK9 }}>{sanction.amountUIT}</div>
              </div>
            </div>
          </Card>

          {sanction.appealNotes && (
            <Card>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>Notas de apelación</h3>
              <p style={{ color: INK6, fontSize: "0.875rem", lineHeight: 1.6 }}>{sanction.appealNotes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Estado</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: st.bg, border: `1.5px solid ${st.border}`, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: st.color }}>{st.label}</span>
            </div>

            {canEdit && (
              <>
                <label style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Cambiar estado</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as SanctionStatus)} className="field" style={{ marginBottom: 12 }}>
                  <option value="emitida">Emitida</option>
                  <option value="notificada">Notificada</option>
                  <option value="apelada">Apelada</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="anulada">Anulada</option>
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStatusUpdate}
                  loading={updating}
                  style={{ width: "100%" }}
                >
                  Actualizar estado
                </Button>
              </>
            )}
          </Card>

          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Notificaciones</h3>
            {sanction.notifications.length === 0 ? (
              <p style={{ color: INK5, fontSize: "0.875rem" }}>Sin notificaciones registradas.</p>
            ) : (
              <div className="space-y-3">
                {sanction.notifications.map((n, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: INK1, borderRadius: 8 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", fontWeight: 700, color: INK6, textTransform: "uppercase" }}>{n.channel}</span>
                    <span style={{ flex: 1, fontSize: "0.8125rem", color: INK6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.target}</span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: n.status === "enviado" || n.status === "entregado" ? "#15803d" : INK5 }}>{n.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {sanction.inspectionId && (
            <Link href={`/inspecciones/${sanction.inspectionId}`} style={{ display: "block" }}>
              <Button variant="outline" size="sm" style={{ width: "100%" }}>Ver inspección vinculada</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
