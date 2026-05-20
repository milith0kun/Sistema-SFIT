"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Eye, EyeOff, RefreshCw, Loader2, CheckCircle, AlertTriangle, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LocationPicker } from "@/components/location-picker";
import { INK1, INK2, INK5, INK6, INK9, RED, REDBG, REDBD, GRN, GRNBG, GRNBD, GOLD_RED, GOLD_RED_BG, GOLD_RED_BD, AMBER_BG, AMBER_BD } from "@/lib/design-tokens";
import { FIELD } from "@/lib/form-styles";

const RED_BG = REDBG;
const RED_BD = REDBD;
const GRN_BG = GRNBG;
const GRN_BD = GRNBD;
const GOLD_BG = GOLD_RED_BG;
const GOLD_BD = GOLD_RED_BD;
const GOLD_C = GOLD_RED;

type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; nombreCompleto: string; source: "reniec" | "mock" }
  | { state: "not_found" }
  | { state: "error"; message: string };

type StoredUser = { role: string };

const ROLES_REQUIRE_IDENTITY = new Set([
  "super_admin",
  "admin_municipal",
  "conductor",
  "operador",
  "fiscal",
]);

/* ── Tokens locales (variaciones de height/border vs form-styles) ── */
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px",
  border: `1.5px solid ${INK2}`, borderRadius: 10,
  fontSize: "0.9375rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  height: 42, padding: "0 22px", borderRadius: 10,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.875rem", fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};

// El sistema opera sobre una única municipalidad (Tambobamba — sede provincial
// de Cotabambas). Ya no hay que elegir muni al crear: el backend la inyecta.
// `showLocation` controla si renderizamos el banner informativo de ámbito
// para roles operativos.
const ROLE_META: Record<string, {
  label: string; desc: string;
  showLocation: boolean;
}> = {
  super_admin:      { label: "Super Administrador",      desc: "Acceso total al sistema — puede crear y gestionar todo", showLocation: false },
  admin_municipal:  { label: "Administrador Municipal",  desc: "Administra la municipalidad institucional",              showLocation: true  },
  fiscal:           { label: "Fiscal / Inspector",       desc: "Realiza inspecciones en campo",                          showLocation: true  },
  operador:         { label: "Operador",                 desc: "Administra la flota de una empresa de transporte",       showLocation: true  },
  conductor:        { label: "Conductor",                desc: "Conductor registrado en una empresa",                    showLocation: true  },
  ciudadano:        { label: "Ciudadano",                desc: "Ciudadano reportador — acceso global",                   showLocation: false },
};

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$";
  const all = upper + lower + digits + special;
  let pwd = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
    + special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 6; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

function getToken() {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

export default function NuevoUsuarioPage() {
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPass, setShowPass] = useState(false);
  const [selRole,  setSelRole]  = useState<string>("conductor");
  const [selStatus, setSelStatus] = useState<"activo" | "pendiente">("activo");
  // Asignación de empresa — sólo visible cuando role === "operador"
  const [companyId, setCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<{ id: string; razonSocial: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  // Flujo híbrido: por default el super_admin solo carga lo institucional;
  // el usuario completa DNI/teléfono y cambia password al primer login.
  // Si el admin ya tiene los datos a mano, puede marcar "Completar perfil ahora".
  const [completeNow, setCompleteNow] = useState(false);
  const [dni,   setDni]   = useState("");
  const [phone, setPhone] = useState("");
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") { router.replace("/usuarios"); return; }
    setUser(u);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-lookup RENIEC al tipear los 8 dígitos del DNI (solo si "completar ahora" está activo)
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!completeNow || !/^\d{8}$/.test(dni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/validar/dni", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ dni }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setDniLookup({ state: "not_found" });
          return;
        }
        const source: "reniec" | "mock" = data.data?.source === "mock" ? "mock" : "reniec";
        setDniLookup({ state: "ok", nombreCompleto: data.data.nombre_completo, source });
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
      }
    }, 350);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni, completeNow]);

  const meta = ROLE_META[selRole] ?? ROLE_META.admin_municipal;
  const identityRequiredByRole = ROLES_REQUIRE_IDENTITY.has(selRole);
  const shouldCompleteNow = completeNow || identityRequiredByRole;

  // Carga las empresas activas cuando se está creando un operador. Todas
  // las empresas pertenecen a la municipalidad institucional única, así que
  // no se filtra por muni desde el cliente — el backend valida al crear.
  useEffect(() => {
    if (selRole !== "operador") {
      setCompanies([]);
      setCompanyId("");
      return;
    }
    setLoadingCompanies(true);
    fetch(`/api/empresas?limit=100`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const items: { id: string; razonSocial: string }[] = body?.data?.items ?? [];
        setCompanies(items);
        if (companyId && !items.some((c) => c.id === companyId)) setCompanyId("");
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRole]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!name.trim())    errs.name     = "El nombre es requerido";
    if (!email.trim())   errs.email    = "El correo es requerido";
    if (password.length < 8) errs.password = "Mínimo 8 caracteres";
    if (selRole === "operador" && !companyId) errs.companyId = "Selecciona la empresa";
    if (shouldCompleteNow) {
      if (!/^\d{6,12}$/.test(dni.trim()))   errs.dni   = "DNI debe tener entre 6 y 12 dígitos";
      if (phone.trim().length < 7)          errs.phone = "Teléfono requerido";
    }

    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name:           name.trim(),
          email:          email.trim().toLowerCase(),
          password,
          role:           selRole,
          status:         selStatus,
          // companyId solo se envía si el rol es operador y se eligió una empresa.
          ...(selRole === "operador" && companyId ? { companyId } : {}),
          // Flujo híbrido: password siempre temporal (el usuario la cambia al primer login).
          passwordIsTemporary: true,
          completeProfileNow:  shouldCompleteNow,
          ...(shouldCompleteNow ? { dni: dni.trim(), phone: phone.trim() } : {}),
        }),
      });
      const data = await res.json() as {
        success: boolean;
        data?: { id: string; email: string };
        errors?: Record<string, string[]>;
        error?: string;
      };

      if (!res.ok || !data.success) {
        if (data.errors) {
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) fe[k] = v[0] ?? "";
          setFieldErrors(fe);
        } else {
          setError(data.error ?? "Error al crear el usuario");
        }
        return;
      }

      setSuccess(`Usuario creado: ${data.data?.email ?? email}`);
      setTimeout(() => router.push("/usuarios"), 1800);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const backBtn = (
    <Link href="/usuarios">
      <button style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Volver
      </button>
    </Link>
  );

  function FieldErr({ k }: { k: string }) {
    const msg = fieldErrors[k];
    if (!msg) return null;
    return <p style={{ fontSize: "0.75rem", color: RED, marginTop: 5 }}>{msg}</p>;
  }

  const card: React.CSSProperties = {
    background: "#fff", border: `1.5px solid ${INK2}`,
    borderRadius: 14, overflow: "hidden",
  };
  const cardHead: React.CSSProperties = {
    padding: "16px 24px", borderBottom: `1px solid ${INK1}`,
    fontWeight: 700, fontSize: "0.9375rem", color: INK9,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };
  const cardBody: React.CSSProperties = { padding: "22px 24px" };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Usuarios · Super Admin"
        title="Nuevo usuario"
        subtitle="Crea cuentas de administradores, fiscales, operadores y conductores"
        action={backBtn}
      />

      {error && (
        <div style={{ padding: "11px 16px", background: RED_BG, border: `1.5px solid ${RED_BD}`, borderRadius: 10, color: RED, fontSize: "0.875rem" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "11px 16px", background: GRN_BG, border: `1.5px solid ${GRN_BD}`, borderRadius: 10, color: GRN, fontSize: "0.875rem", fontWeight: 600 }}>
          ✓ {success}
        </div>
      )}

      <form onSubmit={(e) => { void submit(e); }}>
        <div className="sfit-aside-layout sfit-aside-layout--wide">

          {/* ── Columna principal ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 1 · Rol */}
            <div style={card}>
              <div style={cardHead}><span>1 · Rol del usuario</span></div>
              <div style={cardBody}>
                <div className="cols-2-responsive" style={{ gap: 10 }}>
                  {Object.entries(ROLE_META).map(([role, m]) => {
                    const selected = selRole === role;
                    return (
                      <button key={role} type="button"
                        onClick={() => { setSelRole(role); }}
                        style={{
                          padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                          textAlign: "left", fontFamily: "inherit",
                          border: selected ? `2px solid ${INK9}` : `1.5px solid ${INK2}`,
                          background: selected ? INK1 : "#fff",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.4 }}>{m.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2 · Ámbito institucional — banner informativo para roles ligados a la muni */}
            {meta.showLocation && (
              <div style={card}>
                <div style={cardHead}>
                  <span>2 · Ámbito institucional</span>
                </div>
                <div style={cardBody}>
                  <p style={{ fontSize: "0.8125rem", color: INK6, marginBottom: 14, lineHeight: 1.5 }}>
                    El usuario quedará registrado en la municipalidad institucional del sistema.
                  </p>
                  <LocationPicker
                    value={{}}
                    onChange={() => { /* fijado por el sistema */ }}
                    lockedScope="active-municipality"
                  />

                  {/* Empresa — sólo cuando el rol es operador */}
                  {selRole === "operador" && (
                    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${INK1}` }}>
                      <label style={LABEL}>
                        Empresa asignada
                        <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                          (el operador podrá administrar solo esta empresa)
                        </span>
                      </label>
                      {loadingCompanies ? (
                        <div style={{ ...FIELD, display: "flex", alignItems: "center", color: INK5 }}>
                          <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite", marginRight: 8 }} />
                          Cargando empresas…
                        </div>
                      ) : companies.length === 0 ? (
                        <div style={{
                          padding: "12px 14px", borderRadius: 9,
                          background: "#FFFBEB", border: "1.5px solid #FDE68A",
                          fontSize: "0.8125rem", color: "#92400E",
                          display: "flex", flexDirection: "column", gap: 8,
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>No hay empresas registradas. Crea una empresa primero.</span>
                          </div>
                          <Link href="/empresas/nueva"
                            style={{ alignSelf: "flex-start", color: "#92400E", fontWeight: 700, textDecoration: "underline", fontSize: "0.75rem" }}>
                            Ir a crear empresa →
                          </Link>
                        </div>
                      ) : (
                        <select
                          value={companyId}
                          onChange={(e) => setCompanyId(e.target.value)}
                          style={{ ...FIELD, height: 42, borderColor: fieldErrors.companyId ? RED : INK2 }}
                        >
                          <option value="">Sin asignar</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.razonSocial}</option>
                          ))}
                        </select>
                      )}
                      <FieldErr k="companyId" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3 · Datos del usuario */}
            <div style={card}>
              <div style={cardHead}>
                <span>{meta.showLocation ? "3" : "2"} · Datos del usuario</span>
              </div>
              <div style={cardBody}>
                <div className="cols-2-responsive">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LABEL}>Nombre completo <span style={{ color: RED }}>*</span></label>
                    <input
                      value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ej. María González"
                      style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.name ? RED : INK2; }}
                    />
                    <FieldErr k="name" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LABEL}>Correo electrónico <span style={{ color: RED }}>*</span></label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      style={{ ...FIELD, borderColor: fieldErrors.email ? RED : INK2 }}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.email ? RED : INK2; }}
                    />
                    <FieldErr k="email" />
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                    padding: "10px 12px", borderRadius: 9,
                    border: `1.5px solid ${shouldCompleteNow ? INK9 : INK2}`,
                    background: shouldCompleteNow ? INK1 : "#fff",
                    transition: "all 0.15s",
                  }}>
                    <input
                      type="checkbox"
                      checked={shouldCompleteNow}
                      onChange={(e) => setCompleteNow(e.target.checked)}
                      disabled={identityRequiredByRole}
                      style={{ marginTop: 2, accentColor: INK9, cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9 }}>
                        Completar DNI y teléfono ahora
                      </div>
                      <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, lineHeight: 1.4 }}>
                        {identityRequiredByRole
                          ? "Para este rol, DNI y teléfono son obligatorios al crear la cuenta."
                          : "Si lo dejás desmarcado, el usuario completará DNI y teléfono en su primer ingreso. Marcalo solo si vos ya tenés esos datos a mano."}
                      </div>
                    </div>
                  </label>

                  {shouldCompleteNow && (
                    <div style={{ marginTop: 16 }}>
                      <div className="cols-2-responsive">
                        <div>
                          <label style={LABEL}>
                            DNI <span style={{ color: RED }}>*</span>
                            <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                              (verificación RENIEC)
                            </span>
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              value={dni}
                              onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                              placeholder="12345678"
                              inputMode="numeric"
                              style={{ ...FIELD,
                                       fontFamily: "ui-monospace,monospace",
                                       paddingRight: 40,
                                       borderColor: fieldErrors.dni ? RED
                                                  : dniLookup.state === "ok"
                                                    ? (dniLookup.source === "mock" ? "#F59E0B" : GRN)
                                                    : INK2 }}
                            />
                            <div style={{
                              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                              pointerEvents: "none",
                            }}>
                              {dniLookup.state === "loading" && <Loader2 size={16} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                              {dniLookup.state === "ok" && dniLookup.source === "reniec" && <CheckCircle size={16} color={GRN} />}
                              {dniLookup.state === "ok" && dniLookup.source === "mock"   && <AlertTriangle size={16} color="#F59E0B" />}
                              {dniLookup.state === "not_found" && <Search size={16} color={INK5} />}
                              {dniLookup.state === "error"   && <AlertTriangle size={16} color={RED} />}
                            </div>
                          </div>
                          <FieldErr k="dni" />
                        </div>
                        <div>
                          <label style={LABEL}>Teléfono <span style={{ color: RED }}>*</span></label>
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+51 999 999 999"
                            style={{ ...FIELD, borderColor: fieldErrors.phone ? RED : INK2 }}
                          />
                          <FieldErr k="phone" />
                        </div>
                      </div>

                      {dniLookup.state === "ok" && dniLookup.source === "reniec" && (
                        <div style={{
                          marginTop: 10, padding: "10px 14px",
                          background: GRN_BG, border: `1.5px solid ${GRN_BD}`, borderRadius: 9,
                          display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <CheckCircle size={14} color={GRN} style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: GRN, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                RENIEC
                              </div>
                              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
                                {dniLookup.nombreCompleto}
                              </div>
                            </div>
                          </div>
                          {name.trim().toLowerCase() !== dniLookup.nombreCompleto.toLowerCase() && (
                            <button
                              type="button"
                              onClick={() => setName(dniLookup.nombreCompleto)}
                              style={{
                                height: 30, padding: "0 12px", borderRadius: 8,
                                border: `1.5px solid ${GRN}`, background: "#fff", color: GRN,
                                fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                flexShrink: 0,
                              }}
                            >
                              Usar este nombre
                            </button>
                          )}
                        </div>
                      )}
                      {dniLookup.state === "ok" && dniLookup.source === "mock" && (
                        <div style={{
                          marginTop: 10, padding: "10px 14px",
                          background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 9,
                          display: "flex", alignItems: "flex-start", gap: 10,
                        }}>
                          <AlertTriangle size={14} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Datos de prueba — RENIEC no disponible
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#92400E", marginTop: 4, lineHeight: 1.5 }}>
                              El servicio RENIEC no respondió. Ingresa el nombre real manualmente antes de guardar.
                            </div>
                          </div>
                        </div>
                      )}
                      {dniLookup.state === "not_found" && (
                        <div style={{
                          marginTop: 10, padding: "10px 14px",
                          background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 9,
                          fontSize: "0.75rem", color: "#92400E",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <AlertTriangle size={13} />
                          DNI no encontrado en RENIEC. Verificar antes de guardar.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4 · Acceso a la cuenta */}
            <div style={card}>
              <div style={cardHead}>
                <span>{meta.showLocation ? "4" : "3"} · Acceso a la cuenta</span>
              </div>
              <div style={cardBody}>
                <div>
                  <label style={LABEL}>Contraseña inicial <span style={{ color: RED }}>*</span></label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"}
                      value={password} onChange={e => setPassword(e.target.value)}
                      style={{ ...FIELD, paddingRight: 88, borderColor: fieldErrors.password ? RED : INK2, fontFamily: showPass ? "inherit" : "monospace" }}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.password ? RED : INK2; }}
                    />
                    <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
                      <button type="button" title="Generar contraseña"
                        onClick={() => setPassword(generatePassword())}
                        style={{ width: 32, height: 32, border: `1.5px solid ${INK2}`, borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <RefreshCw size={13} color={INK5} />
                      </button>
                      <button type="button" title={showPass ? "Ocultar" : "Mostrar"}
                        onClick={() => setShowPass(v => !v)}
                        style={{ width: 32, height: 32, border: `1.5px solid ${INK2}`, borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {showPass ? <EyeOff size={13} color={INK5} /> : <Eye size={13} color={INK5} />}
                      </button>
                    </div>
                  </div>
                  <FieldErr k="password" />
                  <p style={{ fontSize: "0.75rem", color: INK5, marginTop: 6 }}>
                    Es una contraseña <strong>temporal</strong> — el usuario deberá cambiarla en su primer ingreso. Compártesela por canal seguro.
                  </p>
                </div>

                <div style={{ marginTop: 18 }}>
                  <label style={LABEL}>Estado inicial</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["activo", "pendiente"] as const).map(s => {
                      const isSelected = selStatus === s;
                      const colors = s === "activo"
                        ? { color: GRN,       bg: GRN_BG,   bd: GRN_BD }
                        : { color: "#92400e", bg: "#FFFBEB", bd: "#FDE68A" };
                      return (
                        <button key={s} type="button" onClick={() => setSelStatus(s)}
                          style={{
                            flex: 1, padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                            textAlign: "left", fontFamily: "inherit",
                            border: isSelected ? `2px solid ${colors.color}` : `1.5px solid ${INK2}`,
                            background: isSelected ? colors.bg : "#fff",
                            transition: "all 0.15s",
                          }}>
                          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: isSelected ? colors.color : INK9, marginBottom: 2 }}>
                            {s === "activo" ? "Activo" : "Pendiente"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: INK5 }}>
                            {s === "activo"
                              ? "El usuario puede iniciar sesión de inmediato"
                              : "El usuario debe ser aprobado antes de acceder"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={loading}
                style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                <UserPlus size={15} />
                {loading ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </div>

          {/* ── Barra lateral — guía ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: GOLD_C, marginBottom: 12 }}>
                Jerarquía de roles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Super Administrador",       desc: "Administración general del sistema" },
                  { label: "Administrador Provincial",  desc: "Supervisión de la provincia" },
                  { label: "Administrador Municipal",   desc: "Gestión de la municipalidad" },
                  { label: "Fiscal",                    desc: "Inspecciones de campo" },
                  { label: "Operador",                  desc: "Administración de la flota" },
                  { label: "Conductor",                 desc: "Personal de conducción" },
                  { label: "Ciudadano",                 desc: "Acceso público desde la aplicación" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: i === 0 ? GOLD_C : INK2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "0.625rem", fontWeight: 800, color: i === 0 ? "#fff" : INK5 }}>{i + 1}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9 }}>{r.label}</div>
                      <div style={{ fontSize: "0.6875rem", color: INK5 }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: INK9, marginBottom: 10 }}>Asignación territorial</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.8125rem", color: INK6, lineHeight: 1.5 }}>
                <p><strong style={{ color: INK9 }}>Obligatoria</strong> para Admin Provincial (provincia) y Admin Municipal (provincia + muni) — es su scope.</p>
                <p><strong style={{ color: INK9 }}>Opcional</strong> para fiscal, operador y conductor — podés crearlos sin territorio y asignarlo después desde su ficha.</p>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
