"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Eye, EyeOff, RefreshCw, Loader2, CheckCircle, AlertTriangle, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

type Province     = { id: string; name: string };
type Municipality = { id: string; name: string; provinceId: string };
type StoredUser   = { role: string };

/* ── Tokens ── */
const INK9 = "#18181b"; const INK6 = "#52525b"; const INK5 = "#71717a";
const INK2 = "#e4e4e7"; const INK1 = "#f4f4f5";
const RED  = "#DC2626"; const RED_BG  = "#FFF5F5"; const RED_BD  = "#FCA5A5";
const GRN  = "#15803d"; const GRN_BG  = "#F0FDF4"; const GRN_BD  = "#86EFAC";
const GOLD_BG = "#FBEAEA"; const GOLD_BD = "#D9B0B0"; const GOLD_C = "#4A0303";

const FIELD: React.CSSProperties = {
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

const ROLE_META: Record<string, { label: string; desc: string; needsMuni: boolean; needsProv: boolean }> = {
  super_admin:      { label: "Super Administrador",      desc: "Acceso total al sistema — puede crear y gestionar todo", needsProv: false, needsMuni: false },
  admin_provincial: { label: "Administrador Provincial", desc: "Supervisa todas las municipalidades de su provincia", needsProv: true,  needsMuni: false },
  admin_municipal:  { label: "Administrador Municipal",  desc: "Administra una municipalidad específica",              needsProv: true,  needsMuni: true  },
  fiscal:           { label: "Fiscal / Inspector", desc: "Realiza inspecciones en campo",                   needsProv: true,  needsMuni: true  },
  operador:         { label: "Operador",          desc: "Administra la flota de una empresa de transporte",   needsProv: true,  needsMuni: true  },
  conductor:        { label: "Conductor",         desc: "Conductor registrado en una empresa",               needsProv: true,  needsMuni: true  },
  ciudadano:        { label: "Ciudadano",         desc: "Ciudadano reportador — acceso global, sin municipio", needsProv: false, needsMuni: false },
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

  const [user,           setUser]           = useState<StoredUser | null>(null);
  const [provinces,      setProvinces]      = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPass, setShowPass] = useState(false);
  const [selRole,  setSelRole]  = useState<string>("admin_municipal");
  const [selProv,  setSelProv]  = useState("");
  const [selMuni,  setSelMuni]  = useState("");
  const [selStatus, setSelStatus] = useState<"activo" | "pendiente">("activo");
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
    void loadRefs();
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
        setDniLookup({ state: "ok", nombreCompleto: data.data.nombre_completo });
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
      }
    }, 350);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni, completeNow]);

  async function loadRefs() {
    try {
      const [pr, mr] = await Promise.all([
        fetch("/api/provincias",      { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch("/api/municipalidades", { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (pr.ok) {
        const d = await pr.json() as { success: boolean; data?: { items: Province[] } };
        if (d.success) setProvinces(d.data?.items ?? []);
      }
      if (mr.ok) {
        const d = await mr.json() as { success: boolean; data?: { items: Municipality[] } };
        if (d.success) setMunicipalities(d.data?.items ?? []);
      }
    } catch { /* silent */ }
  }

  const meta = ROLE_META[selRole] ?? ROLE_META.admin_municipal;
  const filteredMunis = selProv
    ? municipalities.filter(m => m.provinceId === selProv)
    : municipalities;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!name.trim())    errs.name     = "El nombre es requerido";
    if (!email.trim())   errs.email    = "El correo es requerido";
    if (password.length < 8) errs.password = "Mínimo 8 caracteres";
    if (meta.needsProv && !selProv)  errs.provinceId     = "Seleccione la provincia";
    if (meta.needsMuni && !selMuni)  errs.municipalityId = "Seleccione la municipalidad";
    if (completeNow) {
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
          provinceId:     meta.needsProv ? (selProv || undefined) : undefined,
          municipalityId: meta.needsMuni ? (selMuni || undefined) : undefined,
          // Flujo híbrido: password siempre temporal (el usuario la cambia al primer login).
          passwordIsTemporary: true,
          completeProfileNow:  completeNow,
          ...(completeNow ? { dni: dni.trim(), phone: phone.trim() } : {}),
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

            {/* Datos personales */}
            <div style={card}>
              <div style={cardHead}>Datos personales</div>
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
                  <div style={{ gridColumn: "1 / -1" }}>
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
                </div>
              </div>
            </div>

            {/* Rol */}
            <div style={card}>
              <div style={cardHead}>Rol del usuario</div>
              <div style={cardBody}>
                <div className="cols-2-responsive" style={{ gap: 10, marginBottom: 18 }}>
                  {Object.entries(ROLE_META).map(([role, m]) => {
                    const selected = selRole === role;
                    return (
                      <button key={role} type="button" onClick={() => { setSelRole(role); setSelMuni(""); }}
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

                {/* Provincia / Municipio (condicional al rol) */}
                {meta.needsProv && (
                  <div className={meta.needsMuni ? "cols-2-responsive" : ""} style={meta.needsMuni ? undefined : { display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                    <div>
                      <label style={LABEL}>Provincia <span style={{ color: RED }}>*</span></label>
                      <div style={{ position: "relative" }}>
                        <select value={selProv} onChange={e => { setSelProv(e.target.value); setSelMuni(""); }}
                          style={{ ...FIELD, appearance: "none", paddingRight: 36, cursor: "pointer", borderColor: fieldErrors.provinceId ? RED : INK2 }}>
                          <option value="">— Seleccione provincia —</option>
                          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <svg viewBox="0 0 10 6" width="10" height="10" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} fill="none">
                          <path d="M1 1l4 4 4-4" stroke={INK5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <FieldErr k="provinceId" />
                    </div>

                    {meta.needsMuni && (
                      <div>
                        <label style={LABEL}>Municipalidad <span style={{ color: RED }}>*</span></label>
                        <div style={{ position: "relative" }}>
                          <select value={selMuni} onChange={e => setSelMuni(e.target.value)}
                            disabled={!selProv}
                            style={{ ...FIELD, appearance: "none", paddingRight: 36, cursor: selProv ? "pointer" : "default", opacity: selProv ? 1 : 0.5, borderColor: fieldErrors.municipalityId ? RED : INK2 }}>
                            <option value="">— Seleccione municipalidad —</option>
                            {filteredMunis.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <svg viewBox="0 0 10 6" width="10" height="10" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} fill="none">
                            <path d="M1 1l4 4 4-4" stroke={INK5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <FieldErr k="municipalityId" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Onboarding — completar perfil ahora (opcional) */}
            <div style={card}>
              <div style={cardHead}>Datos personales del usuario</div>
              <div style={cardBody}>
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                  padding: "10px 12px", borderRadius: 9,
                  border: `1.5px solid ${completeNow ? INK9 : INK2}`,
                  background: completeNow ? INK1 : "#fff",
                  transition: "all 0.15s",
                }}>
                  <input
                    type="checkbox"
                    checked={completeNow}
                    onChange={(e) => setCompleteNow(e.target.checked)}
                    style={{ marginTop: 2, accentColor: INK9, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9 }}>
                      Completar perfil del usuario ahora
                    </div>
                    <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, lineHeight: 1.4 }}>
                      Si dejás esto desmarcado, el usuario completará DNI y teléfono en su primer ingreso.
                      Marcalo solo si vos ya tenés esos datos a mano.
                    </div>
                  </div>
                </label>

                {completeNow && (
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
                                                : dniLookup.state === "ok" ? GRN : INK2 }}
                          />
                          <div style={{
                            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                            pointerEvents: "none",
                          }}>
                            {dniLookup.state === "loading" && <Loader2 size={16} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                            {dniLookup.state === "ok"      && <CheckCircle size={16} color={GRN} />}
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

                    {dniLookup.state === "ok" && (
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

            {/* Estado inicial */}
            <div style={card}>
              <div style={cardHead}>Estado inicial de la cuenta</div>
              <div style={{ ...cardBody, display: "flex", gap: 10 }}>
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
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: INK9, marginBottom: 10 }}>Qué puede hacer cada admin</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.8125rem", color: INK6, lineHeight: 1.5 }}>
                <p><strong style={{ color: INK9 }}>Super Admin</strong> — gestiona todo: crea admins provinciales y municipales, ve todos los usuarios del sistema.</p>
                <p><strong style={{ color: INK9 }}>Admin Provincial</strong> — aprueba y gestiona usuarios de todos los municipios de su provincia.</p>
                <p><strong style={{ color: INK9 }}>Admin Municipal</strong> — aprueba solicitudes de fiscales, operadores y conductores de su municipio.</p>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
