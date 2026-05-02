"use client";

import { useEffect } from "react";

/**
 * Cierra un overlay mobile cuando el usuario presiona "atrás" en el navegador
 * o en el dispositivo, en lugar de salir de la página completa.
 *
 * Patrón: cuando `open` se vuelve true (overlay abierto en mobile), pusheamos
 * una entrada al history. Si el usuario presiona "atrás", popstate dispara y
 * llamamos a `onClose`. Si el overlay se cierra de otra forma (botón interno,
 * etc.), el cleanup hace `history.back()` para limpiar la entrada que pusheamos.
 *
 * Sólo aplica en mobile (≤900px) porque en desktop los overlays no se muestran.
 *
 * @param open      - estado del overlay (true cuando está visible)
 * @param onClose   - callback para cerrar el overlay (set state a null/false)
 * @param marker    - identificador único para el state pusheado (evita
 *                    colisiones si hay múltiples overlays anidados)
 */
export function useMobileOverlayBack(
  open: boolean,
  onClose: () => void,
  marker: string
) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    // El overlay sólo se renderiza en mobile (CSS @media max-width: 900px).
    // Si estamos en desktop no hace falta el manejo de history.
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) return;

    // Pusheamos un state extra; el browser back lo consumirá primero.
    window.history.pushState({ sfitOverlay: marker }, "");

    const onPopState = () => {
      onClose();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Si el overlay se cerró por motivo distinto a popstate (ej: el usuario
      // tocó el botón "back" interno del overlay), nuestro state pusheado
      // sigue en el history — lo removemos con history.back() para no dejar
      // una entrada zombie. Si ya fue popeada por el browser, la condición
      // de abajo es false y no hacemos nada.
      const state = window.history.state as { sfitOverlay?: string } | null;
      if (state?.sfitOverlay === marker) {
        window.history.back();
      }
    };
  }, [open, onClose, marker]);
}
