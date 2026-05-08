/**
 * Design tokens centralizados para las páginas legacy del dashboard.
 *
 * Las pantallas históricas redefinen estos colores en cada `page.tsx`
 * (`const INK1 = "#f4f4f5"; const INK2 = ...`), generando ~350 líneas
 * de duplicación. Este módulo es la fuente única; cuando se migra una
 * página, basta con importar los colores que use:
 *
 *     import { INK1, INK2, INK9, RED, REDBG, REDBD } from "@/lib/design-tokens";
 *
 * Los objetos `style` (FIELD, LABEL_S, BTN_PRIMARY) NO se centralizan
 * aún porque varían por contexto (alturas distintas en formularios densos
 * vs perfiles). Cada página los sigue definiendo localmente — pero ya
 * con los colores importados de aquí.
 *
 * Estos hex se mantienen idénticos a los redefinidos en las páginas;
 * cualquier cambio requiere QA visual ligero.
 */

// ── Escala de gris (ink) ─────────────────────────────────────────────
export const INK1 = "#f4f4f5";
export const INK2 = "#e4e4e7";
export const INK3 = "#d4d4d8";
export const INK5 = "#71717a";
export const INK6 = "#52525b";
export const INK7 = "#3f3f46";
export const INK9 = "#18181b";

// ── Estado: error / rechazo ──────────────────────────────────────────
export const RED   = "#DC2626";
export const REDBG = "#FFF5F5";
export const REDBD = "#FCA5A5";

// ── Estado: éxito / aprobado ─────────────────────────────────────────
export const GRN   = "#15803d";
export const GRNBG = "#F0FDF4";
export const GRNBD = "#86EFAC";

// ── Marca dorada / institucional (alias semánticos) ──────────────────
// "GOLD" institucional histórico (perfil): rojo oscuro #4A0303 sobre #FBEAEA.
// "GOLD" de catálogo (otras pantallas): amarillo #B8860B sobre #FDF8EC.
// Se exportan ambas variantes para no romper la apariencia existente.
export const GOLD_RED        = "#4A0303";
export const GOLD_RED_BG     = "#FBEAEA";
export const GOLD_RED_BD     = "#D9B0B0";

export const GOLD_AMBER      = "#B8860B";
export const GOLD_AMBER_BG   = "#FDF8EC";
export const GOLD_AMBER_BD   = "#E8D090";

// ── Estado: alerta / pendiente ───────────────────────────────────────
export const AMBER       = "#92400e";
export const AMBER_BG    = "#FFFBEB";
export const AMBER_BD    = "#FDE68A";

// ── Estado: información ──────────────────────────────────────────────
export const INFO        = "#1D4ED8";
export const INFO_BG     = "#EFF6FF";
export const INFO_BD     = "#BFDBFE";
