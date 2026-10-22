import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useHousehold } from "@/context/household-context";

const HISTORY_LIMIT = 50;
const POLL_INTERVAL_MS = 10_000;

function storageKey(householdId?: number) {
  return householdId ? `fridge_tracker_v1_hh_${householdId}` : "fridge_tracker_v1";
}

export interface LocalProduct {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  storageLocation: "fridge" | "freezer" | "pantry";
  createdAt: string;
}

interface CreateInput {
  name: string;
  quantity: number;
  unit: string;
  storageLocation: "fridge" | "freezer" | "pantry";
}

interface UpdateInput {
  name?: string;
  quantity?: number;
  unit?: string;
  storageLocation?: "fridge" | "freezer" | "pantry";
}

interface ProductsContextValue {
  products: LocalProduct[];
  isLoading: boolean;
  fridgeProducts: LocalProduct[];
  freezerProducts: LocalProduct[];
  pantryProducts: LocalProduct[];
  summary: { fridge: number; freezer: number; pantry: number; total: number };
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  refetch: () => Promise<void>;
  createProduct: (data: CreateInput) => Promise<number>;
  updateProduct: (id: number, data: UpdateInput) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

function readStorage(key: string): LocalProduct[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as LocalProduct[];
  } catch { return []; }
}

function writeStorage(key: string, products: LocalProduct[]) {
  try { localStorage.setItem(key, JSON.stringify(products)); } catch {}
}

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  return `${base}${path}`;
}

async function apiFetch(path: string, householdId: number | undefined, options?: RequestInit) {
  const url = new URL(apiUrl(path), window.location.href);
  if (householdId) url.searchParams.set("householdId", String(householdId));
  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id;
  const key = storageKey(householdId);

  const [products, setProductsRaw] = useState<LocalProduct[]>(() => readStorage(key));
  const [isLoading, setIsLoading] = useState(true);

  const past   = useRef<LocalProduct[][]>([]);
  const future = useRef<LocalProduct[][]>([]);

  const prevHouseholdId = useRef(householdId);
  useEffect(() => {
    if (prevHouseholdId.current !== householdId) {
      prevHouseholdId.current = householdId;
      past.current = [];
      future.current = [];
      setProductsRaw(readStorage(storageKey(householdId)));
      setIsLoading(true);
    }
  }, [householdId]);

  const setProducts = useCallback((
    updater: LocalProduct[] | ((prev: LocalProduct[]) => LocalProduct[]),
    recordHistory = true,
  ) => {
    setProductsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeStorage(storageKey(householdId), next);
      if (recordHistory) {
        past.current = [...past.current.slice(-HISTORY_LIMIT + 1), prev];
        future.current = [];
      }
      return next;
    });
  }, [householdId]);

  const [, setHistoryVersion] = useState(0);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setProductsRaw((current) => {
      const prev = past.current[past.current.length - 1];
      past.current = past.current.slice(0, -1);
      future.current = [current, ...future.current.slice(0, HISTORY_LIMIT - 1)];
      writeStorage(storageKey(householdId), prev);
      setHistoryVersion((v) => v + 1);
      return prev;
    });
  }, [householdId]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setProductsRaw((current) => {
      const next = future.current[0];
      future.current = future.current.slice(1);
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), current];
      writeStorage(storageKey(householdId), next);
      setHistoryVersion((v) => v + 1);
      return next;
    });
  }, [householdId]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  const applyServerData = useCallback((data: LocalProduct[]) => {
    if (!Array.isArray(data)) return;
    setProductsRaw((current) => {
      // Products still waiting to reach the server (offline, or the request was
      // rejected) have a negative id. A successful poll must not delete them.
      const pending = current.filter((p) => p.id < 0);
      const next = pending.length ? [...pending, ...data] : data;
      const nextIds = next.map((p) => `${p.id}:${p.quantity}:${p.name}:${p.storageLocation}`).join(",");
      const localIds = current.map((p) => `${p.id}:${p.quantity}:${p.name}:${p.storageLocation}`).join(",");
      if (nextIds === localIds) return current;
      writeStorage(storageKey(householdId), next);
      return next;
    });
  }, [householdId]);

  const syncFromServer = useCallback((isInitial = false) => {
    apiFetch("/api/products", householdId)
      .then((data: LocalProduct[]) => applyServerData(data))
      .catch(() => {})
      .finally(() => { if (isInitial) setIsLoading(false); });
  }, [householdId, applyServerData]);

  const refetch = useCallback((): Promise<void> => {
    return apiFetch("/api/products", householdId)
      .then((data: LocalProduct[]) => applyServerData(data))
      .catch(() => {});
  }, [householdId, applyServerData]);

  useEffect(() => {
    setIsLoading(true);
    syncFromServer(true);
    const interval = setInterval(() => syncFromServer(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [syncFromServer]);

  const createProduct = useCallback(async (data: CreateInput) => {
    const tempId = -Date.now();
    const tempProduct: LocalProduct = { id: tempId, ...data, createdAt: new Date().toISOString() };
    setProducts((prev) => [tempProduct, ...prev]);
    try {
      const saved: LocalProduct = await apiFetch("/api/products", householdId, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setProducts((prev) => prev.map((p) => (p.id === tempId ? saved : p)), false);
      return saved.id;
    } catch {
      return tempId;
    }
  }, [setProducts, householdId]);

  const updateProduct = useCallback(async (id: number, data: UpdateInput) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    try {
      const updated: LocalProduct = await apiFetch(`/api/products/${id}`, householdId, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)), false);
    } catch {}
  }, [setProducts, householdId]);

  const deleteProduct = useCallback(async (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (id > 0) apiFetch(`/api/products/${id}`, householdId, { method: "DELETE" }).catch(() => {});
  }, [setProducts, householdId]);

  const fridgeProducts  = products.filter((p) => p.storageLocation === "fridge");
  const freezerProducts = products.filter((p) => p.storageLocation === "freezer");
  const pantryProducts  = products.filter((p) => p.storageLocation === "pantry");
  const summary = {
    fridge: fridgeProducts.length,
    freezer: freezerProducts.length,
    pantry: pantryProducts.length,
    total: products.length,
  };

  return (
    <ProductsContext.Provider value={{
      products, isLoading, fridgeProducts, freezerProducts, pantryProducts, summary,
      canUndo, canRedo, undo, redo, refetch,
      createProduct, updateProduct, deleteProduct,
    }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside <ProductsProvider>");
  return ctx;
}
