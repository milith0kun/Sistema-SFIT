"use client";

import type { ReactNode, CSSProperties } from "react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyLabel?: ReactNode;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyLabel,
}: TableProps<T>) {
  const wrapper: CSSProperties = {
    background: "#ffffff",
    border: "1.5px solid #e4e4e7",
    borderRadius: 16,
    overflow: "hidden",
  };

  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
    fontSize: "0.875rem",
  };

  const thStyle: CSSProperties = {
    textAlign: "left",
    fontWeight: 700,
    color: "#18181b",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "12px 18px",
    background: "#f4f4f5",
    borderBottom: "1.5px solid #e4e4e7",
  };

  return (
    <div style={wrapper}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  ...thStyle,
                  textAlign: c.align ?? "left",
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "48px 18px",
                  textAlign: "center",
                  color: "#71717a",
                  fontSize: "0.9375rem",
                }}
              >
                {emptyLabel ?? "Sin registros."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fafafa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid #e4e4e7",
                      color: "#27272a",
                      textAlign: c.align ?? "left",
                      verticalAlign: "middle",
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Shadcn primitives (para nuevos componentes) ── */

function ShadTable({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function ShadTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function ShadTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function ShadTableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

function ShadTableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn("h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground", className)}
      {...props}
    />
  );
}

function ShadTableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("p-2 align-middle whitespace-nowrap", className)} {...props} />;
}

export { ShadTable, ShadTableHeader, ShadTableBody, ShadTableRow, ShadTableHead, ShadTableCell };
