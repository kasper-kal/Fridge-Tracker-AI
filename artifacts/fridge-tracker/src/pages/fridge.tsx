import { useProducts } from "@/context/products-context";
import { useHousehold } from "@/context/household-context";
import { Layout } from "@/components/layout";
import { SummaryStrip } from "@/components/summary-strip";
import { ProductList, ProductListSkeleton } from "@/components/product-list";
import { ShoppingListDrawer } from "@/components/shopping-list-drawer";
import { HouseholdDialog } from "@/components/household-dialog";
import { Link } from "wouter";
import { Refrigerator, Users, UserCircle } from "lucide-react";

export default function FridgePage() {
  const { fridgeProducts, isLoading, refetch } = useProducts();
  const { household } = useHousehold();

  return (
    <Layout onRefresh={refetch}>
      <div className="pt-12 pb-4 px-6 lg:px-10 lg:pt-10 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Koelkast</h1>
            {household ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  {household.name}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 font-medium min-h-12">Houd je verse producten bij.</p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Link
              href="/account"
              data-tour="account-button"
              aria-label="Account"
              title="Account"
              className="inline-flex p-2 rounded-full hover:bg-secondary transition-colors active:scale-95 lg:hidden"
            >
              <UserCircle className="w-6 h-6 text-foreground" />
            </Link>
            <span data-tour="household-button" className="inline-flex"><HouseholdDialog /></span>
            <span data-tour="shopping-list-button" className="inline-flex"><ShoppingListDrawer /></span>
          </div>
        </div>
      </div>

      <SummaryStrip />

      <div className="px-6 pb-4 lg:px-10">
        {isLoading ? (
          <ProductListSkeleton />
        ) : (
          <ProductList
            products={fridgeProducts}
            emptyIcon={<Refrigerator className="w-10 h-10 text-sky-600" />}
            emptyTitle="Je koelkast is leeg"
            emptyMessage="Tik op de + om je eerste product toe te voegen."
            accentBg="bg-sky-500/10"
          />
        )}
      </div>
    </Layout>
  );
}
