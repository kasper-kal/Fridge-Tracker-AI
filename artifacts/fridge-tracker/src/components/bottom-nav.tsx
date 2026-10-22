import { Link, useLocation } from "wouter";
import { Snowflake, Refrigerator, Package } from "lucide-react";
import { AddModal } from "./add-modal";
import { signalTourAction } from "./tour";

export function BottomNav() {
  const [location] = useLocation();

  const active = (path: string) =>
    location === path ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground";

  return (
    <div className="app-shell fixed bottom-0 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border-t border-card-border pb-safe z-50 rounded-t-3xl shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] lg:hidden">
      {/* Floating + above center */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-12" data-tour="add-button">
        <div onClick={() => signalTourAction("add")}>
          <AddModal />
        </div>
      </div>

      <div className="flex items-center justify-around h-20 px-4" data-tour="bottom-nav-tabs">
        <Link href="/">
          <div className={`flex flex-col items-center justify-center w-20 h-full transition-all duration-300 ${active("/")}`}>
            <Refrigerator className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium tracking-wide">Koelkast</span>
          </div>
        </Link>

        <Link href="/pantry">
          <div className={`flex flex-col items-center justify-center w-20 h-full transition-all duration-300 ${active("/pantry")}`}>
            <Package className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium tracking-wide">Voorraad</span>
          </div>
        </Link>

        <Link href="/freezer">
          <div className={`flex flex-col items-center justify-center w-20 h-full transition-all duration-300 ${active("/freezer")}`}>
            <Snowflake className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium tracking-wide">Vriezer</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
