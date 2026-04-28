"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { name: string; email: string; status: string };

/** RF-01-03: Solicitud pendiente de aprobación */
export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as User;
    if (u.status === "activo")    router.replace("/dashboard");
    else if (u.status === "rechazado") router.replace("/rejected");
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
        style={{ background: "#FBEAEA", border: "1.5px solid #D9B0B0" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6C0606" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h1
        className="font-bold text-[#09090b] mb-4"
        style={{ fontSize: "clamp(1.5rem, 3vw, 1.875rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
      >
        Solicitud en revisión
      </h1>
      <p className="mb-2" style={{ color: "#3F3F46", fontSize: "0.9375rem", lineHeight: 1.55, fontWeight: 500 }}>
        Usuario: <strong>{user.name}</strong>
      </p>
      <p className="mb-8 max-w-[400px] mx-auto" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.6 }}>
        La solicitud de acceso se encuentra en proceso de evaluación por la administración municipal. Recibirá una notificación por correo electrónico una vez que la solicitud sea resuelta.
      </p>
      <button onClick={logout} className="btn-outline" style={{ width: "auto", padding: "0 32px" }}>
        Cerrar sesión
      </button>
    </div>
  );
}
