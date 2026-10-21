import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useUser as useClerkUser } from "@clerk/react";

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
  householdId?: number | null;
  householdName?: string | null;
  householdIsCreator?: boolean;
}

interface UserContextValue {
  deviceId: string;
  user: UserRecord | null;
  isLoading: boolean;
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
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const [deviceId, setDeviceId] = useState<string>(getOrCreateDeviceId);
  const [user, setUserState] = useState<UserRecord | null>(readCachedUser);
  const [isLoading, setIsLoading] = useState(true);

  const saveUser = useCallback((u: UserRecord) => {
    if (u.deviceId) {
      setDeviceId((current) => {
        if (current !== u.deviceId) localStorage.setItem(DEVICE_KEY, u.deviceId);
        return u.deviceId;
      });
    }
    setUserState(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const cachedUser = readCachedUser();
      const res = clerkUser?.id
        ? await fetch(apiUrl("/api/users/me"), {
            headers: { "x-device-id": deviceId },
            credentials: "include",
          })
        : cachedUser
          ? await fetch(apiUrl("/api/users"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ deviceId, username: cachedUser.username }),
            })
          : null;

      if (res?.ok) {
        const data = await res.json();
        saveUser(data);
        return;
      }

      if (clerkUser?.id && res?.status === 404 && cachedUser) {
        const linkResponse = await fetch(apiUrl("/api/users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deviceId, username: cachedUser.username }),
        });
        if (linkResponse.ok) {
          saveUser(await linkResponse.json());
        }
      }
    } catch { /* offline */ }
  }, [clerkUser?.id, deviceId, saveUser]);

  useEffect(() => {
    if (!isClerkLoaded) return;
    let active = true;
    setIsLoading(true);
    void fetchUser().finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [fetchUser, isClerkLoaded]);

  const register = useCallback(async (username: string) => {
    const res = await fetch(apiUrl("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
      credentials: "include",
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
      credentials: "include",
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
      isLoading,
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
