import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Trash2, Undo2, Refrigerator, Snowflake, Package } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts, type LocalProduct } from "@/context/products-context";
import { haptic } from "@/lib/haptics";

const LOCATIONS = {
  fridge: { label: "Koelkast", Icon: Refrigerator, tone: "bg-sky-500/10 text-sky-700" },
  pantry: { label: "Voorraad", Icon: Package, tone: "bg-amber-500/10 text-amber-700" },
  freezer: { label: "Vriezer", Icon: Snowflake, tone: "bg-indigo-500/10 text-indigo-700" },
} as const;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function formatQuantity(quantity: number) {
  return quantity % 1 === 0 ? quantity : quantity.toFixed(1);
}

export default function DeletedPage() {
  const { deletedProducts, isLoadingDeleted, refetchDeleted, restoreProduct, purgeProduct } =
    useProducts();
  const [busyId, setBusyId] = useState<number | null>(null);

  // This page is the only place the list is shown, so it asks for it on every
  // visit instead of trusting what the app loaded at startup.
  useEffect(() => {
    void refetchDeleted();
  }, [refetchDeleted]);

  const handleRestore = async (product: LocalProduct) => {
    haptic(10);
    setBusyId(product.id);
    await restoreProduct(product.id);
    setBusyId(null);
    toast.success(`${product.name} teruggezet`);
  };

  const handlePurge = async (product: LocalProduct) => {
    haptic([10, 40, 10]);
    setBusyId(product.id);
    await purgeProduct(product.id);
    setBusyId(null);
    toast.success(`${product.name} definitief verwijderd`);
  };

  return (
    <Layout onRefresh={refetchDeleted}>
      <div className="px-6 lg:px-10 pt-12 lg:pt-10 pb-2 max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/account">
            <button className="p-2 rounded-full hover:bg-secondary transition-colors" aria-label="Terug naar account">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Verwijderde producten</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6 pl-[52px]">
          Wat je weggooit blijft hier een week staan. Daarna is het definitief weg.
        </p>

        {isLoadingDeleted ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : deletedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60">
              <Trash2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Niets verwijderd</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Producten die je verwijdert komen hier een week te staan, zodat je ze nog terug kunt zetten.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card divide-y divide-border">
            {deletedProducts.map((product) => {
              const location = LOCATIONS[product.storageLocation];
              const deleted = product.deletedAt ? formatDate(product.deletedAt) : "";
              return (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                  {/* The colour and glyph say where it was; the word is only read out. */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${location.tone}`}>
                    <location.Icon className="h-5 w-5" />
                    <span className="sr-only">{location.label}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    {/* Each fact stays on its own line rather than breaking a date in
                        half when the row is tight on a phone. */}
                    <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">{formatQuantity(product.quantity)} {product.unit}</span>
                      {deleted && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="whitespace-nowrap">{deleted}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(product)}
                    disabled={busyId === product.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-95 disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Herstellen
                  </button>
                  <button
                    onClick={() => handlePurge(product)}
                    disabled={busyId === product.id}
                    aria-label={`${product.name} definitief verwijderen`}
                    title="Definitief verwijderen"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
