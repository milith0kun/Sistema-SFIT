"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DashboardStyles } from "@/components/layout/DashboardStyles";
import {
  clearSession,
  getClientUser,
  getServerUser,
  subscribeUser,
  type StoredUser,
} from "@/components/layout/user-storage";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSyncExternalStore(subscribeUser, getClientUser, getServerUser);
  const unread = useUnreadCount();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cierra el sidebar móvil al navegar
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Bloquea el scroll del body cuando el sidebar móvil está abierto
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Verifica sesión y status del usuario
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("sfit_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredUser;
      if (parsed.status && parsed.status !== "activo") {
        router.replace(parsed.status === "rechazado" ? "/rejected" : "/pending");
      }
      // Onboarding obligatorio: si el perfil está incompleto o tiene password
      // temporal, forzamos al usuario a /onboarding antes de cualquier otra ruta.
      if (parsed.profileCompleted === false || parsed.mustChangePassword === true) {
        router.replace("/onboarding");
        return;
      }
      // Para admin_municipal verificamos también que su municipalidad tenga
      // los datos institucionales (RUC + razón social) registrados. Si no
      // están en localStorage los cargamos del backend una vez por sesión.
      if (parsed.role === "admin_municipal" && parsed.municipalityDataCompleted !== true) {
        const token = localStorage.getItem("sfit_access_token");
        if (!token) return;
        fetch("/api/auth/perfil", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((data: { success: boolean; data?: { municipalityDataCompleted: boolean | null } }) => {
            if (!data?.success || !data?.data) return;
            const completed = data.data.municipalityDataCompleted === true;
            // Persistimos para evitar re-fetch en próximas navegaciones.
            const updated = { ...parsed, municipalityDataCompleted: completed };
            localStorage.setItem("sfit_user", JSON.stringify(updated));
            if (!completed) router.replace("/onboarding");
          })
          .catch(() => { /* silent */ });
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div style={{ display: "flex", height: "100svh", background: "#F4F4F5", overflow: "hidden" }}>
      <DashboardStyles />

      {/* Backdrop móvil */}
      {sidebarOpen && (
        <div
          className="sfit-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(9,9,11,0.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside className={`sfit-sidebar${sidebarOpen ? " open" : ""}`}>
        <Sidebar
          user={user}
          pathname={pathname}
          unread={unread}
          onClose={() => setSidebarOpen(false)}
          onLogout={logout}
        />
      </aside>

      {/* Main shell */}
      <main className="sfit-main-shell">
        <Topbar
          user={user}
          pathname={pathname}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={logout}
        />

        <div
          className="sfit-content-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px 28px",
            maxWidth: "100%",
            background: "#FAFAFA",
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
