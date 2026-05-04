import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Skeleton minimal (shadcn-style). Para casos puntuales con tailwind. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

/* ──────────────────────────────────────────────────────────────────────────
   Variantes con shimmer + dimensiones predefinidas, para reemplazar los
   `<div className="skeleton-shimmer">` ad-hoc en las páginas del dashboard.
   La animación viene de globals.css `.skeleton-shimmer`.
   ──────────────────────────────────────────────────────────────────────── */

type SkeletonVariant = "card" | "row" | "text" | "circle" | "image" | "rect";

interface SkeletonBlockProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  count?: number;
  gap?: number;
  borderRadius?: number | string;
  style?: CSSProperties;
  className?: string;
}

const VARIANT_DEFAULTS: Record<SkeletonVariant, { height: number | string; borderRadius: number | string }> = {
  card:   { height: 96,  borderRadius: 12 },
  row:    { height: 56,  borderRadius: 10 },
  text:   { height: 14,  borderRadius: 6 },
  circle: { height: 40,  borderRadius: "50%" },
  image:  { height: 160, borderRadius: 12 },
  rect:   { height: 100, borderRadius: 8 },
};

export function SkeletonBlock({
  variant = "rect",
  width = "100%",
  height,
  count = 1,
  gap = 8,
  borderRadius,
  style,
  className,
}: SkeletonBlockProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const finalHeight = height ?? defaults.height;
  const finalBorderRadius = borderRadius ?? defaults.borderRadius;
  const finalWidth = variant === "circle" ? finalHeight : width;

  const block = (key?: number) => (
    <div
      key={key}
      className={`skeleton-shimmer ${className ?? ""}`}
      style={{ width: finalWidth, height: finalHeight, borderRadius: finalBorderRadius, ...style }}
    />
  );

  if (count === 1) return block();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, i) => block(i))}
    </div>
  );
}

/**
 * Wrapper condicional: muestra `fallback` mientras `loading` es true; si no
 * renderiza `children`. Reemplaza el patrón `{loading ? <X/> : content}`.
 */
export function SkeletonGroup({
  loading,
  children,
  fallback,
}: {
  loading: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (loading) {
    return <>{fallback ?? <SkeletonBlock variant="card" count={3} />}</>;
  }
  return <>{children}</>;
}
