"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, UserCheck, Clock, Users, Calendar, Mail, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PendingUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  requestedRole: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  ciudadano:        "Ciudadano",
  conductor:        "Conductor",
  operador:         "Operador de Empresa",
  fiscal:           "Fiscal / Inspector",
  admin_municipal:  "Admin Municipal",
};

const ROLE_OPTIONS = [
  { value: "ciudadano", label: "Ciudadano" },
  { value: "conductor", label: "Conductor" },
  { value: "operador",  label: "Operador de Empresa" },
  { value: "fiscal",    label: "Fiscal / Inspector" },
];

/** RF-01-04: Admin Municipal aprueba o rechaza solicitudes pendientes */
export default function AdminUsersPage() {
  const [users, setUsers]         = useState<PendingUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [action, setAction]       = useState<"approve" | "reject" | null>(null);
  const [assignedRole, setAssignedRole] = useState("ciudadano");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/users/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al cargar solicitudes");
        return;
      }
      setUsers(data.data.users);
      setError(null);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAction() {
    if (!selected || !action) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/users/${selected}/${action}`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify(
          action === "approve"
            ? { role: assignedRole }
            : { reason: rejectReason },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Error");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== selected));
      setSelected(null);
      setAction(null);
      setRejectReason("");
    } catch {
      alert("Error de conexión");
    } finally {
      setProcessing(false);
    }
  }

  const target = users.find((u) => u.id === selected);

  const rolesCount = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.requestedRole] = (acc[u.requestedRole] ?? 0) + 1;
    return acc;
  }, {});
  const maxRole = Object.entries(rolesCount).sort((a, b) => b[1] - a[1])[0];

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("es-PE", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <DashboardHero
        kicker="Control de Acceso"
        rfCode="RF-01-04"
        title="Aprobaciones de Usuarios"
        pills={[
          { label: "Pendientes", value: users.length, warn: users.length > 0 },
        ]}
      />

      <KPIStrip
        cols={3}
        items={[
          { label: "PENDIENTES", value: users.length, subtitle: "por revisar", accent: "#92400E", icon: Clock },
          { label: "TIPOS DE ROL", value: Object.keys(rolesCount).length, subtitle: "solicitados", accent: "#0A1628", icon: Users },
          { label: "MÁS SOLICITADO", value: maxRole ? (ROLE_LABELS[maxRole[0]] ?? maxRole[0]) : "—", subtitle: maxRole ? `${maxRole[1]} solicitud${maxRole[1] === 1 ? "" : "es"}` : "sin datos", accent: "#0A1628", icon: UserCheck },
        ]}
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3 text-destructive animate-fade-up">
          <ShieldAlert className="size-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
            Lista de Solicitudes
            {users.length > 0 && (
              <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2 py-0.5 rounded-full border border-zinc-200">
                {users.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="size-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={28} strokeWidth={1.5} className="text-muted-foreground/60" />}
            title="Bandeja vacía"
            subtitle="No hay nuevas solicitudes de acceso por el momento."
          />
        ) : (
          <div className="grid gap-3">
            {users.map((u) => (
              <Card
                key={u.id}
                className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar size="lg" className="border border-zinc-200 bg-zinc-100">
                    <AvatarImage src={u.image} />
                    <AvatarFallback className="bg-zinc-100 text-zinc-700 font-semibold">
                      {u.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900 truncate">{u.name}</span>
                      <Badge variant="info">
                        {ROLE_LABELS[u.requestedRole] ?? u.requestedRole}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        <span className="truncate max-w-[220px]">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        <span>{formatDate(u.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(u.id);
                      setAction("reject");
                    }}
                  >
                    <X size={15} className="mr-2" />
                    Rechazar
                  </Button>
                  <Button
                    variant="approve"
                    size="sm"
                    onClick={() => {
                      setSelected(u.id);
                      setAction("approve");
                      setAssignedRole(u.requestedRole);
                    }}
                  >
                    <Check size={15} className="mr-2" />
                    Aprobar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmación mejorado */}
      <Dialog 
        open={!!selected} 
        onOpenChange={(open) => {
          if (!open && !processing) {
            setSelected(null);
            setAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {action === "approve" ? "Aprobar Solicitud" : "Rechazar Solicitud"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve" 
                ? "Confirma el rol asignado para este usuario para que pueda acceder a la plataforma." 
                : "Indica el motivo por el cual se deniega el acceso a este usuario."}
            </DialogDescription>
          </DialogHeader>

          {target && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                <Avatar size="default" className="border border-zinc-200">
                  <AvatarImage src={target.image} />
                  <AvatarFallback className="bg-zinc-100 text-zinc-700 font-semibold">
                    {target.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-zinc-900 truncate">{target.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{target.email}</p>
                </div>
              </div>

              {action === "approve" ? (
                <div className="space-y-2">
                  <Label htmlFor="assignedRole">Asignar Rol Definitivo</Label>
                  <Select value={assignedRole} onValueChange={(v) => { if (v !== null) setAssignedRole(v); }}>
                    <SelectTrigger id="assignedRole" className="w-full">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="rejectReason">Motivo de rechazo</Label>
                  <Textarea
                    id="rejectReason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ej. Datos de empresa no verificados..."
                    className="resize-none"
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => {
                setSelected(null);
                setAction(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant={action === "approve" ? "approve" : "danger"}
              loading={processing}
              onClick={handleAction}
            >
              {action === "approve" ? "Aprobar Usuario" : "Rechazar Solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
