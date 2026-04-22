"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Gift, Coins, Users, ShoppingBag, Plus, X, ChevronDown } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
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

const ALLOWED = ["super_admin", "admin_municipal"];

const CATEGORY_LABELS: Record<RecompensaCategory, string> = {
  descuento: "Descuento",
  beneficio: "Beneficio",
  certificado: "Certificado",
  otro: "Otro",
};

const CATEGORY_VARIANT: Record<RecompensaCategory, "gold" | "info" | "activo" | "inactivo"> = {
  descuento: "info",
  beneficio: "activo",
  certificado: "gold",
  otro: "inactivo",
};

function fmtStock(stock: number): string {
  if (stock === -1) return "Ilimitado";
  if (stock === 0) return "Agotado";
  return String(stock);
}

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

  const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
  const RECH_C = "#b91c1c"; const RECH_BG = "#FFF5F5"; const RECH_BD = "#FCA5A5";

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
        body: JSON.stringify({ name: name.trim(), description: description.trim(), cost: costNum, category, stock: stockNum }),
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
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(9,9,11,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Nueva recompensa</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Añadir al catálogo de recompensas canjeables</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK5 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Nombre <span style={{ color: RECH_C }}>*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Cupón de transporte gratuito" style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Descripción <span style={{ color: RECH_C }}>*</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción detallada de la recompensa…" rows={3}
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
              <input type="number" min={1} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ej: 200" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
                Stock (-1 = ilimitado)
              </label>
              <input type="number" min={-1} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="-1" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>Categoría</label>
            <div style={{ position: "relative" }}>
              <select
                value={category} onChange={(e) => setCategory(e.target.value as RecompensaCategory)}
                style={{ ...inputStyle, appearance: "none", paddingRight: 36, cursor: "pointer" }}
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
            <button onClick={onClose} style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", height: 38, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={() => { void submit(); }} disabled={loading}
              style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
            >
              <Gift size={15} />{loading ? "Creando…" : "Crear recompensa"}
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

  function handleCreated(r: Recompensa) {
    setItems((prev) => [r, ...prev]);
    setShowModal(false);
  }


  const columns = useMemo<ColumnDef<Recompensa, unknown>[]>(
    () => [
      {
        id: "nombre",
        header: "Nombre",
        accessorFn: (r) => `${r.name} ${r.description}`,
        cell: ({ row }) => (
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontWeight: 600, color: "#09090b" }}>{row.original.name}</div>
            <div style={{
              fontSize: "0.75rem", color: "#71717a", marginTop: 2,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
            }}>
              {row.original.description}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Categoría",
        cell: ({ getValue }) => (
          <Badge variant={CATEGORY_VARIANT[getValue() as RecompensaCategory]}>
            {CATEGORY_LABELS[getValue() as RecompensaCategory]}
          </Badge>
        ),
      },
      {
        accessorKey: "cost",
        header: "Costo (coins)",
        cell: ({ getValue }) => {
          const v = getValue() as number | undefined;
          return (
            <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#B8860B", fontVariantNumeric: "tabular-nums" }}>
              {v != null ? v.toLocaleString("es-PE") : "—"}
              <span style={{ fontSize: "0.75rem", color: "#71717a", marginLeft: 4, fontWeight: 500 }}>coins</span>
            </span>
          );
        },
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <span style={{
              fontVariantNumeric: "tabular-nums", fontWeight: 600,
              color: v === -1 ? "#15803d" : v === 0 ? "#b91c1c" : "#09090b",
            }}>
              {fmtStock(v)}
            </span>
          );
        },
      },
    ],
    []
  );


  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader
        kicker="Ciudadanía · RF-16"
        title="Recompensas"
        action={
          <button
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
              borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              border: "1.5px solid #E8D090", background: "#FDF8EC", color: "#B8860B", fontFamily: "inherit",
            }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />Nueva recompensa
          </button>
        }
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "TOTAL CANJES", value: kpi?.totalCanjes ?? "—", subtitle: "histórico", accent: "#52525b", icon: ShoppingBag },
          { label: "COINS CIRC.", value: kpi?.coinsEnCirculacion ?? "—", subtitle: "en circulación", accent: "#B8860B", icon: Coins },
          { label: "USUARIOS", value: kpi?.usuariosConCoins ?? "—", subtitle: "con saldo", accent: "#15803d", icon: Users },
          { label: "EN CATÁLOGO", value: loading ? "—" : items.length, subtitle: "recompensas", accent: "#B8860B", icon: Gift },
        ]}
      />

      {error && (
        <div style={{ padding: "12px 16px", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar recompensa, categoría…"
        emptyTitle="Sin recompensas"
        emptyDescription='Crea la primera recompensa con el botón "Nueva recompensa".'
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={undefined}
      />

      {showModal && (
        <NewRecompensaModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
