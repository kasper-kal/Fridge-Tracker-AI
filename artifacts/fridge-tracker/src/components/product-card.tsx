import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { LocalProduct, useProducts } from "@/context/products-context";
import { useShoppingList } from "@/context/shopping-list-context";
import { Trash2, Check, X, Plus, Minus, ShoppingCart, Refrigerator, Snowflake, Package } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UnitSelect } from "@/components/unit-select";
import { haptic } from "@/lib/haptics";
import { signalTourAction } from "@/components/tour";

const SWIPE_THRESHOLD = 60;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch { return ""; }
}

type Location = LocalProduct["storageLocation"];

function moveTargets(loc: Location): { dest: Location; label: string; Icon: React.ElementType; bg: string }[] {
  const all = [
    { dest: "fridge"  as Location, label: "Koelkast", Icon: Refrigerator, bg: "bg-sky-500" },
    { dest: "freezer" as Location, label: "Vriezer",  Icon: Snowflake,    bg: "bg-indigo-500" },
    { dest: "pantry"  as Location, label: "Voorraad", Icon: Package,      bg: "bg-amber-500" },
  ];
  return all.filter(t => t.dest !== loc);
}

export function ProductCard({ product }: { product: LocalProduct }) {
  const { updateProduct, deleteProduct } = useProducts();
  const { addItem } = useShoppingList();

  const [isEditing, setIsEditing]       = useState(false);
  const [editName, setEditName]         = useState(product.name);
  const [editQuantity, setEditQuantity] = useState(product.quantity.toString());
  const [editUnit, setEditUnit]         = useState(product.unit);
  const [pending, setPending]           = useState(false);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiped, setSwiped]           = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const dragging    = useRef(false);
  const cardFaceRef = useRef<HTMLDivElement>(null);
  const [swipeReveal, setSwipeReveal] = useState(0);

  useLayoutEffect(() => {
    const face = cardFaceRef.current;
    if (!face) return;

    const updateRevealWidth = () => {
      const width = face.getBoundingClientRect().width;
      setSwipeReveal(width);
      if (swiped) setSwipeOffset(-width);
    };

    updateRevealWidth();
    const observer = new ResizeObserver(updateRevealWidth);
    observer.observe(face);
    return () => observer.disconnect();
  }, [swiped]);

  const closeSwipe = () => { setSwiped(false); setSwipeOffset(0); };

  const handleAddToList = useCallback(() => {
    haptic(12);
    addItem(product.name);
    toast.success(`${product.name} op boodschappenlijst`);
    closeSwipe();
  }, [addItem, product.name]);

  function stepForUnit(unit: string): number {
    switch (unit.toLowerCase().trim()) {
      case "g":  return 100;
      case "ml": return 100;
      case "kg": return 0.5;
      case "l":  return 0.5;
      default:   return 1;
    }
  }

  const adjustQuantity = useCallback((delta: number) => {
    haptic(6);
    const step = stepForUnit(product.unit);
    const next = Math.max(0, Math.round((product.quantity + delta * step) * 100) / 100);
    updateProduct(product.id, { quantity: next });
  }, [product.id, product.quantity, product.unit, updateProduct]);

  const handleMove = useCallback(async (dest: Location, label: string) => {
    haptic(12);
    setPending(true);
    await updateProduct(product.id, { storageLocation: dest });
    setPending(false);
    toast.success(`${product.name} verplaatst naar ${label.toLowerCase()}`);
    closeSwipe();
  }, [product.id, product.name, updateProduct]);

  const handleDelete = useCallback(async () => {
    haptic([10, 50, 20]);
    await deleteProduct(product.id);
    toast.success(`${product.name} verwijderd`);
  }, [product.id, product.name, deleteProduct]);

  const handleSave = useCallback(async () => {
    setPending(true);
    await updateProduct(product.id, {
      name: editName,
      quantity: parseFloat(editQuantity) || 0,
      unit: editUnit,
    });
    setPending(false);
    setIsEditing(false);
    toast.success(`${editName} bijgewerkt`);
  }, [product.id, editName, editQuantity, editUnit, updateProduct]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    dragging.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!dragging.current) {
      if (Math.abs(dy) > Math.abs(dx)) return;
      dragging.current = true;
    }

    if (dx > 0 && !swiped) return;

      const base   = swiped ? -swipeReveal : 0;
      const offset = Math.min(0, Math.max(-swipeReveal, base + dx));
    setSwipeOffset(offset);
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;
    if (swiped) {
      if (swipeOffset > -(swipeReveal - SWIPE_THRESHOLD)) {
        setSwiped(false); setSwipeOffset(0);
      } else {
        setSwiped(true); setSwipeOffset(-swipeReveal);
      }
    } else {
      if (swipeOffset < -SWIPE_THRESHOLD) {
        haptic(8);
        setSwiped(true); setSwipeOffset(-swipeReveal);
        signalTourAction("swipe");
      } else {
        setSwiped(false); setSwipeOffset(0);
      }
    }
    dragging.current = false;
  };

  const dateLabel = product.createdAt ? formatDate(product.createdAt) : "";
  const targets = moveTargets(product.storageLocation);

  if (isEditing) {
    return (
      <div className="bg-card rounded-2xl p-4 border shadow-sm flex flex-col gap-3">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Naam"
          className="font-semibold text-lg"
        />
        <div className="flex gap-3">
          <Input
            type="number"
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
            placeholder="Aantal"
            className="w-24"
          />
          <UnitSelect value={editUnit} onChange={setEditUnit} size="sm" className="flex-1" />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            <X className="w-4 h-4 mr-2" /> Annuleren
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}>
            <Check className="w-4 h-4 mr-2" /> Opslaan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >

      {/* Swipe action backdrop — 4 buttons */}
      <div data-testid="swipe-actions" className="absolute inset-0 flex items-stretch">
        {/* 1. Boodschappenlijst */}
        <button
          onClick={handleAddToList}
          className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 bg-emerald-500 text-white text-[10px] font-semibold active:brightness-90 transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          Lijst
        </button>

        {/* 2 & 3. Verplaats naar de 2 andere locaties */}
        {targets.map(({ dest, label, Icon, bg }) => (
          <button
            key={dest}
            onClick={() => handleMove(dest, label)}
            disabled={pending}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 ${bg} text-white text-[10px] font-semibold active:brightness-90 transition-all`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}

        {/* 4. Verwijder */}
        <button
          onClick={handleDelete}
          disabled={pending}
          className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-semibold active:brightness-90 transition-all rounded-r-2xl"
        >
          <Trash2 className="w-5 h-5" />
          Verwijder
        </button>
      </div>

      {/* Card face */}
      <div
        ref={cardFaceRef}
        className="relative bg-card border shadow-sm rounded-2xl flex items-center justify-between"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: dragging.current ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Name + date — tap to edit */}
        <div
          className="flex-1 min-w-0 py-3.5 pl-4 pr-1 cursor-pointer active:opacity-70 transition-opacity"
          onClick={() => { if (!swiped) setIsEditing(true); else closeSwipe(); }}
        >
          <h3 className="font-semibold text-lg text-card-foreground truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm font-medium text-muted-foreground">{product.unit}</p>
            {dateLabel && (
              <p className="text-xs text-muted-foreground/50">· {dateLabel}</p>
            )}
          </div>
        </div>

        {/* +/– quantity control */}
        <div className="flex items-center gap-1 pr-3 py-3.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); if (swiped) { closeSwipe(); return; } adjustQuantity(-1); }}
            disabled={product.quantity <= 0}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary active:scale-90 transition-all disabled:opacity-30"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="text-base font-bold text-card-foreground w-10 text-center tabular-nums">
            {product.quantity % 1 === 0 ? product.quantity : product.quantity.toFixed(1)}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); if (swiped) { closeSwipe(); return; } adjustQuantity(1); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary active:scale-90 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
