"use client";

import { useEffect, useState, useCallback, use as usePromise } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

type VehicleItem = { id: string; plate: string; brand: string; model: string; companyId?: string; companyName?: string };
type DriverItem  = { id: string; name: string; licenseNumber: string };
type CompanyItem = { id: string; razonSocial: string };

const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const ALLOWED = ["fiscal", "admin_municipal", "super_admin"];

function NuevaSancionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preVehicleId   = searchParams.get("vehicleId") ?? "";
  const preInspectionId = searchParams.get("inspectionId") ?? "";

  const [vehicles,  setVehicles]  = useState<VehicleItem[]>([]);
  const [drivers,   setDrivers]   = useState<DriverItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [vehicleId,   setVehicleId]   = useState(preVehicleId);
  const [driverId,    setDriverId]    = useState("");
  const [companyId,   setCompanyId]   = useState("");
  const [faultType,   setFaultType]   = useState("");
  const [amountSoles, setAmountSoles] = useState("");
  const [amountUIT,   setAmountUIT]   = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (vehicleId) {
      const veh = vehicles.find(v => v.id === vehicleId);
      if (veh?.companyId) setCompanyId(veh.companyId);
    }
  }, [vehicleId, vehicles]);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const [vRes, dRes, cRes] = await Promise.all([
        fetch("/api/vehiculos?limit=200", { headers }),
        fetch("/api/conductores?limit=200", { headers }),
        fetch("/api/empresas?limit=100", { headers }),
      ]);
      if (vRes.status === 401 || dRes.status === 401 || cRes.status === 401) {
        router.replace("/login"); return;
      }
      const [vData, dData, cData] = await Promise.all([vRes.json(), dRes.json(), cRes.json()]);
      if (vData.success) setVehicles(vData.data.items ?? []);
      if (dData.success) setDrivers(dData.data.items ?? []);
      if (cData.success) setCompanies(cData.data.items ?? []);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  function uitFromSoles(soles: string) {
    const n = parseFloat(soles);
    if (!soles || isNaN(n)) return "";
    const uit = 5150;
    return `${(n / uit).toFixed(4)} UIT`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!vehicleId) errs.vehicleId = "Selecciona un vehículo.";
    if (!faultType.trim()) errs.faultType = "El tipo de infracción es obligatorio.";
    const amtNum = parseFloat(amountSoles);
    if (!amountSoles || isNaN(amtNum) || amtNum < 0) errs.amountSoles = "Ingresa un monto válido.";
    if (!amountUIT.trim()) errs.amountUIT = "El monto en UIT es obligatorio.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = {
        vehicleId,
        faultType: faultType.trim(),
        amountSoles: amtNum,
        amountUIT: amountUIT.trim(),
      };
      if (driverId)   payload.driverId   = driverId;
      if (companyId)  payload.companyId  = companyId;
      if (preInspectionId) payload.inspectionId = preInspectionId;

      const res = await fetch("/api/sanciones", {
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
          setError(data.error ?? "No se pudo crear la sanción.");
        }
        return;
      }
      router.push("/sanciones");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  const faultTypes = [
    "soat_vencido",
    "revision_tecnica_vencida",
    "exceso_velocidad",
    "conduccion_temeraria",
    "cobro_excesivo",
    "ruta_no_autorizada",
    "documentacion_irregular",
    "estado_mecanico_deficiente",
    "conduccion_bajo_influencia",
    "otro",
  ];

  const faultLabels: Record<string, string> = {
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

  if (loadingData) return <div style={{ color: INK5, padding: 40 }}>Cargando datos…</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Sanciones"
        title="Nueva sanción"
        subtitle="Emite una sanción formal a un vehículo infractor."
      />

      {preInspectionId && (
        <div style={{ padding: "12px 16px", background: "#FDF8EC", border: "1.5px solid #E8D090", borderRadius: 12, fontSize: "0.875rem", color: "#926A09", fontWeight: 500 }}>
          Sanción vinculada a inspección ID: {preInspectionId}
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: "#b91c1c", fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Vehículo e infractor
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="vehicleId" style={{ display: "block", marginBottom: 8 }}>Vehículo</label>
              <select
                id="vehicleId"
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className={`field${fieldErrors.vehicleId ? " field-error" : ""}`}
              >
                <option value="">— Seleccionar vehículo —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model} {v.companyName ? `(${v.companyName})` : ""}</option>
                ))}
              </select>
              {fieldErrors.vehicleId && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.vehicleId}</p>}
            </div>

            <div>
              <label htmlFor="driverId" style={{ display: "block", marginBottom: 8 }}>Conductor (opcional)</label>
              <select id="driverId" value={driverId} onChange={e => setDriverId(e.target.value)} className="field">
                <option value="">— Sin conductor —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} · Lic. {d.licenseNumber}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="companyId" style={{ display: "block", marginBottom: 8 }}>Empresa (opcional)</label>
              <select id="companyId" value={companyId} onChange={e => setCompanyId(e.target.value)} className="field">
                <option value="">— Sin empresa —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.razonSocial}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Infracción y monto
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="faultType" style={{ display: "block", marginBottom: 8 }}>Tipo de infracción</label>
              <select
                id="faultType"
                value={faultType}
                onChange={e => setFaultType(e.target.value)}
                className={`field${fieldErrors.faultType ? " field-error" : ""}`}
              >
                <option value="">— Seleccionar tipo —</option>
                {faultTypes.map(ft => (
                  <option key={ft} value={ft}>{faultLabels[ft]}</option>
                ))}
              </select>
              {fieldErrors.faultType && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.faultType}</p>}
            </div>

            <div>
              <label htmlFor="amountSoles" style={{ display: "block", marginBottom: 8 }}>Monto (S/)</label>
              <input
                id="amountSoles"
                type="number"
                min="0"
                step="0.01"
                value={amountSoles}
                onChange={e => {
                  setAmountSoles(e.target.value);
                  setAmountUIT(uitFromSoles(e.target.value));
                }}
                className={`field${fieldErrors.amountSoles ? " field-error" : ""}`}
                placeholder="500.00"
              />
              {fieldErrors.amountSoles && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.amountSoles}</p>}
            </div>

            <div>
              <label htmlFor="amountUIT" style={{ display: "block", marginBottom: 8 }}>Monto (UIT)</label>
              <input
                id="amountUIT"
                value={amountUIT}
                onChange={e => setAmountUIT(e.target.value)}
                className={`field${fieldErrors.amountUIT ? " field-error" : ""}`}
                placeholder="0.2 UIT"
              />
              {fieldErrors.amountUIT && <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.amountUIT}</p>}
              {amountSoles && !isNaN(parseFloat(amountSoles)) && (
                <p style={{ marginTop: 4, fontSize: "0.75rem", color: INK5 }}>
                  Calculado automáticamente: UIT = S/ 5,150
                </p>
              )}
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Emitir sanción
          </Button>
          <Link href="/sanciones">
            <Button type="button" variant="outline" size="lg">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NuevaSancionPage() {
  return (
    <Suspense fallback={<div style={{ color: "#71717a", padding: 40 }}>Cargando…</div>}>
      <NuevaSancionForm />
    </Suspense>
  );
}
