import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  return `${base}${path}`;
}

interface ThemeContextValue {
  primaryColor: string;
  secondaryColor: string;
  updateColor: (key: "primaryColor" | "secondaryColor", value: string) => Promise<void>;
}

const DEFAULT_PRIMARY = "220 68% 35%";
const DEFAULT_SECONDARY = "200 30% 90%";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyColors(primary: string, secondary: string) {
  document.documentElement.style.setProperty("--primary", primary);
  document.documentElement.style.setProperty("--ring", primary);
  document.documentElement.style.setProperty("--secondary", secondary);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimary] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondary] = useState(DEFAULT_SECONDARY);

  useEffect(() => {
    fetch(apiUrl("/api/settings"))
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const p = data.primaryColor ?? DEFAULT_PRIMARY;
        const s = data.secondaryColor ?? DEFAULT_SECONDARY;
        setPrimary(p);
        setSecondary(s);
        applyColors(p, s);
      })
      .catch(() => {});
  }, []);

  const updateColor = useCallback(async (key: "primaryColor" | "secondaryColor", value: string) => {
    const response = await fetch(apiUrl("/api/settings"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) throw new Error("Kleuren opslaan mislukt");
    if (key === "primaryColor") {
      setPrimary(value);
      applyColors(value, secondaryColor);
    } else {
      setSecondary(value);
      applyColors(primaryColor, value);
    }
  }, [primaryColor, secondaryColor]);

  return (
    <ThemeContext.Provider value={{ primaryColor, secondaryColor, updateColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
