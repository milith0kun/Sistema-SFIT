"use client";

import type { ReactNode } from "react";
import { Search, Download, Plus, type LucideIcon } from "lucide-react";

export interface FilterSelectOption {
  v: string;
  l: string;
}

export interface FilterSelectConfig {
  key: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  selects?: FilterSelectConfig[];
  actions?: ReactNode;
  onExportCSV?: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryIcon?: LucideIcon;
  exportLabel?: string;
}

const CHEVRON_BG =
  "#fff url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\") no-repeat right 10px center";

/**
 * Barra de filtros con input de búsqueda, selects personalizables y
 * acciones a la derecha (export CSV + botón primario negro con hover gold).
 * Generalización del `FilterBar` de `/flota`.
 */
export function FilterBar({
  searchPlaceholder = "Filtrar…",
  searchValue,
  onSearchChange,
  selects = [],
  actions,
  onExportCSV,
  onPrimary,
  primaryLabel = "Nuevo",
  primaryIcon,
  exportLabel = "Exportar CSV",
}: FilterBarProps) {
  const PrimaryIcon = primaryIcon ?? Plus;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #e4e4e7",
        borderRadius: 10,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          border: "1px solid #e4e4e7",
          borderRadius: 7,
          background: "#fafafa",
          color: "#71717a",
          fontSize: 12,
          flex: 1,
          maxWidth: 320,
          minWidth: 200,
        }}
      >
        <Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            flex: 1,
            fontSize: 12.5,
            color: "#09090b",
            minWidth: 0,
          }}
        />
      </div>

      {selects.map((s) => (
        <select
          key={s.key}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          aria-label={s.ariaLabel}
          style={{
            height: 34,
            padding: "0 28px 0 12px",
            borderRadius: 7,
            border: "1px solid #e4e4e7",
            background: CHEVRON_BG,
            color: "#09090b",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
          }}
        >
          {s.options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      ))}

      <div style={{ flex: 1 }} />

      {actions}

      {onExportCSV && (
        <button
          onClick={onExportCSV}
          type="button"
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 7,
            border: "1px solid #e4e4e7",
            background: "#fff",
            color: "#52525b",
            fontSize: 12.5,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <Download size={14} strokeWidth={1.8} /> {exportLabel}
        </button>
      )}

      {onPrimary && (
        <button
          onClick={onPrimary}
          type="button"
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 7,
            background: "#09090b",
            color: "#fff",
            border: "none",
            fontSize: 12.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            boxShadow: "inset 0 0 0 1px rgba(139,20,20,0)",
            transition: "all 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#27272a";
            e.currentTarget.style.boxShadow = "inset 3px 0 0 #8B1414";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#09090b";
            e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(139,20,20,0)";
          }}
        >
          <PrimaryIcon size={14} strokeWidth={1.8} /> {primaryLabel}
        </button>
      )}
    </div>
  );
}
