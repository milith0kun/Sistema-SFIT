"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV } from "./nav";

/**
 * Buscador de navegación rápida ("ir a…") accesible desde el botón Search del
 * Topbar o con el atajo Cmd/Ctrl+K. No es un buscador semántico — solo filtra
 * los items del sidebar permitidos por el rol del usuario. Suficiente para
 * navegar el dashboard sin saturar el contexto con buscadores backend.
 */
export function CommandPalette({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Items visibles según el rol; si no hay rol caemos a lo mínimo.
  const items = useMemo(() => {
    return NAV.filter((n) => (role ? n.roles.includes(role) : false));
  }, [role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.href.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Reset al abrir, focus en input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  // Mantener el índice activo dentro de rango cuando cambia el filtro.
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered, activeIdx]);

  // Navegación con teclado + cierre con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filtered[activeIdx];
        if (target) {
          router.push(target.href);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, router, onClose]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en el panel"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15, 15, 17, 0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, calc(100vw - 24px))",
          background: "#fff",
          borderRadius: 12,
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)",
          border: "1px solid #e4e4e7",
          overflow: "hidden",
          fontFamily: "var(--font-inter), Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid #e4e4e7",
          }}
        >
          <Search size={16} color="#71717a" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar página… (empresas, vehículos, reportes…)"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.9375rem",
              color: "#18181b",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "#a1a1aa",
              padding: "2px 6px",
              borderRadius: 5,
              border: "1px solid #e4e4e7",
              background: "#f4f4f5",
              letterSpacing: "0.04em",
            }}
          >
            ESC
          </span>
        </div>

        <div
          style={{
            maxHeight: "55vh",
            overflowY: "auto",
            padding: 6,
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "#71717a",
                fontSize: "0.875rem",
              }}
            >
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((it, i) => {
              const Icon = it.icon;
              const active = i === activeIdx;
              return (
                <button
                  key={it.href}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    router.push(it.href);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: active ? "#f4f4f5" : "transparent",
                    color: "#18181b",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    textAlign: "left",
                  }}
                >
                  <Icon size={14} color="#52525b" strokeWidth={1.8} />
                  <span style={{ fontWeight: 600 }}>{it.label}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "#a1a1aa",
                      fontSize: "0.75rem",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {it.href}
                  </span>
                  {active && (
                    <CornerDownLeft
                      size={12}
                      color="#71717a"
                      strokeWidth={2}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #e4e4e7",
            display: "flex",
            justifyContent: "space-between",
            color: "#a1a1aa",
            fontSize: "0.6875rem",
            letterSpacing: "0.03em",
          }}
        >
          <span>↑ ↓ navegar · ↵ abrir</span>
          <span>{filtered.length} resultados</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
