"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { name: string; email: string; status: string };

/** RF-01-04: Solicitud rechazada por el administrador */
export default function RejectedPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as User;
    if (u.status === "activo")   router.replace("/dashboard");
    else if (u.status === "pendiente") router.replace("/pending");
    else setUser(u);
  }, [router]);

  function logout() {
    localStorage.removeItem("sfit_access_token");
    localStorage.removeItem("sfit_refresh_token");
    localStorage.removeItem("sfit_user");
    document.cookie = "sfit_access_token=; path=/; max-age=0";
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="text-center animate-fade-up">
      <div
        className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h1
        className="font-bold text-[#09090b] mb-4"
        style={{ fontSize: "clamp(1.5rem, 3vw, 1.875rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
      >
        Solicitud no aprobada
      </h1>
      <p className="mb-8 max-w-[400px] mx-auto" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.6 }}>
        La solicitud de acceso fue rechazada por la administración municipal. Puede comunicarse con la municipalidad correspondiente para obtener mayor información o presentar una nueva solicitud.
      </p>
      <button onClick={logout} className="btn-outline" style={{ width: "auto", padding: "0 32px" }}>
        Volver al inicio
      </button>
    </div>
  );
}
