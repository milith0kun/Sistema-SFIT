/**
 * Estilos del shell del dashboard (sidebar flotante, topbar, scrollbars).
 *
 * Se inyectan inline porque dependen del color primario `#6C0606` y
 * no se pueden derivar limpiamente desde Tailwind v4 sin perder el
 * comportamiento responsive específico (sidebar mobile slide-in vs
 * desktop sticky-card).
 */
export function DashboardStyles() {
  return (
    <style>{`
      .sfit-sidebar {
        /* Mobile: drawer con margen vertical para que las esquinas
           redondeadas y el borde rojo se aprecien (no edge-to-edge). */
        position: fixed;
        top: 12px; left: 0; bottom: 12px;
        width: min(300px, 86vw);
        max-width: 300px;
        z-index: 50;
        transform: translateX(calc(-100% - 14px));
        transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        background: #0A1628;
        /* Sólo esquinas derechas redondeadas, drawer pegado al borde izq */
        border-top-right-radius: 18px;
        border-bottom-right-radius: 18px;
        border: 1px solid rgba(139, 20, 20, 0.22);
        border-left: none;
        overflow: hidden;
        box-shadow: 0 0 0 transparent;
      }
      .sfit-sidebar.open {
        transform: translateX(0);
        /* Elevación pronunciada cuando está abierto */
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          0 0 0 1px rgba(139, 20, 20, 0.18),
          0 16px 32px rgba(9, 22, 40, 0.45),
          0 36px 64px rgba(9, 22, 40, 0.32);
      }
      @media (min-width: 1024px) {
        .sfit-sidebar {
          /* Desktop: tarjeta flotante con margen, redondeo y elevación */
          position: sticky !important; top: 12px !important;
          margin: 12px !important;
          height: calc(100svh - 24px) !important;
          width: 282px !important;
          transform: translateX(0) !important;
          display: flex !important; flex-shrink: 0;
          border-radius: 18px;
          border-top-right-radius: 18px;
          border-bottom-right-radius: 18px;
          border: 1px solid rgba(139, 20, 20, 0.18);
          border-right: 1px solid rgba(139, 20, 20, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 4px 12px rgba(9, 22, 40, 0.10),
            0 14px 32px rgba(9, 22, 40, 0.10);
        }
        .sfit-sidebar-backdrop { display: none !important; }
        .sfit-hamburger { display: none !important; }
      }

      /* ── Main shell — tarjeta flotante (mismo lenguaje del sidebar) ── */
      .sfit-main-shell {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
        position: relative;
        background: #FAFAFA;
      }
      @media (min-width: 1024px) {
        .sfit-main-shell {
          margin: 12px 12px 12px 0;
          border-radius: 18px;
          border: 1px solid #E4E4E7;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 4px 12px rgba(9, 22, 40, 0.05),
            0 14px 32px rgba(9, 22, 40, 0.06);
          height: calc(100svh - 24px);
        }
      }

      /* ── Content scroll ── */
      .sfit-content-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(108, 6, 6, 0.22) transparent;
        scrollbar-gutter: stable;
        scroll-behavior: smooth;
      }
      .sfit-content-scroll::-webkit-scrollbar { width: 8px; }
      .sfit-content-scroll::-webkit-scrollbar-track { background: transparent; }
      .sfit-content-scroll::-webkit-scrollbar-thumb {
        background: rgba(108, 6, 6, 0.22);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
        transition: background-color 160ms ease;
      }
      .sfit-content-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(108, 6, 6, 0.45);
        background-clip: padding-box;
      }

      /* ── Sidebar nav scroll ── */
      .sfit-sidebar-nav {
        scrollbar-width: thin;
        scrollbar-color: rgba(139, 20, 20, 0.22) transparent;
        scrollbar-gutter: stable;
      }
      .sfit-sidebar-nav::-webkit-scrollbar { width: 6px; }
      .sfit-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
      .sfit-sidebar-nav::-webkit-scrollbar-thumb {
        background: rgba(139, 20, 20, 0.22);
        border-radius: 999px;
        transition: background 160ms ease;
      }
      .sfit-sidebar-nav::-webkit-scrollbar-thumb:hover {
        background: rgba(139, 20, 20, 0.45);
      }
      /* Sombras superior/inferior cuando hay overflow */
      .sfit-sidebar-nav {
        background:
          linear-gradient(#0A1628 30%, transparent),
          linear-gradient(transparent, #0A1628 70%) bottom,
          radial-gradient(farthest-side at 50% 0, rgba(139, 20, 20, 0.10), transparent),
          radial-gradient(farthest-side at 50% 100%, rgba(139, 20, 20, 0.10), transparent) bottom;
        background-repeat: no-repeat;
        background-size: 100% 16px, 100% 16px, 100% 6px, 100% 6px;
        background-attachment: local, local, scroll, scroll;
      }

      /* ── Hidden mobile helper ── */
      .hidden-mobile { display: flex; }
      @media (max-width: 640px) {
        .hidden-mobile { display: none !important; }
      }

      /* ── Breadcrumb visibility ── */
      .sfit-breadcrumb-mobile { display: none; }
      @media (max-width: 640px) {
        .sfit-breadcrumb-mobile { display: inline-block; }
      }

      .sfit-crumb-root {
        font-family: var(--font-inter, system-ui);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #71717A;
        text-decoration: none;
        padding: 4px 6px;
        border-radius: 6px;
        transition: color 140ms ease, background 140ms ease;
        flex-shrink: 0;
      }
      .sfit-crumb-root:hover { color: #09090B; background: #F4F4F5; }
      .sfit-crumb-root:focus-visible {
        outline: 2px solid #6C0606; outline-offset: 2px;
      }

      .sfit-crumb-sep {
        color: #D4D4D8;
        font-weight: 400;
        font-size: 0.875rem;
        user-select: none;
        flex-shrink: 0;
      }

      .sfit-crumb-link {
        font-size: 0.875rem;
        font-weight: 500;
        color: #71717A;
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 6px;
        transition: color 140ms ease, background 140ms ease;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
      .sfit-crumb-link:hover { color: #09090B; background: #F4F4F5; }
      .sfit-crumb-link:focus-visible {
        outline: 2px solid #6C0606; outline-offset: 2px;
      }

      .sfit-crumb-mute {
        font-size: 0.875rem;
        font-weight: 500;
        color: #A1A1AA;
        padding: 4px 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }

      .sfit-crumb-current {
        font-size: 0.9375rem;
        font-weight: 700;
        color: #09090B;
        padding: 4px 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 280px;
      }

      /* ── Sidebar nav links ── */
      .sfit-sidebar-link:hover:not([data-active]) {
        background: rgba(255, 255, 255, 0.05) !important;
        color: rgba(255, 255, 255, 0.92) !important;
      }
      .sfit-sidebar-link:focus-visible {
        outline: 2px solid #8B1414;
        outline-offset: -2px;
      }

      /* ── Sidebar user info (avatar card + role pill) — desktop only ──
         En mobile esta info ya está en el dropdown del Topbar.
         Ocultarla aquí libera ~110px verticales para que se vean más
         opciones del nav sin scrollear. */
      .sfit-sidebar-user-info { display: block; }
      @media (max-width: 1023px) {
        .sfit-sidebar-user-info { display: none !important; }
      }

      /* ── Sidebar logout button ── */
      .sfit-sidebar-logout {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 9px 12px;
        border-radius: 8px;
        width: 100%;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.55);
        font-family: inherit;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
        text-align: left;
      }
      .sfit-sidebar-logout:hover {
        background: rgba(220, 38, 38, 0.12);
        color: #FCA5A5;
      }
      .sfit-sidebar-logout:focus-visible {
        outline: 2px solid #FCA5A5;
        outline-offset: -2px;
      }

      /* ── Topbar hover states ── */
      .sfit-topbar {
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .sfit-hamburger:hover {
        background: #1a2940 !important;
        transform: scale(1.04);
      }
      .sfit-hamburger:active {
        transform: scale(0.96);
      }
      .sfit-hamburger:focus-visible {
        outline: 2px solid #6C0606;
        outline-offset: 2px;
      }
      .sfit-topbar-back:hover {
        background: #F4F4F5 !important;
        transform: scale(1.04);
      }
      .sfit-topbar-back:active {
        transform: scale(0.96);
      }
      .sfit-topbar-back:focus-visible {
        outline: 2px solid #6C0606;
        outline-offset: 2px;
      }
      .sfit-search-btn:hover {
        border-color: #D4D4D8 !important;
        color: #09090B !important;
        background: #F4F4F5 !important;
      }
      .sfit-search-btn:focus-visible {
        outline: 2px solid #6C0606;
        outline-offset: 2px;
      }

      /* ── User pill hover ── */
      .sfit-user-pill:hover {
        background: #FAFAFA !important;
        border-color: #6C060644 !important;
      }
      .sfit-user-pill:focus-visible {
        outline: 2px solid #6C0606;
        outline-offset: 2px;
      }

      /* ── Hero shimmer line ── */
      .sfit-hero-shimmer {
        animation: heroShimmer 4s ease-in-out infinite;
      }
      @keyframes heroShimmer {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      /* ── Hero responsive ── */
      @media (max-width: 640px) {
        .sfit-hero { padding: 16px 18px !important; border-radius: 12px !important; }
        .sfit-hero h1 { font-size: 1.125rem !important; }
      }

      /* ── KPI card hover ── */
      .sfit-kpi-card {
        transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
      }
      .sfit-kpi-card:hover {
        border-color: #D9B0B0 !important;
        box-shadow: 0 4px 14px rgba(108, 6, 6, 0.06);
        transform: translateY(-1px);
      }

      /* ── User dropdown animation ── */
      .sfit-user-dropdown {
        animation: dropdownIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes dropdownIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  );
}
