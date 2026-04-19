"use client";

import { useEffect, useState, useCallback, cloneElement } from "react";
import { useRouter } from "next/navigation";
import { Gift, Coins, Users, ShoppingBag, Plus, X, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

// ── Tipos ────────────────────────────────────────────────────────────────────
type RecompensaCategory = "descuento" | "beneficio" | "certificado" | "otro";

type Recompensa = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: RecompensaCategory;
  stock: number;
  active: boolean;
  imageUrl?: string;
};

type KpiStats = {
  totalCanjes: number;
  coinsEnCirculacion: number;
  usuariosConCoins: number;
  recompensasActivas: number;
};

// ── Palette tokens ────────────────────────────────────────────────────────────
const INK1 = "#f4f4f5";
const INK2 = "#e4e4e7";
const INK5 = "#71717a";
const INK6 = "#52525b";
const INK9 = "#18181b";

const GOLD_BG = "#FDF8EC";
const GOLD_C  = "#B8860B";
const GOLD_BD = "#E8D090";

const APTO_BG = "#F0FDF4";
const APTO_C  = "#15803d";
const APTO_BD = "#86EFAC";

const RECH_BG = "#FFF5F5";
const RECH_C  = "#b91c1c";
const RECH_BD = "#FCA5A5";

const ALLOWED = ["super_admin", "admin_municipal"];

const CATEGORY_LABELS: Record<RecompensaCategory, string> = {
  descuento: "Descuento",
  beneficio: "Beneficio",
  certificado: "Certificado",
  otro: "Otro",
};

function fmtStock(stock: number) {
  return stock === -1 ? "Ilimitado" : String(stock);
}

const btnInk: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
  border: "none", background: INK9, color: "#fff", fontFamily: "inherit",
};
const btnOut: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
  border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit",
};
const btnGold: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
  border: `1.5px solid ${GOLD_BD}`, background: GOLD_BG, color: GOLD_C, fontFamily: "inherit",
};

// ── Modal nueva recompensa ────────────────────────────────────────────────────
function NewRecompensaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: Recompensa) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState<RecompensaCategory>("beneficio");
  const [stock, setStock] = useState("-1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    if (!description.trim()) { setError("La descripción es requerida"); return; }
    const costNum = Number(cost);
    if (!cost || isNaN(costNum) || costNum < 1) { setError("El costo debe ser mayor a 0"); return; }
    const stockNum = Number(stock);
    if (stock === "" || isNaN(stockNum)) { setError("El stock debe ser un número (-1 para ilimitado)"); return; }

    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/recompensas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          cost: costNum,
          category,
          stock: stockNum,
        }),
      });
      const data = await res.json() as { success: boolean; data?: Recompensa; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? "Error al crear"); return; }
      onCreated(data.data!);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 9,
    border: `1.5px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(9,9,11,0.55)", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Nueva recompensa</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Añadir al catálogo de recompensas canjeables</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK5 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Nombre <span style={{ color: RECH_C }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cupón de transporte gratuito"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Descripción <span style={{ color: RECH_C }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción detallada de la recompensa…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
                Costo (SFITCoins) <span style={{ color: RECH_C }}>*</span>
              </label>
              <input
                type="number"
                min={1}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Ej: 200"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
                Stock (-1 = ilimitado)
              </label>
              <input
                type="number"
                min={-1}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="-1"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Categoría
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecompensaCategory)}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  paddingRight: 36,
                  cursor: "pointer",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
              >
                <option value="descuento">Descuento</option>
                <option value="beneficio">Beneficio</option>
                <option value="certificado">Certificado</option>
                <option value="otro">Otro</option>
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: INK5, pointerEvents: "none" }} />
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: RECH_BG, border: `1px solid ${RECH_BD}`, borderRadius: 8, color: RECH_C, fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnOut, flex: 1, justifyContent: "center" }}>Cancelar</button>
            <button
              onClick={() => { void submit(); }}
              disabled={loading}
              style={{ ...btnInk, flex: 1, justifyContent: "center", opacity: loading ? 0.7 : 1 }}
            >
              <Gift size={15} />
              {loading ? "Creando…" : "Crear recompensa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RecompensasPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Recompensa[]>([]);
  const [kpi, setKpi] = useState<KpiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      const [catRes, statsRes] = await Promise.all([
        fetch("/api/admin/recompensas", { headers: { Authorization: `Bearer ${token ?? ""}` } }),
        fetch("/api/admin/recompensas/stats", { headers: { Authorization: `Bearer ${token ?? ""}` } }),
      ]);
      if (catRes.status === 401) { router.replace("/login"); return; }
      const catData = await catRes.json() as { success: boolean; data?: { items: Recompensa[] }; error?: string };
      if (!catRes.ok || !catData.success) { setError(catData.error ?? "Error al cargar"); return; }
      setItems(catData.data?.items ?? []);

      if (statsRes.ok) {
        const statsData = await statsRes.json() as { success: boolean; data?: KpiStats };
        if (statsData.success) setKpi(statsData.data ?? null);
      }
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  async function toggleActive(item: Recompensa) {
    setTogglingId(item.id);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/admin/recompensas/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: !item.active }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, active: !r.active } : r))
        );
      }
    } catch { /* silencioso */ }
    finally { setTogglingId(null); }
  }

  function handleCreated(r: Recompensa) {
    setItems((prev) => [r, ...prev]);
    setShowModal(false);
  }

  const activas   = items.filter((r) => r.active).length;
  const inactivas = items.filter((r) => !r.active).length;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader
        kicker="Ciudadanía · RF-16"
        title="Recompensas"
        action={
          <button style={btnGold} onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Nueva recompensa
          </button>
        }
      />

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <ShoppingBag size={18} />, lbl: "Total canjes",           val: kpi?.totalCanjes ?? "—",          bg: INK1,    ic: INK5   },
          { ico: <Coins size={18} />,       lbl: "Coins en circulación",   val: kpi?.coinsEnCirculacion ?? "—",   bg: GOLD_BG, ic: GOLD_C },
          { ico: <Users size={18} />,       lbl: "Usuarios con coins",     val: kpi?.usuariosConCoins ?? "—",     bg: APTO_BG, ic: APTO_C },
          { ico: <Gift size={18} />,        lbl: "Recompensas activas",    val: loading ? "—" : activas,          bg: GOLD_BG, ic: GOLD_C },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              {m.ico}
            </div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{m.val}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: RECH_BG, border: `1px solid ${RECH_BD}`, borderRadius: 10, color: RECH_C, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Catálogo de recompensas
            {!loading && (
              <span style={{ fontWeight: 400, color: INK5 }}>
                {" "}({activas} activa{activas !== 1 ? "s" : ""}, {inactivas} inactiva{inactivas !== 1 ? "s" : ""})
              </span>
            )}
          </div>
          <button style={{ ...btnOut, height: 36 }} onClick={() => void load()}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>
            <Gift size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>Sin recompensas en el catálogo</div>
            <div style={{ fontSize: "0.875rem", marginTop: 4 }}>Crea la primera recompensa con el botón "Nueva recompensa".</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {["Nombre", "Categoría", "Costo (coins)", "Stock", "Estado", "Acciones"].map((h, i) => (
                  <th key={i} style={{
                    textAlign: "left", padding: "12px 16px",
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${INK1}` }}>
                  {/* Nombre */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600, color: INK9 }}>{r.name}</div>
                    <div style={{
                      fontSize: "0.75rem", color: INK5, marginTop: 2,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                    }}>
                      {r.description}
                    </div>
                  </td>

                  {/* Categoría */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-flex", padding: "3px 9px", borderRadius: 6,
                      background: GOLD_BG, color: GOLD_C, border: `1px solid ${GOLD_BD}`,
                      fontSize: "0.75rem", fontWeight: 700,
                    }}>
                      {CATEGORY_LABELS[r.category]}
                    </span>
                  </td>

                  {/* Costo */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem", color: GOLD_C, fontVariantNumeric: "tabular-nums" }}>
                      {r.cost.toLocaleString("es-PE")}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: INK5, marginLeft: 4 }}>coins</span>
                  </td>

                  {/* Stock */}
                  <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {r.stock === -1 ? (
                      <span style={{ color: APTO_C }}>Ilimitado</span>
                    ) : r.stock === 0 ? (
                      <span style={{ color: RECH_C }}>Agotado</span>
                    ) : (
                      <span style={{ color: INK9 }}>{fmtStock(r.stock)}</span>
                    )}
                  </td>

                  {/* Estado */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
                      borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
                      background: r.active ? APTO_BG : INK1,
                      color: r.active ? APTO_C : INK5,
                      border: `1px solid ${r.active ? APTO_BD : INK2}`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                      {r.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      disabled={togglingId === r.id}
                      onClick={() => { void toggleActive(r); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                        borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                        border: `1.5px solid ${r.active ? RECH_BD : APTO_BD}`,
                        background: r.active ? RECH_BG : APTO_BG,
                        color: r.active ? RECH_C : APTO_C,
                        fontFamily: "inherit",
                        opacity: togglingId === r.id ? 0.6 : 1,
                      }}
                    >
                      {togglingId === r.id ? "…" : r.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewRecompensaModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
