import { useProducts } from "@/context/products-context";

export function SummaryStrip() {
  const { summary } = useProducts();

  const items = [
    { count: summary.fridge, label: "Koelkast" },
    { count: summary.freezer, label: "Vriezer" },
    { count: summary.pantry, label: "Voorraad" },
  ];

  // Desktop already shows these three counts in the sidebar, so repeating them
  // here would put the same numbers on screen twice.
  return (
    <div className="grid grid-cols-3 gap-2 px-6 pt-4 pb-6 lg:hidden">
      {items.map(({ count, label }) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 py-2.5"
        >
          <span className="text-lg font-bold leading-none text-primary">{count}</span>
          <span className="mt-1 text-[11px] font-medium text-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
