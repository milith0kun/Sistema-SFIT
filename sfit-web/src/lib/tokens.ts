/**
 * SFIT Design Tokens
 *
 * Espejo TypeScript de los CSS custom properties definidos en
 * `src/app/globals.css` y de los tokens Flutter en
 * `sfit-app/lib/core/theme/{app_colors,app_spacing,app_radius,app_breakpoints}.dart`.
 *
 * Importar desde aquí para mantener el sistema sincronizado:
 *   import { spacing, radius, breakpoints, palette } from "@/lib/tokens";
 */

/** Spacing scale — grid de 4px. Coincide con `--space-N` y `AppSpacing`. */
export const spacing = {
  none: 0,
  xs:   4,   // --space-1
  sm:   8,   // --space-2
  md:  12,   // --space-3
  base:16,   // --space-4
  lg:  20,   // --space-5
  xl:  24,   // --space-6
  "2xl": 32, // --space-8
  "3xl": 40, // --space-10
  "4xl": 48, // --space-12
  "5xl": 64, // --space-16
  "6xl": 80, // --space-20
  "7xl": 96, // --space-24
} as const;

export type SpacingKey = keyof typeof spacing;

/** Radius scale — coincide con `--radius-*` y `AppRadius`. */
export const radius = {
  xs:    6,
  sm:    8,
  md:   10,
  lg:   12,
  xl:   16,
  "2xl":24,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;

/** Breakpoints unificados. Espejo de `--bp-*` y `AppBreakpoints`. */
export const breakpoints = {
  mobileSm: 375,
  mobileLg: 425,
  tablet:   768,
  desktop: 1024,
  wide:    1280,
  xl:      1440,
} as const;

export type BreakpointKey = keyof typeof breakpoints;

/** Media query helpers (mobile-first). */
export const mq = {
  tabletUp:  `(min-width: ${breakpoints.tablet}px)`,
  desktopUp: `(min-width: ${breakpoints.desktop}px)`,
  wideUp:    `(min-width: ${breakpoints.wide}px)`,
  xlUp:      `(min-width: ${breakpoints.xl}px)`,
  mobileOnly: `(max-width: ${breakpoints.tablet - 1}px)`,
} as const;

/** Paleta institucional — coincide con `AppColors`. */
export const palette = {
  primary:        "#6C0606",
  primaryLight:   "#8B1414",
  primaryDark:    "#4A0303",
  primaryBg:      "#FBEAEA",
  primaryBorder:  "#D9B0B0",

  ink:   "#09090b",
  ink9:  "#18181b",
  ink8:  "#27272a",
  ink7:  "#3f3f46",
  ink6:  "#52525b",
  ink5:  "#71717a",
  ink4:  "#a1a1aa",
  ink3:  "#d4d4d8",
  ink2:  "#e4e4e7",
  ink1:  "#f4f4f5",
  paper: "#fafafa",
  white: "#ffffff",

  panel:      "#0A1628",
  panelMid:   "#111F38",
  panelLight: "#1A2D4A",

  apto:   "#15803d",
  riesgo: "#b45309",
  noApto: "#DC2626",
  info:   "#1D4ED8",
} as const;

export type PaletteKey = keyof typeof palette;

/** Sombras canónicas. */
export const shadow = {
  none: "none",
  sm:   "0 1px 2px rgba(9, 9, 11, 0.04)",
  md:   "0 2px 8px rgba(9, 9, 11, 0.06)",
  lg:   "0 8px 24px rgba(9, 9, 11, 0.08)",
  xl:   "0 16px 40px rgba(9, 9, 11, 0.10)",
  ringPrimary: "0 0 0 3px rgba(108, 6, 6, 0.18)",
} as const;

export type ShadowKey = keyof typeof shadow;
