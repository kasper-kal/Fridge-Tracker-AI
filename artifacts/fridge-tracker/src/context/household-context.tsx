import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useUser } from "@/context/user-context";

const STORAGE_KEY = "fridge_tracker_household";

export interface Household {
  id: number;
  name: string;
  pin?: string;
  isCreator?: boolean;
}

interface HouseholdContextValue {
  household: Household | null;
  setHousehold: (h: Household | null) => void;
  leave: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

function readStorage(): Household | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, deviceId } = useUser();
  const [household, setHouseholdState] = useState<Household | null>(() => readStorage());

  const setHousehold = useCallback((h: Household | null) => {
    setHouseholdState(h);
    if (h) localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!user || user.householdId === undefined) return;
    if (user.householdId === null) {
      setHousehold(null);
      return;
    }
    if (user.householdName) {
      setHousehold({
        id: user.householdId,
        name: user.householdName,
        isCreator: user.householdIsCreator,
      });
    }
  }, [user?.householdId, user?.householdName, user?.householdIsCreator, setHousehold]);

  const leave = useCallback(async () => {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
    const response = await fetch(`${apiBase}/api/users/me/household`, {
      method: "DELETE",
      headers: { "x-device-id": deviceId },
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Huishouden verlaten mislukt");
    }
    setHousehold(null);
  }, [deviceId, setHousehold]);

  return (
    <HouseholdContext.Provider value={{ household, setHousehold, leave }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used inside <HouseholdProvider>");
  return ctx;
}
