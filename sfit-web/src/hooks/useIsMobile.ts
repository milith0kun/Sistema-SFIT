"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve true cuando el viewport corresponde a mobile (≤900px).
 *
 * Reactivo: se actualiza al resize/rotate del dispositivo. Se inicializa
 * en false para mantener consistencia con SSR — se hidrata al valor real
 * en el primer effect.
 *
 * Breakpoint 900px alineado con .notif-grid / .aprobaciones-grid /
 * .red-nacional-grid donde la columna desktop colapsa.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
