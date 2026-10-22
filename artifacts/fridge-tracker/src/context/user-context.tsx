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

interface ClerkNameSource {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string } | null;
}

/** The name Clerk already knows, used instead of asking for it a second time. */
export function clerkDisplayName(user: ClerkNameSource | null | undefined): string {
  if (!user) return "";
  const full = user.fullName?.trim();
  if (full) return full.slice(0, 32);
  const combined = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (combined) return combined.slice(0, 32);
  if (user.username?.trim()) return user.username.trim().slice(0, 32);
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.split("@")[0].slice(0, 32);
  return "";
}

interface UserContextValue {
  deviceId: string;
  user: UserRecord | null;
  isLoading: boolean;
  isRegistered: boolean;
  isBanned: boolean;
  /** A profile without a name: the app works, sharing does not. */
  isGuest: boolean;
  suggestedName: string;
  register: (username?: string) => Promise<void>;
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
  // Depend on stable primitives: Clerk hands back a new object on session
  // refreshes, and keying the fetch effect on the object would re-trigger it.
  const clerkUserId = clerkUser?.id;
  const clerkName = clerkDisplayName(clerkUser);
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
      let res: Response | null = null;

      if (clerkUserId) {
        res = await fetch(apiUrl("/api/users/me"), {
          headers: { "x-device-id": deviceId },
          credentials: "include",
        });
      } else if (cachedUser) {
        res = await fetch(apiUrl("/api/users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ deviceId, username: cachedUser.username }),
        });
      }

      if (res?.ok) {
        saveUser(await res.json());
        return;
      }

      // Signed in but this account has no profile yet: create it with the name
      // Clerk already collected, so the setup dialog never asks twice.
      if (clerkUserId && res?.status === 404) {
        const createResponse = await fetch(apiUrl("/api/users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            deviceId,
            username: clerkName || cachedUser?.username || "",
          }),
        });
        if (createResponse.ok) saveUser(await createResponse.json());
      }
    } catch { /* offline */ }
  }, [clerkUserId, clerkName, deviceId, saveUser]);

  useEffect(() => {
    if (!isClerkLoaded) return;
    let active = true;
    setIsLoading(true);
    void fetchUser().finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [fetchUser, isClerkLoaded]);

  const register = useCallback(async (username?: string) => {
    const res = await fetch(apiUrl("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ deviceId, username: (username ?? "").trim() }),
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
      isGuest: !!user && !(user.username ?? "").trim(),
      suggestedName: clerkName,
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
