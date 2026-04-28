"use client";

import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";

export type { ColumnDef };

const C = {
  border:  "#e4e4e7",
  border1: "#f0f0f1",
  bg:      "#F8F9FA",
  hover:   "#FAFAFA",
  text:    "#18181b",
  muted:   "#71717a",
  dim:     "#52525b",
  gold:    "#B8860B",
  goldBg:  "#FDF8EC",
  goldDk:  "#926A09",
} as const;

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultPageSize?: number;
  showColumnToggle?: boolean;
  toolbarEnd?: React.ReactNode;
  onRowClick?: (row: TData) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc")  return <ChevronUp   size={11} />;
  if (sorted === "desc") return <ChevronDown  size={11} />;
  return <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />;
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  searchPlaceholder = "Buscar...",
  emptyTitle = "Sin resultados",
  emptyDescription = "No se encontraron registros.",
  defaultPageSize = 20,
  showColumnToggle = false,
  toolbarEnd,
  onRowClick,
}: DataTableProps<TData>) {
  const [sorting, setSorting]         = useState<SortingState>([]);
  const [visibility, setVisibility]   = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [showColMenu, setShowColMenu] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: visibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
    globalFilterFn: "includesString",
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const to   = Math.min(pageIndex * pageSize + pageSize, totalFiltered);
  const totalPages = table.getPageCount();

  // Smart page window (up to 5 page buttons)
  function pageWindow(): number[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i);
    if (pageIndex < 3)   return [0, 1, 2, 3, 4];
    if (pageIndex > totalPages - 3) return Array.from({ length: 5 }, (_, i) => totalPages - 5 + i);
    return [pageIndex - 2, pageIndex - 1, pageIndex, pageIndex + 1, pageIndex + 2];
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`,
    background: "#fff", color: C.dim, cursor: "pointer", fontFamily: "inherit",
    fontSize: "0.8125rem", fontWeight: 600, transition: "all 0.15s",
  };

  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.border}`,
      borderRadius: 14, overflow: "hidden",
    }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "13px 18px", borderBottom: `1px solid ${C.border}`,
        flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
          <Search size={13} style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)", color: C.muted, pointerEvents: "none",
          }} />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: "100%", height: 34,
              padding: "0 12px 0 30px",
              border: `1.5px solid ${C.border}`,
              borderRadius: 8, fontSize: "0.8125rem",
              fontFamily: "inherit", color: C.text, outline: "none",
              background: "#fff", transition: "border-color 0.15s",
            }}
            onFocus={(e)  => { e.currentTarget.style.borderColor = C.gold; }}
            onBlur={(e)   => { e.currentTarget.style.borderColor = C.border; }}
          />
        </div>

        {/* Extra toolbar content (filters, actions) */}
        {toolbarEnd}

        {/* Column visibility */}
        {showColumnToggle && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowColMenu((v) => !v)}
              style={{ ...btnBase, gap: 6, padding: "0 12px" }}
            >
              <SlidersHorizontal size={13} />
              Columnas
            </button>
            {showColMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
                background: "#fff", border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "6px 0", minWidth: 190,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}>
                {table.getAllColumns()
                  .filter((c) => {
                    if (!c.getCanHide()) return false;
                    // Ocultar columnas auxiliares sin etiqueta visible
                    // (p. ej. chevron de navegación con header vacío o id que empieza con "_").
                    const h = c.columnDef.header;
                    if (typeof h === "string" && h.trim() === "") return false;
                    if (c.id.startsWith("_")) return false;
                    return true;
                  })
                  .map((c) => (
                    <label key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 14px", cursor: "pointer",
                      fontSize: "0.8125rem", fontWeight: 500, color: C.text,
                    }}>
                      <input
                        type="checkbox"
                        checked={c.getIsVisible()}
                        onChange={(e) => c.toggleVisibility(e.target.checked)}
                        style={{ cursor: "pointer", accentColor: C.gold }}
                      />
                      {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                    </label>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted  = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      colSpan={h.colSpan}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      style={{
                        textAlign: "left", padding: "10px 16px",
                        fontSize: "0.6875rem", fontWeight: 700,
                        letterSpacing: "0.09em", textTransform: "uppercase",
                        color: sorted ? C.gold : C.muted,
                        background: C.bg,
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: "nowrap",
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        transition: "color 0.15s",
                      }}
                    >
                      {h.isPlaceholder ? null : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {canSort && <SortIcon sorted={sorted} />}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading ? (
              /* Skeleton rows */
              Array.from({ length: 7 }).map((_, ri) => (
                <tr key={ri}>
                  {columns.map((_, ci) => (
                    <td key={ci} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border1}` }}>
                      <div className="skeleton-shimmer" style={{
                        height: 13, borderRadius: 6,
                        width: `${50 + ((ri * 3 + ci * 7) % 40)}%`,
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: "72px 24px", textAlign: "center" }}>
                  <Inbox
                    size={36}
                    style={{ margin: "0 auto 14px", display: "block", color: C.border, strokeWidth: 1.5 }}
                  />
                  <div style={{ fontWeight: 700, color: C.text, fontSize: "0.9375rem" }}>{emptyTitle}</div>
                  <div style={{ fontSize: "0.8125rem", color: C.muted, marginTop: 5 }}>{emptyDescription}</div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{
                    borderBottom: `1px solid ${C.border1}`,
                    transition: "background 0.1s",
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = onRowClick ? C.goldBg : C.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: "12px 16px", color: C.text, verticalAlign: "middle" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ── */}
      {!loading && totalFiltered > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 18px", borderTop: `1px solid ${C.border1}`,
          fontSize: "0.8125rem", color: C.muted, flexWrap: "wrap", gap: 8,
        }}>
          {/* Count + page size */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>
              {from}–{to} de <strong style={{ color: C.text }}>{totalFiltered}</strong>
            </span>
            <select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              style={{
                height: 28, padding: "0 6px",
                borderRadius: 7, border: `1.5px solid ${C.border}`,
                fontSize: "0.8125rem", fontFamily: "inherit",
                background: "#fff", color: C.dim, cursor: "pointer",
              }}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / pág</option>)}
            </select>
          </div>

          {/* Page buttons */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Prev */}
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                style={{
                  ...btnBase, width: 32,
                  opacity: table.getCanPreviousPage() ? 1 : 0.35,
                  cursor: table.getCanPreviousPage() ? "pointer" : "not-allowed",
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {pageWindow().map((pn) => (
                <button
                  key={pn}
                  onClick={() => table.setPageIndex(pn)}
                  style={{
                    ...btnBase, minWidth: 32, padding: "0 6px",
                    border: pageIndex === pn ? `1.5px solid ${C.gold}` : `1.5px solid ${C.border}`,
                    background: pageIndex === pn ? C.goldBg : "#fff",
                    color: pageIndex === pn ? C.goldDk : C.dim,
                    fontWeight: pageIndex === pn ? 700 : 500,
                  }}
                >
                  {pn + 1}
                </button>
              ))}

              {/* Next */}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                style={{
                  ...btnBase, width: 32,
                  opacity: table.getCanNextPage() ? 1 : 0.35,
                  cursor: table.getCanNextPage() ? "pointer" : "not-allowed",
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
