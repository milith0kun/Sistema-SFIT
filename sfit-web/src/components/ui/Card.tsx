import type { HTMLAttributes, CSSProperties } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  accent?: "gold" | "default";
}

/**
 * Contenedor blanco con border 1.5px #e4e4e7, radius 2xl, padding 6.
 */
export function Card({
  padded = true,
  accent = "default",
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  const base: CSSProperties = {
    background: accent === "gold" ? "#FDF8EC" : "#ffffff",
    border: accent === "gold" ? "1.5px solid #E8D090" : "1.5px solid #e4e4e7",
    borderRadius: 16,
    padding: padded ? "1.5rem" : 0,
    ...style,
  };
  return (
    <div className={className} style={base} {...props}>
      {children}
    </div>
  );
}
