export type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
  status?: string;
  profileCompleted?: boolean;
  mustChangePassword?: boolean;
  // Para admin_municipal: indica si su municipalidad ya tiene los datos
  // institucionales (RUC + razón social) registrados. El layout consulta
  // /api/auth/perfil y persiste el flag aquí para evitar re-fetch.
  municipalityDataCompleted?: boolean;
};

let __lastRawUser: string | null = null;
let __lastParsedUser: StoredUser | null = null;

export function subscribeUser(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === "sfit_user" || e.key === null) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function getClientUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sfit_user");
  if (raw === __lastRawUser) return __lastParsedUser;
  __lastRawUser = raw;
  try {
    __lastParsedUser = raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    __lastParsedUser = null;
  }
  return __lastParsedUser;
}

export function getServerUser(): StoredUser | null {
  return null;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.clear();
  document.cookie = "sfit_access_token=; path=/; max-age=0";
}
