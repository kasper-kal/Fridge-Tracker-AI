import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const DEVICE_KEY = "fridge_device_id";
const USER_KEY = "fridge_user";

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  return `${base}${path}`;
}

export interface UserRecord {
  id: number;
  deviceId: string;
  username: string;
  isBanned: boolean;
  ipAddress?: string | null;
  createdAt?: string;
}

interface UserContextValue {
  deviceId: string;
  user: UserRecord | null;
  isRegistered: boolean;
  isBanned: boolean;
  register: (username: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  deleteCurrentUserData: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function readCachedUser(): UserRecord | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [deviceId] = useState<string>(getOrCreateDeviceId);
  const [user, setUserState] = useState<UserRecord | null>(readCachedUser);

  const saveUser = useCallback((u: UserRecord) => {
    setUserState(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        saveUser(data);
      }
    } catch { /* offline */ }
  }, [deviceId, saveUser]);

  // Always refresh on mount to get latest ban status
  useEffect(() => {
    if (readCachedUser()) {
      fetchUser();
    }
  }, []);

  const register = useCallback(async (username: string) => {
    const res = await fetch(apiUrl("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, username }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Registratie mislukt");
    }
    const data = await res.json();
    saveUser(data);
  }, [deviceId, saveUser]);

  const updateUsername = useCallback(async (username: string) => {
    const res = await fetch(apiUrl("/api/users/me"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Bijwerken mislukt");
    }
    const data = await res.json();
    saveUser(data);
  }, [deviceId, saveUser]);

  const deleteCurrentUserData = useCallback(async () => {
    const res = await fetch(apiUrl("/api/users/me"), {
      method: "DELETE",
      headers: { "x-device-id": deviceId },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Resetten mislukt");
    }
  }, [deviceId]);

  const refresh = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{
      deviceId,
      user,
      isRegistered: !!user,
      isBanned: user?.isBanned ?? false,
      register,
      updateUsername,
      deleteCurrentUserData,
      refresh,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
