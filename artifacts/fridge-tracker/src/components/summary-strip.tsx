import { useLocation } from "wouter";
import { useProducts } from "@/context/products-context";

/**
 * One colour per storage location, taken from the swipe row: Koelkast sky,
 * Voorraad amber, Vriezer indigo. The three counts are the only place the three
 * locations sit side by side, so this is where the colours earn their keep.
 */
const TONES = {
  sky: {
    box: "border-sky-600/25 bg-sky-500/10",
    count: "text-sky-700",
    current: "ring-2 ring-sky-500/40",
  },
  indigo: {
    box: "border-indigo-600/25 bg-indigo-500/10",
    count: "text-indigo-700",
    current: "ring-2 ring-indigo-500/40",
  },
  amber: {
    box: "border-amber-600/25 bg-amber-500/10",
    count: "text-amber-700",
    current: "ring-2 ring-amber-500/40",
  },
} as const;

export function SummaryStrip() {
  const { summary } = useProducts();
  const [location] = useLocation();

  // Same order everywhere: Koelkast, Voorraad, Vriezer - the tab bar's order.
  const items = [
    { path: "/", count: summary.fridge, label: "Koelkast", tone: TONES.sky },
    { path: "/pantry", count: summary.pantry, label: "Voorraad", tone: TONES.amber },
    { path: "/freezer", count: summary.freezer, label: "Vriezer", tone: TONES.indigo },
  ];

  // Desktop already shows these three counts in the sidebar, so repeating them
  // here would put the same numbers on screen twice.
  return (
    <div className="grid grid-cols-3 gap-2 px-6 pt-4 pb-6 lg:hidden">
      {items.map(({ path, count, label, tone }) => (
        <div
          key={label}
          className={`flex flex-col items-center justify-center rounded-2xl border py-2.5 ${tone.box} ${
            location === path ? tone.current : ""
          }`}
        >
          <span className={`text-lg font-bold leading-none ${tone.count}`}>{count}</span>
          <span className="mt-1 text-[11px] font-medium text-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
