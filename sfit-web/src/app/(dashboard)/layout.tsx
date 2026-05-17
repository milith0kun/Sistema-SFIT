"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useApprovalsPending } from "@/hooks/useApprovalsPending";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DashboardStyles } from "@/components/layout/DashboardStyles";
import { Toaster } from "@/components/ui/Toaster";
import { MobileOnlyScreen } from "@/components/auth/MobileOnlyScreen";
import { MOBILE_ONLY_ROLES } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";
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
  const pendingApprovals = useApprovalsPending();
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
      console.log("[dashboard-layout] no sfit_user en localStorage → /login");
      router.replace("/login");
      return;
    }
    let parsed: StoredUser;
    try {
      parsed = JSON.parse(raw) as StoredUser;
    } catch {
      console.log("[dashboard-layout] sfit_user inválido → /login");
      router.replace("/login");
      return;
    }
    console.log("[dashboard-layout] parsed user:", {
      role: parsed.role,
      status: parsed.status,
      profileCompleted: parsed.profileCompleted,
      mustChangePassword: parsed.mustChangePassword,
    });

    if (parsed.status && parsed.status !== "activo") {
      console.log("[dashboard-layout] status no activo → redirect");
      router.replace(parsed.status === "rechazado" ? "/rejected" : "/pending");
      return;
    }
    // Onboarding obligatorio: si el perfil está incompleto o tiene password
    // temporal, forzamos al usuario a /onboarding antes de cualquier otra ruta.
    if (parsed.profileCompleted === false || parsed.mustChangePassword === true) {
      console.log("[dashboard-layout] onboarding obligatorio → /onboarding");
      router.replace("/onboarding");
      return;
    }

    // Verificamos contra el backend que la sesión sigue siendo válida.
    // Si un admin cambió el rol del usuario, sessionVersion en BD avanzó y
    // /api/auth/perfil responde 401 con code SESSION_INVALIDATED → forzamos
    // logout limpio para evitar el loop login↔dashboard con JWT obsoleto.
    const token = localStorage.getItem("sfit_access_token");
    if (!token) {
      console.log("[dashboard-layout] sin access token");
      return;
    }
    fetch("/api/auth/perfil", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        console.log("[dashboard-layout] /api/auth/perfil status:", r.status);
        if (r.status === 401) {
          const body = (await r.json().catch(() => ({}))) as { code?: string };
          console.log("[dashboard-layout] 401 body:", body);
          if (body?.code === "SESSION_INVALIDATED") {
            clearSession();
            router.replace("/login?reason=role_changed");
          }
          return null;
        }
        return r.json() as Promise<{
          success: boolean;
          data?: {
            role?: string;
            municipalityDataCompleted: boolean | null;
            profileCompleted?: boolean;
          };
        }>;
      })
      .then((data) => {
        if (!data?.success || !data?.data) return;
        console.log("[dashboard-layout] perfil data:", data.data);
        // Si el rol cambió en backend pero la sesión sigue válida (caso raro:
        // sessionVersion no se incrementó), sincronizamos el cache local.
        const next: StoredUser = { ...parsed };
        if (data.data.role && data.data.role !== parsed.role) {
          next.role = data.data.role;
        }
        if (parsed.role === "admin_municipal") {
          next.municipalityDataCompleted = data.data.municipalityDataCompleted === true;
          if (!next.municipalityDataCompleted) {
            console.log("[dashboard-layout] municipalityDataCompleted=false → /onboarding");
            localStorage.setItem("sfit_user", JSON.stringify(next));
            router.replace("/onboarding");
            return;
          }
        }
        localStorage.setItem("sfit_user", JSON.stringify(next));
      })
      .catch((err) => {
        console.warn("[dashboard-layout] fetch perfil error:", err);
      });
  }, [router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  // Fiscal, operador, conductor y ciudadano operan desde la app móvil. Sólo
  // permitimos /perfil en web para que puedan ajustar sus datos básicos.
  if ((MOBILE_ONLY_ROLES as readonly string[]).includes(user.role) && pathname !== "/perfil") {
    return <MobileOnlyScreen role={user.role as Role} />;
  }

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
          pendingApprovals={pendingApprovals}
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

      {/* Cola global de toasts — se monta una vez para todo el dashboard */}
      <Toaster />
    </div>
  );
}
