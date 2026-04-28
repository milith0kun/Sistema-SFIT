"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "approve";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const SIZES: Record<Size, { height: string; padX: string; fontSize: string }> = {
  sm: { height: "34px", padX: "12px", fontSize: "0.8125rem" },
  md: { height: "42px", padX: "18px", fontSize: "0.9375rem" },
  lg: { height: "52px", padX: "24px", fontSize: "1rem" },
};

function variantStyles(variant: Variant): CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "#B8860B", color: "#ffffff", border: "1.5px solid #B8860B" };
    case "secondary":
      return { background: "#ffffff", color: "#09090b", border: "1.5px solid #09090b" };
    case "outline":
      return { background: "#ffffff", color: "#18181b", border: "1.5px solid #e4e4e7" };
    case "ghost":
      return { background: "transparent", color: "#52525b", border: "1.5px solid transparent" };
    case "danger":
      return { background: "#b91c1c", color: "#ffffff", border: "1.5px solid #b91c1c" };
    case "approve":
      return { background: "#15803d", color: "#ffffff", border: "1.5px solid #15803d" };
  }
}

function hoverStyles(variant: Variant): CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "#926A09", borderColor: "#926A09" };
    case "secondary":
      return { background: "#18181b", color: "#ffffff" };
    case "outline":
      return { background: "#f4f4f5", borderColor: "#a1a1aa" };
    case "ghost":
      return { background: "#f4f4f5" };
    case "danger":
      return { background: "#991b1b", borderColor: "#991b1b" };
    case "approve":
      return { background: "#166534", borderColor: "#166534" };
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      style,
      children,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const sz = SIZES[size];
    const base: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: sz.height,
      padding: `0 ${sz.padX}`,
      borderRadius: 10,
      fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
      fontWeight: 600,
      fontSize: sz.fontSize,
      letterSpacing: "-0.005em",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      opacity: disabled || loading ? 0.55 : 1,
      transition:
        "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.1s ease",
      textDecoration: "none",
      whiteSpace: "nowrap",
      ...variantStyles(variant),
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={className}
        style={base}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            const hov = hoverStyles(variant);
            Object.assign(e.currentTarget.style, hov);
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            const normal = variantStyles(variant);
            Object.assign(e.currentTarget.style, normal);
          }
          onMouseLeave?.(e);
        }}
        {...props}
      >
        {loading && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: "spin 0.65s linear infinite" }}
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
