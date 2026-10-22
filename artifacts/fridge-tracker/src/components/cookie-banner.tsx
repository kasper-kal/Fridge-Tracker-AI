import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "fridge_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-36 lg:bottom-8 left-4 right-4 z-50 max-w-sm mx-auto lg:left-1/2 lg:right-auto lg:ml-32 lg:-translate-x-1/2 lg:bottom-8">
      <div className="bg-card border border-border rounded-2xl shadow-md p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Cookies</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We gebruiken cookies om je voorkeuren en sessie op te slaan. Geen tracking van derden.
            </p>
          </div>
          <button onClick={decline} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={decline}
            className="flex-1 py-1.5 text-xs font-medium rounded-xl border border-border text-muted-foreground hover:bg-secondary/50 transition-colors"
          >
            Weigeren
          </button>
          <button
            onClick={accept}
            className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all"
          >
            Accepteren
          </button>
        </div>
      </div>
    </div>
  );
}
