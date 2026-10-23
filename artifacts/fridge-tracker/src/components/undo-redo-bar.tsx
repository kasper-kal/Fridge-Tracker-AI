import { useEffect, useState } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useLocation } from "wouter";
import { useProducts } from "@/context/products-context";
import { toast } from "sonner";

/**
 * Undo lives next to the change it undoes instead of in a strip across the top.
 * The strip reserved 44px at the top of every list and read as an empty white
 * band above the heading; a fixed bar at the top either did that or covered the
 * page title, and a phone has no third place for it.
 */
const HIDE_AFTER_MS = 6000;

/** Only the three storage pages have product actions to undo. */
const PRODUCT_ROUTES = ["/", "/pantry", "/freezer"];

export function UndoRedoBar() {
  const { canUndo, canRedo, undo, redo } = useProducts();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const eligible = PRODUCT_ROUTES.includes(location) && (canUndo || canRedo);

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const timer = setTimeout(() => setOpen(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [eligible, canUndo, canRedo]);

  if (!open) return null;

  const handleUndo = () => {
    undo();
    toast.info("Ongedaan gemaakt", { duration: 1500 });
  };

  const handleRedo = () => {
    redo();
    toast.info("Opnieuw uitgevoerd", { duration: 1500 });
  };

  const buttonClass = (enabled: boolean) =>
    `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
      enabled
        ? "bg-secondary text-foreground hover:bg-secondary/80 active:scale-95"
        : "text-muted-foreground cursor-not-allowed"
    }`;

  return (
    <div
      role="toolbar"
      aria-label="Ongedaan maken en opnieuw uitvoeren"
      className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1.5 shadow-lg backdrop-blur-md lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0"
    >
      <button onClick={handleUndo} disabled={!canUndo} className={buttonClass(canUndo)}>
        <Undo2 className="h-3.5 w-3.5" />
        Ongedaan
      </button>
      <div className="h-4 w-px bg-border" />
      <button onClick={handleRedo} disabled={!canRedo} className={buttonClass(canRedo)}>
        <Redo2 className="h-3.5 w-3.5" />
        Opnieuw
      </button>
    </div>
  );
}
