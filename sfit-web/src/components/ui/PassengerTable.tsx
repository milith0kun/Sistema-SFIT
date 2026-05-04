"use client";

import { useRef, useState } from "react";
import {
  Plus, Upload, Pencil, Trash2, Save, X, Check, AlertCircle, Users,
} from "lucide-react";

/**
 * Pasajero (registro nominal por viaje interprovincial / regional / nacional).
 * Coincide con `Passenger` del backend (modelo nuevo de Track A).
 */
export interface PassengerRow {
  id?: string;             // undefined = nuevo, aún sin persistir
  fullName: string;
  documentNumber: string;
  documentType?: "DNI" | "CE" | "PASSPORT";
  seatNumber?: string;
  origin?: string;
  destination?: string;
  phone?: string;
  emergencyContact?: { name: string; phone: string };
  boardedAt?: string;
}

interface PassengerTableProps {
  passengers: PassengerRow[];
  /**
   * Llamado tras agregar / editar / eliminar inline. El padre persiste contra
   * la API y vuelve a hidratar el array.
   */
  onAdd?: (p: PassengerRow) => Promise<void> | void;
  onEdit?: (id: string, partial: Partial<PassengerRow>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  /** Sube un archivo Excel/CSV vía multipart al endpoint de import. */
  onImport?: (file: File) => Promise<void> | void;
  editable?: boolean;
  /** Mensaje opcional debajo del header (p.ej. errores de import). */
  notice?: string | null;
}

/* Paleta sobria — consistente con el resto del proyecto */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const APTO = "#15803d"; const APTO_BD = "#86EFAC";

const FIELD_INLINE: React.CSSProperties = {
  width: "100%", height: 30, padding: "0 8px",
  border: `1px solid ${INK2}`, borderRadius: 6, fontSize: "0.8125rem",
  fontFamily: "inherit", outline: "none", color: INK9, background: "#fff",
};

export function PassengerTable({
  passengers,
  onAdd,
  onEdit,
  onDelete,
  onImport,
  editable = true,
  notice = null,
}: PassengerTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PassengerRow>>({});
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<PassengerRow>({
    fullName: "", documentNumber: "", documentType: "DNI",
  });
  const [busy, setBusy] = useState(false);

  function startEdit(p: PassengerRow) {
    if (!p.id) return;
    setEditingId(p.id);
    setEditDraft({
      fullName: p.fullName,
      documentNumber: p.documentNumber,
      documentType: p.documentType ?? "DNI",
      seatNumber: p.seatNumber ?? "",
      origin: p.origin ?? "",
      destination: p.destination ?? "",
      phone: p.phone ?? "",
    });
  }

  async function commitEdit(id: string) {
    if (!onEdit) return;
    setBusy(true);
    try {
      await onEdit(id, editDraft);
      setEditingId(null);
      setEditDraft({});
    } finally {
      setBusy(false);
    }
  }

  async function commitNew() {
    if (!onAdd) return;
    if (!newDraft.fullName.trim() || !newDraft.documentNumber.trim()) return;
    setBusy(true);
    try {
      await onAdd(newDraft);
      setAdding(false);
      setNewDraft({ fullName: "", documentNumber: "", documentType: "DNI" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este pasajero del manifiesto?")) return;
    setBusy(true);
    try { await onDelete(id); } finally { setBusy(false); }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !onImport) return;
    setBusy(true);
    try { await onImport(f); } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header con acciones */}
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: INK1, border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Users size={14} color={INK6} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
              Pasajeros
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3 }}>
              {passengers.length} {passengers.length === 1 ? "registrado" : "registrados"}
            </div>
          </div>
        </div>

        {editable && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {onImport && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 30, padding: "0 12px", borderRadius: 7,
                    border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                    fontSize: "0.75rem", fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
                  }}
                >
                  <Upload size={12} />Importar Excel
                </button>
              </>
            )}
            {onAdd && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                disabled={busy || adding}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 30, padding: "0 12px", borderRadius: 7,
                  border: "none", background: INK9, color: "#fff",
                  fontSize: "0.75rem", fontWeight: 700,
                  cursor: busy || adding ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: busy || adding ? 0.7 : 1,
                }}
              >
                <Plus size={12} />Agregar pasajero
              </button>
            )}
          </div>
        )}
      </div>

      {notice && (
        <div style={{
          padding: "8px 16px", background: RED_BG,
          borderBottom: `1px solid ${RED_BD}`,
          color: RED, fontSize: "0.75rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <AlertCircle size={12} />{notice}
        </div>
      )}

      {/* Empty state */}
      {passengers.length === 0 && !adding && (
        <div style={{
          padding: "32px 20px", textAlign: "center",
          color: INK5, fontSize: "0.8125rem",
        }}>
          <Users size={24} color={INK5} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div style={{ marginBottom: 6, fontWeight: 600, color: INK6 }}>
            Sin pasajeros registrados
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            {editable
              ? "Usa “Agregar pasajero” o importa un Excel con la lista."
              : "El operador aún no ha registrado pasajeros para este viaje."}
          </div>
        </div>
      )}

      {/* Tabla */}
      {(passengers.length > 0 || adding) && (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontSize: "0.8125rem", color: INK9,
          }}>
            <thead>
              <tr style={{ background: INK1, borderBottom: `1px solid ${INK2}` }}>
                <Th>#</Th>
                <Th>Documento</Th>
                <Th>Tipo</Th>
                <Th>Nombre completo</Th>
                <Th>Asiento</Th>
                <Th>Origen</Th>
                <Th>Destino</Th>
                <Th>Teléfono</Th>
                {editable && <Th align="right">Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {passengers.map((p, i) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id ?? `idx-${i}`} style={{
                    borderBottom: i < passengers.length - 1 || adding ? `1px solid ${INK1}` : undefined,
                  }}>
                    <Td muted>{i + 1}</Td>
                    <Td mono>
                      {isEditing ? (
                        <input
                          value={editDraft.documentNumber ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, documentNumber: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : p.documentNumber}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editDraft.documentType ?? "DNI"}
                          onChange={e => setEditDraft(d => ({ ...d, documentType: e.target.value as PassengerRow["documentType"] }))}
                          style={FIELD_INLINE}
                        >
                          <option value="DNI">DNI</option>
                          <option value="CE">CE</option>
                          <option value="PASSPORT">PASSPORT</option>
                        </select>
                      ) : (p.documentType ?? "DNI")}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editDraft.fullName ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, fullName: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : p.fullName}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editDraft.seatNumber ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, seatNumber: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : (p.seatNumber ?? "—")}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editDraft.origin ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, origin: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : (p.origin ?? "—")}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editDraft.destination ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, destination: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : (p.destination ?? "—")}
                    </Td>
                    <Td mono>
                      {isEditing ? (
                        <input
                          value={editDraft.phone ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, phone: e.target.value }))}
                          style={FIELD_INLINE}
                        />
                      ) : (p.phone ?? "—")}
                    </Td>
                    {editable && (
                      <Td align="right">
                        <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                          {isEditing ? (
                            <>
                              <IconBtn
                                onClick={() => p.id && commitEdit(p.id)}
                                disabled={busy}
                                tone="apto" title="Guardar"
                              >
                                <Save size={12} />
                              </IconBtn>
                              <IconBtn
                                onClick={() => { setEditingId(null); setEditDraft({}); }}
                                disabled={busy} title="Cancelar"
                              >
                                <X size={12} />
                              </IconBtn>
                            </>
                          ) : (
                            <>
                              {onEdit && p.id && (
                                <IconBtn onClick={() => startEdit(p)} disabled={busy} title="Editar">
                                  <Pencil size={12} />
                                </IconBtn>
                              )}
                              {onDelete && p.id && (
                                <IconBtn
                                  onClick={() => handleDelete(p.id!)}
                                  disabled={busy} tone="red" title="Eliminar"
                                >
                                  <Trash2 size={12} />
                                </IconBtn>
                              )}
                            </>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}

              {/* Fila para agregar */}
              {adding && (
                <tr style={{ background: APTO + "08" }}>
                  <Td muted>—</Td>
                  <Td mono>
                    <input
                      autoFocus placeholder="Doc."
                      value={newDraft.documentNumber}
                      onChange={e => setNewDraft(d => ({ ...d, documentNumber: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td>
                    <select
                      value={newDraft.documentType ?? "DNI"}
                      onChange={e => setNewDraft(d => ({ ...d, documentType: e.target.value as PassengerRow["documentType"] }))}
                      style={FIELD_INLINE}
                    >
                      <option value="DNI">DNI</option>
                      <option value="CE">CE</option>
                      <option value="PASSPORT">PASSPORT</option>
                    </select>
                  </Td>
                  <Td>
                    <input
                      placeholder="Nombre completo"
                      value={newDraft.fullName}
                      onChange={e => setNewDraft(d => ({ ...d, fullName: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td>
                    <input
                      placeholder="A1"
                      value={newDraft.seatNumber ?? ""}
                      onChange={e => setNewDraft(d => ({ ...d, seatNumber: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td>
                    <input
                      placeholder="Origen"
                      value={newDraft.origin ?? ""}
                      onChange={e => setNewDraft(d => ({ ...d, origin: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td>
                    <input
                      placeholder="Destino"
                      value={newDraft.destination ?? ""}
                      onChange={e => setNewDraft(d => ({ ...d, destination: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td mono>
                    <input
                      placeholder="Teléfono"
                      value={newDraft.phone ?? ""}
                      onChange={e => setNewDraft(d => ({ ...d, phone: e.target.value }))}
                      style={FIELD_INLINE}
                    />
                  </Td>
                  <Td align="right">
                    <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                      <IconBtn
                        onClick={commitNew}
                        disabled={busy || !newDraft.fullName.trim() || !newDraft.documentNumber.trim()}
                        tone="apto" title="Guardar nuevo"
                      >
                        <Check size={12} />
                      </IconBtn>
                      <IconBtn
                        onClick={() => { setAdding(false); setNewDraft({ fullName: "", documentNumber: "", documentType: "DNI" }); }}
                        disabled={busy} title="Cancelar"
                      >
                        <X size={12} />
                      </IconBtn>
                    </div>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Subcomponentes ── */

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th style={{
      textAlign: align ?? "left",
      padding: "9px 12px",
      fontSize: "0.6875rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      color: INK5, whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function Td({
  children, align, mono, muted,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td style={{
      padding: "8px 12px",
      fontSize: "0.8125rem",
      color: muted ? INK5 : INK9,
      textAlign: align ?? "left",
      fontFamily: mono ? "ui-monospace, monospace" : "inherit",
      letterSpacing: mono ? "0.02em" : 0,
      verticalAlign: "middle",
    }}>
      {children}
    </td>
  );
}

function IconBtn({
  children, onClick, disabled, title, tone,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "apto" | "red";
}) {
  const color = tone === "red" ? RED : tone === "apto" ? APTO : INK6;
  const bg = tone === "red" ? RED_BG : tone === "apto" ? "#F0FDF4" : "#fff";
  const bd = tone === "red" ? RED_BD : tone === "apto" ? APTO_BD : INK2;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 6,
        border: `1px solid ${bd}`, background: bg, color,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
