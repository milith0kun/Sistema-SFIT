"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

type RucLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; source: "MTC" | "SUNAT"; razonSocial: string; estado?: string; vehicleCount?: number; tiposServicio?: string[] }
  | { state: "not_found" }
  | { state: "error"; message: string };

type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

export default function NuevaEmpresaPage() {
  const router = useRouter();
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Estados controlados para los campos con autocompletado
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [repName, setRepName] = useState("");
  const [repDni, setRepDni] = useState("");
  const [rucLookup, setRucLookup] = useState<RucLookup>({ state: "idle" });
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const rucTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dniTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "admin_municipal") {
      router.replace("/dashboard");
      return;
    }
    void loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Lookup del RUC: catálogo MTC primero (gratis + datos de servicio),
  // SUNAT después como fallback (apiperu.dev).
  useEffect(() => {
    if (rucTimer.current) clearTimeout(rucTimer.current);
    if (!/^\d{11}$/.test(ruc)) {
      if (rucLookup.state !== "idle") setRucLookup({ state: "idle" });
      return;
    }
    setRucLookup({ state: "loading" });
    rucTimer.current = setTimeout(async () => {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      const headers = { Authorization: `Bearer ${token}` };
      // 1) Catálogo MTC
      try {
        const r = await fetch(`/api/catalogo/empresa-mtc?ruc=${ruc}`, { headers });
        if (r.ok) {
          const j = await r.json();
          if (j?.success && j?.data) {
            const d = j.data;
            if (!razonSocial.trim()) setRazonSocial(d.razonSocial);
            setRucLookup({
              state: "ok", source: "MTC",
              razonSocial: d.razonSocial,
              vehicleCount: d.vehicleCount,
              tiposServicio: d.tiposServicio,
            });
            return;
          }
        }
      } catch { /* sigue al fallback */ }
      // 2) SUNAT vía apiperu.dev
      try {
        const r2 = await fetch(`/api/validar/ruc`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ruc }),
        });
        const j = await r2.json();
        if (!r2.ok || !j?.success || !j?.data) {
          setRucLookup({ state: r2.status === 404 ? "not_found" : "error", message: j?.error ?? "No se encontró" } as RucLookup);
          return;
        }
        const d = j.data;
        if (!razonSocial.trim()) setRazonSocial(d.razon_social ?? "");
        setRucLookup({
          state: "ok", source: "SUNAT",
          razonSocial: d.razon_social ?? "",
          estado: d.estado,
        });
      } catch {
        setRucLookup({ state: "error", message: "No se pudo verificar el RUC" });
      }
    }, 350);
    return () => { if (rucTimer.current) clearTimeout(rucTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruc]);

  // Lookup del DNI del representante legal (RENIEC vía apiperu.dev).
  useEffect(() => {
    if (dniTimer.current) clearTimeout(dniTimer.current);
    if (!/^\d{8}$/.test(repDni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    dniTimer.current = setTimeout(async () => {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      try {
        const res = await fetch("/api/validar/dni", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dni: repDni }),
        });
        const j = await res.json();
        if (!res.ok || !j?.success || !j?.data) {
          setDniLookup({ state: res.status === 404 ? "not_found" : "error", message: j?.error ?? "No se encontró" } as DniLookup);
          return;
        }
        const nc = (j.data.nombre_completo ?? "").trim();
        if (nc && !repName.trim()) setRepName(nc);
        setDniLookup({ state: "ok", nombreCompleto: nc });
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI" });
      }
    }, 350);
    return () => { if (dniTimer.current) clearTimeout(dniTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repDni]);

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setTypes((data.data.items ?? []).filter((t: VehicleType) => t.active));
    } catch {
      // silent
    }
  }

  function toggleKey(k: string) {
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formEl = new FormData(e.currentTarget);
    const payload = {
      razonSocial: razonSocial.trim(),
      ruc: ruc.trim(),
      representanteLegal: {
        name: repName.trim(),
        dni: repDni.trim(),
        phone: ((formEl.get("repPhone") as string) || "").trim() || undefined,
      },
      vehicleTypeKeys: selectedKeys,
    };

    const localErrors: Record<string, string> = {};
    if (!payload.razonSocial) localErrors.razonSocial = "La razón social es obligatoria.";
    if (!payload.ruc) localErrors.ruc = "El RUC es obligatorio.";
    else if (!/^\d{11}$/.test(payload.ruc)) localErrors.ruc = "El RUC debe tener 11 dígitos.";
    if (!payload.representanteLegal.name) localErrors.repName = "El nombre del representante es obligatorio.";
    if (!payload.representanteLegal.dni) localErrors.repDni = "El DNI es obligatorio.";
    else if (!/^\d{8}$/.test(payload.representanteLegal.dni)) localErrors.repDni = "El DNI debe tener 8 dígitos.";
    if (selectedKeys.length === 0) localErrors.vehicleTypeKeys = "Selecciona al menos un tipo de flota.";

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
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
          setError(data.error ?? "No se pudo crear la empresa.");
        }
        return;
      }
      router.push("/empresas");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Empresas"
        title="Nueva empresa"
        subtitle="Registra una empresa de transporte o flota municipal."
      />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#b91c1c",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Datos de la empresa
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="ruc" style={{ display: "block", marginBottom: 8 }}>
                RUC <span style={{ color: "#71717a", fontWeight: 400, fontSize: "0.75rem" }}>· verificación MTC/SUNAT</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="ruc"
                  name="ruc"
                  className={`field${fieldErrors.ruc ? " field-error" : ""}`}
                  placeholder="20123456789"
                  maxLength={11}
                  inputMode="numeric"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  style={{ fontFamily: "ui-monospace,monospace", paddingRight: 40 }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  {rucLookup.state === "loading" && <Loader2 size={16} color="#71717a" style={{ animation: "spin 0.7s linear infinite" }} />}
                  {rucLookup.state === "ok" && <CheckCircle size={16} color="#15803d" />}
                  {rucLookup.state === "not_found" && <Search size={16} color="#71717a" />}
                  {rucLookup.state === "error" && <AlertTriangle size={16} color="#b91c1c" />}
                </div>
              </div>
              {fieldErrors.ruc && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.ruc}</p>
              )}
              {rucLookup.state === "ok" && (
                <div style={{
                  marginTop: 8, padding: "8px 12px",
                  background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 9,
                  fontSize: "0.75rem", color: "#15803d",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Verificado en {rucLookup.source}
                  </div>
                  <div style={{ color: "#18181b", fontWeight: 600, marginTop: 2 }}>{rucLookup.razonSocial}</div>
                  {rucLookup.source === "MTC" && rucLookup.vehicleCount !== undefined && (
                    <div style={{ color: "#52525b", marginTop: 2 }}>
                      Habilitada con {rucLookup.vehicleCount} vehículos · {rucLookup.tiposServicio?.join(", ")}
                    </div>
                  )}
                  {rucLookup.source === "SUNAT" && rucLookup.estado && (
                    <div style={{ color: "#52525b", marginTop: 2 }}>{rucLookup.estado}</div>
                  )}
                </div>
              )}
              {rucLookup.state === "not_found" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#92400E" }}>
                  RUC no encontrado en MTC ni SUNAT. Verifica que esté correcto.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="razonSocial" style={{ display: "block", marginBottom: 8 }}>
                Razón social
              </label>
              <input
                id="razonSocial"
                name="razonSocial"
                className={`field${fieldErrors.razonSocial ? " field-error" : ""}`}
                placeholder="Se completa al verificar el RUC"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
              />
              {fieldErrors.razonSocial && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.razonSocial}</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Representante legal
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="repDni" style={{ display: "block", marginBottom: 8 }}>
                DNI <span style={{ color: "#71717a", fontWeight: 400, fontSize: "0.75rem" }}>· RENIEC</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="repDni"
                  name="repDni"
                  className={`field${fieldErrors.repDni ? " field-error" : ""}`}
                  placeholder="12345678"
                  maxLength={8}
                  inputMode="numeric"
                  value={repDni}
                  onChange={(e) => setRepDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  style={{ fontFamily: "ui-monospace,monospace", paddingRight: 40 }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  {dniLookup.state === "loading" && <Loader2 size={16} color="#71717a" style={{ animation: "spin 0.7s linear infinite" }} />}
                  {dniLookup.state === "ok" && <CheckCircle size={16} color="#15803d" />}
                  {dniLookup.state === "not_found" && <Search size={16} color="#71717a" />}
                  {dniLookup.state === "error" && <AlertTriangle size={16} color="#b91c1c" />}
                </div>
              </div>
              {fieldErrors.repDni && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.repDni}</p>
              )}
              {dniLookup.state === "ok" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>
                  ✓ {dniLookup.nombreCompleto}
                </p>
              )}
              {dniLookup.state === "not_found" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#92400E" }}>
                  DNI no encontrado en RENIEC.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="repName" style={{ display: "block", marginBottom: 8 }}>
                Nombre completo
              </label>
              <input
                id="repName"
                name="repName"
                className={`field${fieldErrors.repName ? " field-error" : ""}`}
                placeholder="Se completa al verificar el DNI"
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
              />
              {fieldErrors.repName && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.repName}</p>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="repPhone" style={{ display: "block", marginBottom: 8 }}>
                Teléfono (opcional)
              </label>
              <input
                id="repPhone"
                name="repPhone"
                className="field"
                placeholder="+51 984 000 000"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
            Tipos de flota
          </h3>
          <p style={{ color: "#52525b", fontSize: "0.875rem", marginBottom: 16 }}>
            Selecciona los tipos de vehículo que la empresa operará.
          </p>
          {types.length === 0 ? (
            <p style={{ color: "#a1a1aa" }}>
              No hay tipos de vehículo activos. Actívalos primero en{" "}
              <Link href="/tipos-vehiculo" style={{ color: "#B8860B", fontWeight: 600 }}>
                Tipos de vehículo
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {types.map((t) => {
                const checked = selectedKeys.includes(t.key);
                return (
                  <label
                    key={t.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: checked ? "1.5px solid #E8D090" : "1.5px solid #e4e4e7",
                      background: checked ? "#FDF8EC" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleKey(t.key)} />
                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          {fieldErrors.vehicleTypeKeys && (
            <p style={{ marginTop: 12, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>
              {fieldErrors.vehicleTypeKeys}
            </p>
          )}
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Crear empresa
          </Button>
          <Link href="/empresas">
            <Button type="button" variant="outline" size="lg">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
