"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

type VehicleItem = { id: string; plate: string; brand: string; model: string };
type DriverItem  = { id: string; name: string };
type RouteItem   = { id: string; code: string; name: string };

const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b";
const ALLOWED_CREATE = ["operador", "admin_municipal", "super_admin"];

function NuevoViajeForm() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [drivers,  setDrivers]  = useState<DriverItem[]>([]);
  const [routes,   setRoutes]   = useState<RouteItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [vehicleId,  setVehicleId]  = useState("");
  const [driverId,   setDriverId]   = useState("");
  const [routeId,    setRouteId]    = useState("");
  const [startTime,  setStartTime]  = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now.toISOString().slice(0, 16);
  });
  const [passengers, setPassengers] = useState("");

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
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadAll();
  }, [router, loadAll]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!vehicleId) errs.vehicleId = "Seleccione un vehículo.";
    if (!driverId)  errs.driverId  = "Seleccione un conductor.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = { vehicleId, driverId };
      if (routeId)    payload.routeId    = routeId;
      if (startTime)  payload.startTime  = new Date(startTime).toISOString();
      if (passengers) payload.passengers = Number(passengers);

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
        } else {
          setError(data.error ?? "No se pudo crear el viaje.");
        }
        return;
      }
      router.push("/viajes");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) return <div style={{ color: INK5, padding: 40 }}>Cargando datos…</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Operación · RF-10"
        title="Iniciar viaje"
        subtitle="Registra un nuevo viaje asignando vehículo, conductor y ruta."
      />

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: "#DC2626", fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Vehículo y conductor
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="vehicleId" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                Vehículo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                id="vehicleId"
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className={`field${fieldErrors.vehicleId ? " field-error" : ""}`}
              >
                <option value="">— Seleccionar vehículo —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>
                ))}
              </select>
              {fieldErrors.vehicleId && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.vehicleId}</p>
              )}
            </div>

            <div>
              <label htmlFor="driverId" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                Conductor <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                id="driverId"
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                className={`field${fieldErrors.driverId ? " field-error" : ""}`}
              >
                <option value="">— Seleccionar conductor —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {fieldErrors.driverId && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.driverId}</p>
              )}
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="routeId" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                Ruta <span style={{ color: INK5, fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <select
                id="routeId"
                value={routeId}
                onChange={e => setRouteId(e.target.value)}
                className="field"
              >
                <option value="">— Sin ruta asignada —</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Datos del viaje
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="startTime" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                Hora de inicio
              </label>
              <input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="passengers" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                Pasajeros <span style={{ color: INK5, fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                id="passengers"
                type="number"
                min="0"
                step="1"
                value={passengers}
                onChange={e => setPassengers(e.target.value)}
                className="field"
                placeholder="0"
              />
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Iniciar viaje
          </Button>
          <Link href="/viajes">
            <Button type="button" variant="outline" size="lg">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NuevoViajePage() {
  return (
    <Suspense fallback={<div style={{ color: "#71717a", padding: 40 }}>Cargando…</div>}>
      <NuevoViajeForm />
    </Suspense>
  );
}
