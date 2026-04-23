"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

const ALLOWED_CREATE = ["admin_municipal", "super_admin"];
const NO = "#b91c1c"; const INK5 = "#71717a";

export default function NuevaRutaPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setVehicleTypes((data.data.items ?? []).filter((t: VehicleType) => t.active));
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null); setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const code = (form.get("code") as string)?.trim();
    const name = (form.get("name") as string)?.trim();
    const type = (form.get("type") as string) || "ruta";
    const companyId = (form.get("companyId") as string)?.trim() || undefined;
    const vehicleTypeKey = (form.get("vehicleTypeKey") as string)?.trim() || undefined;
    const stopsRaw = (form.get("stops") as string)?.trim();
    const stops = stopsRaw ? Number(stopsRaw) : undefined;
    const length = (form.get("length") as string)?.trim() || undefined;
    const status = (form.get("status") as string) || "activa";
    const frequenciesRaw = (form.get("frequencies") as string)?.trim();
    const frequencies = frequenciesRaw ? frequenciesRaw.split(",").map(f => f.trim()).filter(Boolean) : undefined;

    const localErrors: Record<string, string> = {};
    if (!code) localErrors.code = "El código es obligatorio.";
    if (!name) localErrors.name = "El nombre es obligatorio.";
    if (Object.keys(localErrors).length > 0) { setFieldErrors(localErrors); setLoading(false); return; }

    const payload: Record<string, unknown> = { code, name, type, status };
    if (companyId) payload.companyId = companyId;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;
    if (stops != null && !isNaN(stops)) payload.stops = stops;
    if (length) payload.length = length;
    if (frequencies && frequencies.length > 0) payload.frequencies = frequencies;
    payload.waypoints = waypoints;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/rutas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear la ruta.");
        }
        return;
      }
      router.push("/rutas");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        kicker="Rutas · RF-09"
        title="Nueva ruta"
        subtitle="Registra una ruta fija o zona de operación para transporte público."
      />

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: NO, fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Identificación</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="code" style={{ display: "block", marginBottom: 8 }}>Código de ruta</label>
              <input id="code" name="code" className={`field${fieldErrors.code ? " field-error" : ""}`} placeholder="R001" />
              {fieldErrors.code && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>{fieldErrors.code}</p>}
            </div>
            <div>
              <label htmlFor="type" style={{ display: "block", marginBottom: 8 }}>Tipo</label>
              <select id="type" name="type" className="field" defaultValue="ruta">
                <option value="ruta">Ruta</option>
                <option value="zona">Zona</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name" style={{ display: "block", marginBottom: 8 }}>Nombre de la ruta</label>
              <input id="name" name="name" className={`field${fieldErrors.name ? " field-error" : ""}`} placeholder="Terminal Terrestre – Plaza de Armas" />
              {fieldErrors.name && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>{fieldErrors.name}</p>}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Operación</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="companyId" style={{ display: "block", marginBottom: 8 }}>Empresa (opcional)</label>
              <select id="companyId" name="companyId" className="field" defaultValue="">
                <option value="">— Sin empresa —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="vehicleTypeKey" style={{ display: "block", marginBottom: 8 }}>Tipo de vehículo (opcional)</label>
              <select id="vehicleTypeKey" name="vehicleTypeKey" className="field" defaultValue="">
                <option value="">— Sin tipo —</option>
                {vehicleTypes.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="stops" style={{ display: "block", marginBottom: 8 }}>Paradas (opcional)</label>
              <input id="stops" name="stops" type="number" min={0} className="field" placeholder={waypoints.length > 0 ? String(waypoints.length) : "12"} />
              {waypoints.length > 0 && <p style={{ marginTop: 4, fontSize: "0.75rem", color: INK5 }}>El mapa tiene {waypoints.length} punto{waypoints.length !== 1 ? "s" : ""}</p>}
            </div>
            <div>
              <label htmlFor="length" style={{ display: "block", marginBottom: 8 }}>Longitud (opcional)</label>
              <input id="length" name="length" className="field" placeholder="8.5 km" />
            </div>
            <div>
              <label htmlFor="status" style={{ display: "block", marginBottom: 8 }}>Estado</label>
              <select id="status" name="status" className="field" defaultValue="activa">
                <option value="activa">Activa</option>
                <option value="suspendida">Suspendida</option>
              </select>
            </div>
            <div>
              <label htmlFor="frequencies" style={{ display: "block", marginBottom: 8 }}>Frecuencias (opcional)</label>
              <input id="frequencies" name="frequencies" className="field" placeholder="10 min, 15 min" />
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: INK5 }}>Separadas por coma</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>Trazado en mapa</h3>
          <p style={{ fontSize: "0.8125rem", color: INK5, marginBottom: 14 }}>
            Haz clic sobre el mapa para marcar las paradas en orden. El primer punto será el <strong>origen</strong> (verde) y el último el <strong>destino</strong> (rojo).
          </p>
          <WaypointsEditor waypoints={waypoints} onChange={setWaypoints} height={360} />
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>Crear ruta</Button>
          <Link href="/rutas"><Button type="button" variant="outline" size="lg">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  );
}
