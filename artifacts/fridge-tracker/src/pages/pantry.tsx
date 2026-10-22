import { useProducts } from "@/context/products-context";
import { useHousehold } from "@/context/household-context";
import { Layout } from "@/components/layout";
import { SummaryStrip } from "@/components/summary-strip";
import { ProductList, ProductListSkeleton } from "@/components/product-list";
import { ShoppingListDrawer } from "@/components/shopping-list-drawer";
import { HouseholdDialog } from "@/components/household-dialog";
import { Link } from "wouter";
import { Package, Users, UserCircle } from "lucide-react";

export default function PantryPage() {
  const { pantryProducts, isLoading, refetch } = useProducts();
  const { household } = useHousehold();

  return (
    <Layout onRefresh={refetch}>
      <div className="pt-12 pb-4 px-6 lg:px-10 lg:pt-10 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Voorraad</h1>
            {household ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  {household.name}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 font-medium">Droge waren, blikken en houdbare producten.</p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Link
              href="/account"
              aria-label="Account"
              title="Account"
              className="inline-flex p-2 rounded-full hover:bg-secondary transition-colors active:scale-95 lg:hidden"
            >
              <UserCircle className="w-6 h-6 text-foreground" />
            </Link>
            <HouseholdDialog />
            <ShoppingListDrawer />
          </div>
        </div>
      </div>

      <SummaryStrip />

      <div className="px-6 pb-4 lg:px-10">
        {isLoading ? (
          <ProductListSkeleton />
        ) : (
          <ProductList
            products={pantryProducts}
            emptyIcon={<Package className="w-10 h-10 text-muted-foreground" />}
            emptyTitle="Je voorraadkast is leeg"
            emptyMessage="Bewaar hier droge waren, blikken en andere houdbare producten."
            accentColor="text-primary"
          />
        )}
      </div>
    </Layout>
  );
}
