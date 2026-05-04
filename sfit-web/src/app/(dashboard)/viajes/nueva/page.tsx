"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Save, Loader2, CheckCircle, Truck, Users, Route as RouteIcon,
  Calendar, Hash,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PassengerTable, type PassengerRow } from "@/components/ui/PassengerTable";
import { useToast } from "@/hooks/useToast";

type VehicleItem = { id: string; plate: string; brand: string; model: string };
type DriverItem  = { id: string; name: string };
type RouteItem   = {
  id: string;
  code: string;
  name: string;
  serviceScope?: string;
};

const ALLOWED_CREATE = ["operador", "admin_municipal", "super_admin"];

/* Modalidades que requieren manifiesto nominal de pasajeros (RNF de Track A). */
const SCOPES_REQUIRING_LIST = new Set([
  "interprovincial_regional",
  "interregional_nacional",
]);

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
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

function NuevoViajeWizard() {
  const router = useRouter();
  const toast = useToast();

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [drivers,  setDrivers]  = useState<DriverItem[]>([]);
  const [routes,   setRoutes]   = useState<RouteItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1
  const [step, setStep] = useState<1 | 2>(1);
  const [vehicleId,  setVehicleId]  = useState("");
  const [driverId,   setDriverId]   = useState("");
  const [routeId,    setRouteId]    = useState("");
  const [routeScope, setRouteScope] = useState<string | null>(null);
  const [resolvingScope, setResolvingScope] = useState(false);
  const [startTime,  setStartTime]  = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now.toISOString().slice(0, 16);
  });
  const [passengersCount, setPassengersCount] = useState("");

  // Step 2 (solo interprov/regional/nacional)
  const [passengers, setPassengers] = useState<PassengerRow[]>([]);

  const requiresPassengerList = !!routeScope && SCOPES_REQUIRING_LIST.has(routeScope);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const h = { Authorization: `Bearer ${token ?? ""}` };
      const [vRes, dRes, rRes] = await Promise.all([
        fetch("/api/vehiculos?limit=100", { headers: h }),
        fetch("/api/conductores?limit=100", { headers: h }),
        fetch("/api/rutas?limit=100", { headers: h }),
      ]);
      if ([vRes, dRes, rRes].some(r => r.status === 401)) { router.replace("/login"); return; }
      const [vData, dData, rData] = await Promise.all([vRes.json(), dRes.json(), rRes.json()]);
      if (vData.success) setVehicles(vData.data.items ?? []);
      if (dData.success) setDrivers(dData.data.items ?? []);
      if (rData.success) setRoutes(rData.data.items ?? []);
    } catch {
      setError("Error al cargar datos de referencia.");
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    try {
      const u = JSON.parse(raw) as { role: string };
      if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/dashboard"); return; }
    } catch { router.replace("/login"); return; }
    void loadAll();
  }, [router, loadAll]);

  // Cuando se elige una ruta, resolvemos su `serviceScope` con un GET a /api/rutas/[id]
  // (el listado /api/rutas no devuelve el campo).
  useEffect(() => {
    if (!routeId) { setRouteScope(null); return; }
    const cached = routes.find(r => r.id === routeId);
    if (cached?.serviceScope) { setRouteScope(cached.serviceScope); return; }
    setResolvingScope(true);
    (async () => {
      try {
        const token = localStorage.getItem("sfit_access_token");
        const r = await fetch(`/api/rutas/${routeId}`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (r.ok) {
          const d = await r.json();
          setRouteScope(d.data?.serviceScope ?? null);
        }
      } catch { /* silent */ }
      finally { setResolvingScope(false); }
    })();
  }, [routeId, routes]);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!vehicleId) errs.vehicleId = "Selecciona un vehículo.";
    if (!driverId)  errs.driverId  = "Selecciona un conductor.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreate() {
    if (!validateStep1()) { setStep(1); return; }
    setCreating(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = { vehicleId, driverId };
      if (routeId)   payload.routeId   = routeId;
      if (startTime) payload.startTime = new Date(startTime).toISOString();

      // En urbano, usamos el contador. En interprov, mandamos passengers.length
      // basados en la lista (el backend valida `passengerListMode`).
      if (requiresPassengerList) {
        payload.passengers = passengers.length;
      } else if (passengersCount) {
        payload.passengers = Number(passengersCount);
      }

      const res = await fetch("/api/viajes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
          setStep(1);
        } else {
          setError(data.error ?? "No se pudo crear el viaje.");
        }
        return;
      }

      const tripId = String(data.data?.id ?? data.data?._id ?? "");

      // Si hay pasajeros, los enviamos al endpoint del manifiesto.
      if (requiresPassengerList && passengers.length > 0 && tripId) {
        try {
          const passengersPayload = passengers.map(p => ({
            fullName: p.fullName,
            documentNumber: p.documentNumber,
            documentType: p.documentType ?? "DNI",
            seatNumber: p.seatNumber || undefined,
            origin: p.origin || undefined,
            destination: p.destination || undefined,
            phone: p.phone || undefined,
          }));
          const pRes = await fetch(`/api/viajes/${tripId}/pasajeros`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
            body: JSON.stringify({ passengers: passengersPayload }),
          });
          const pData = await pRes.json().catch(() => ({}));
          if (pRes.ok && pData.success) {
            const created = pData.data?.totalCreated ?? passengersPayload.length;
            const skipped = pData.data?.totalSkipped ?? 0;
            if (skipped > 0) {
              toast.warn(`Viaje creado · ${created} pasajeros agregados, ${skipped} omitidos por duplicado.`);
            } else {
              toast.success(`Viaje creado con ${created} pasajeros en manifiesto.`);
            }
          } else {
            toast.warn("Viaje creado, pero hubo errores al cargar pasajeros. Edita el viaje para reintentar.");
          }
        } catch {
          toast.warn("Viaje creado, pero falló la carga de pasajeros.");
        }
      } else {
        toast.success("Viaje creado correctamente.");
      }

      router.push(tripId ? `/viajes/${tripId}` : "/viajes");
    } catch {
      setError("Error de conexión.");
    } finally {
      setCreating(false);
    }
  }

  function handleNext() {
    if (!validateStep1()) return;
    if (requiresPassengerList) {
      setStep(2);
    } else {
      void handleCreate();
    }
  }

  if (loadingData) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Operación · RF-10" title="Iniciar viaje" subtitle="Cargando datos de referencia…" />
        {[0, 1].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 180, borderRadius: 12 }} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <PageHeader
        kicker="Operación · RF-10"
        title="Iniciar viaje"
        subtitle={requiresPassengerList
          ? "Asigna recursos y registra el manifiesto de pasajeros."
          : "Asigna vehículo, conductor y ruta."}
      />

      {/* Stepper */}
      <Stepper step={step} totalSteps={requiresPassengerList ? 2 : 1} />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {step === 1 ? (
        <Step1
          vehicles={vehicles}
          drivers={drivers}
          routes={routes}
          vehicleId={vehicleId} setVehicleId={setVehicleId}
          driverId={driverId} setDriverId={setDriverId}
          routeId={routeId} setRouteId={setRouteId}
          startTime={startTime} setStartTime={setStartTime}
          passengersCount={passengersCount} setPassengersCount={setPassengersCount}
          fieldErrors={fieldErrors}
          requiresPassengerList={requiresPassengerList}
          resolvingScope={resolvingScope}
          routeScope={routeScope}
        />
      ) : (
        <Step2 passengers={passengers} setPassengers={setPassengers} />
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/viajes" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 38, padding: "0 14px", borderRadius: 8,
            border: `1px solid ${INK2}`, background: "#fff", color: INK6,
            fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
            fontFamily: "inherit",
          }}>
            <ArrowLeft size={12} />Cancelar
          </Link>
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 38, padding: "0 14px", borderRadius: 8,
              border: `1px solid ${INK2}`, background: "#fff", color: INK6,
              fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit",
            }}>
              <ArrowLeft size={12} />Anterior
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {step === 1 && requiresPassengerList && (
            <button type="button" onClick={handleNext} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 38, padding: "0 16px", borderRadius: 8,
              border: "none", background: INK9, color: "#fff",
              fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit",
            }}>
              Siguiente: pasajeros<ArrowRight size={12} />
            </button>
          )}
          {(step === 2 || (step === 1 && !requiresPassengerList)) && (
            <button type="button" onClick={handleCreate} disabled={creating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 18px", borderRadius: 8,
                border: "none", background: APTO, color: "#fff",
                fontWeight: 700, fontSize: "0.8125rem",
                cursor: creating ? "not-allowed" : "pointer", fontFamily: "inherit",
                opacity: creating ? 0.7 : 1,
              }}>
              {creating ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={12} />}
              {creating ? "Creando…" : "Crear viaje"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Stepper ── */
function Stepper({ step, totalSteps }: { step: 1 | 2; totalSteps: 1 | 2 }) {
  if (totalSteps === 1) return null;
  const steps = [
    { n: 1, label: "Asignación", icon: Truck },
    { n: 2, label: "Pasajeros",  icon: Users },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 16px", background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
    }}>
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: done ? APTO_BG : active ? INK9 : INK1,
              border: `1px solid ${done ? APTO_BD : active ? INK9 : INK2}`,
              color: done ? APTO : active ? "#fff" : INK6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
            }}>
              {done ? <CheckCircle size={14} /> : <s.icon size={13} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: "0.625rem", fontWeight: 700, color: INK5,
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}>
                Paso {s.n} de {totalSteps}
              </div>
              <div style={{
                fontSize: "0.875rem", fontWeight: active || done ? 700 : 500,
                color: active ? INK9 : INK6,
              }}>
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? APTO : INK2, borderRadius: 1, minWidth: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Asignación ── */
function Step1({
  vehicles, drivers, routes,
  vehicleId, setVehicleId, driverId, setDriverId, routeId, setRouteId,
  startTime, setStartTime, passengersCount, setPassengersCount,
  fieldErrors, requiresPassengerList, resolvingScope, routeScope,
}: {
  vehicles: VehicleItem[]; drivers: DriverItem[]; routes: RouteItem[];
  vehicleId: string; setVehicleId: (s: string) => void;
  driverId: string; setDriverId: (s: string) => void;
  routeId: string; setRouteId: (s: string) => void;
  startTime: string; setStartTime: (s: string) => void;
  passengersCount: string; setPassengersCount: (s: string) => void;
  fieldErrors: Record<string, string>;
  requiresPassengerList: boolean;
  resolvingScope: boolean;
  routeScope: string | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="cols-2-responsive">
      <SectionCard
        icon={<Truck size={14} color={INK6} />}
        title="Vehículo y conductor"
        subtitle="Recursos asignados al viaje"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label htmlFor="vehicleId" style={LABEL}>
              Vehículo <span style={{ color: RED, marginLeft: 3 }}>*</span>
            </label>
            <select id="vehicleId" value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              style={{ ...FIELD, borderColor: fieldErrors.vehicleId ? RED : INK2, appearance: "none", paddingRight: 30 }}>
              <option value="">— Seleccionar vehículo —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
            </select>
            {fieldErrors.vehicleId && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.vehicleId}</p>}
          </div>
          <div>
            <label htmlFor="driverId" style={LABEL}>
              Conductor <span style={{ color: RED, marginLeft: 3 }}>*</span>
            </label>
            <select id="driverId" value={driverId} onChange={e => setDriverId(e.target.value)}
              style={{ ...FIELD, borderColor: fieldErrors.driverId ? RED : INK2, appearance: "none", paddingRight: 30 }}>
              <option value="">— Seleccionar conductor —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {fieldErrors.driverId && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.driverId}</p>}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<RouteIcon size={14} color={INK6} />}
        title="Ruta y horario"
        subtitle="Itinerario del viaje"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label htmlFor="routeId" style={LABEL}>
              Ruta <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>(opcional)</span>
            </label>
            <select id="routeId" value={routeId} onChange={e => setRouteId(e.target.value)}
              style={{ ...FIELD, appearance: "none", paddingRight: 30 }}>
              <option value="">— Sin ruta asignada —</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
            {resolvingScope && (
              <p style={{ marginTop: 5, fontSize: "0.75rem", color: INK5 }}>
                <Loader2 size={11} style={{ display: "inline", animation: "spin 0.7s linear infinite", marginRight: 4 }} />
                Detectando modalidad…
              </p>
            )}
            {routeScope && !resolvingScope && (
              <p style={{ marginTop: 5, fontSize: "0.75rem", color: INK5 }}>
                Modalidad: <strong style={{ color: INK9 }}>{routeScope.replace(/_/g, " ")}</strong>
                {requiresPassengerList && (
                  <span style={{ color: APTO, marginLeft: 6, fontWeight: 600 }}>
                    · requiere manifiesto de pasajeros
                  </span>
                )}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="startTime" style={LABEL}>
              <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
              Hora de inicio
            </label>
            <input id="startTime" type="datetime-local" value={startTime}
              onChange={e => setStartTime(e.target.value)} style={FIELD} />
          </div>

          {/* Si NO requiere lista, mostramos el contador simple. */}
          {!requiresPassengerList && (
            <div>
              <label htmlFor="passengers" style={LABEL}>
                <Users size={11} style={{ display: "inline", marginRight: 4 }} />
                Pasajeros (estimado)
              </label>
              <input id="passengers" type="number" min={0} step={1} value={passengersCount}
                onChange={e => setPassengersCount(e.target.value)} placeholder="0"
                style={{ ...FIELD, fontVariantNumeric: "tabular-nums" }} />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 2: Pasajeros ── */
function Step2({
  passengers, setPassengers,
}: {
  passengers: PassengerRow[];
  setPassengers: (p: PassengerRow[] | ((prev: PassengerRow[]) => PassengerRow[])) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "10px 14px", background: APTO_BG, border: `1px solid ${APTO_BD}`,
        borderRadius: 8, color: INK6, fontSize: "0.8125rem",
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <Hash size={14} color={APTO} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: APTO }}>Manifiesto obligatorio.</strong>{" "}
          Esta ruta es interprovincial / regional / nacional, así que la
          ley exige una lista nominal de pasajeros con DNI y asiento. Puedes
          agregarlos manualmente o importar un Excel con la plantilla del MTC.
        </div>
      </div>

      <PassengerTable
        passengers={passengers}
        editable
        onAdd={async (p) => {
          setPassengers(prev => [...prev, p]);
        }}
        onEdit={async (id, partial) => {
          // En el wizard los pasajeros aún no tienen id real (se crean junto
          // al viaje), pero aceptamos edición por índice si guardamos uno temporal.
          setPassengers(prev => prev.map(p => p.id === id ? { ...p, ...partial } : p));
        }}
        onDelete={async (id) => {
          setPassengers(prev => prev.filter(p => p.id !== id));
        }}
      />
    </div>
  );
}

/* ── SectionCard (reutilizado) ── */
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

export default function NuevoViajePage() {
  return (
    <Suspense fallback={<div style={{ color: "#71717a", padding: 40 }}>Cargando…</div>}>
      <NuevoViajeWizard />
    </Suspense>
  );
}
