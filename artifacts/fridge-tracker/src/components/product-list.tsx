import { useState, useMemo } from "react";
import { LocalProduct } from "@/context/products-context";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, ArrowUpDown } from "lucide-react";

export function ProductListSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-14 rounded-xl" />
      </div>
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

type SortKey = "naam-az" | "naam-za" | "hoeveelheid-hoog" | "hoeveelheid-laag" | "nieuwste" | "oudste";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "nieuwste",         label: "Nieuwste eerst" },
  { value: "oudste",           label: "Oudste eerst" },
  { value: "naam-az",          label: "Naam A–Z" },
  { value: "naam-za",          label: "Naam Z–A" },
  { value: "hoeveelheid-hoog", label: "Hoeveelheid ↓" },
  { value: "hoeveelheid-laag", label: "Hoeveelheid ↑" },
];

function sortProducts(products: LocalProduct[], key: SortKey): LocalProduct[] {
  return [...products].sort((a, b) => {
    switch (key) {
      case "naam-az":          return a.name.localeCompare(b.name, "nl");
      case "naam-za":          return b.name.localeCompare(a.name, "nl");
      case "hoeveelheid-hoog": return b.quantity - a.quantity;
      case "hoeveelheid-laag": return a.quantity - b.quantity;
      case "nieuwste":         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oudste":           return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });
}

interface ProductListProps {
  products: LocalProduct[] | undefined;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyMessage: string;
  /** Tint behind the empty-state icon: the location's own colour. */
  accentBg?: string;
}

export function ProductList({
  products,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  accentBg = "bg-secondary/50",
}: ProductListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("nieuwste");
  const [sortOpen, setSortOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    const base = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
    return sortProducts(base, sort);
  }, [products, search, sort]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  if (!products || products.length === 0) {
    return (
      <div
        data-tour="product-list"
        className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 py-16 px-4 text-center animate-in fade-in duration-500 lg:py-24"
      >
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${accentBg}`}>
          {emptyIcon}
        </div>
        <h3 className="text-xl font-semibold mb-2">{emptyTitle}</h3>
        <p className="text-muted-foreground max-w-[280px]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="product-list">
      {/* Search + Sort bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoeken..."
            className="pl-9 pr-9 h-11 rounded-xl bg-secondary/20 border-transparent focus:border-input"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(v => !v)}
            className="h-11 px-3 rounded-xl bg-secondary/20 border border-transparent hover:border-input flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">{currentSortLabel}</span>
          </button>

          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-12 z-20 bg-card border border-card-border rounded-2xl shadow-xl overflow-hidden w-48 animate-in fade-in slide-in-from-top-2 duration-150">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-secondary/40 ${
                      sort === opt.value ? "font-semibold text-primary bg-primary/5" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
          <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">Geen resultaten voor</p>
          <p className="text-sm text-muted-foreground">"{search}"</p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Zoekopdracht wissen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((product, i) => (
            <div
              key={product.id}
              data-tour={i === 0 ? "swipe-target" : undefined}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
              style={{ animationDelay: `${i * 40}ms`, animationDuration: "350ms" }}
            >
              <ProductCard product={product} />
            </div>
          ))}
          {search && (
            <p className="text-center text-xs text-muted-foreground pt-1">
              {filtered.length} van {products.length} product{products.length !== 1 ? "en" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
