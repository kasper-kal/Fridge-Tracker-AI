import { Link, useLocation } from "wouter";
import { Refrigerator, Package, Snowflake, Plus, UserCircle, HelpCircle, Archive } from "lucide-react";
import { signalTourAction } from "./tour";
import { useProducts } from "@/context/products-context";

// Same location colours as the phone nav, the count tiles and the swipe row.
const TABS = [
  { path: "/", label: "Koelkast", Icon: Refrigerator, active: "bg-sky-500/10 text-sky-700" },
  { path: "/pantry", label: "Voorraad", Icon: Package, active: "bg-amber-500/10 text-amber-700" },
  { path: "/freezer", label: "Vriezer", Icon: Snowflake, active: "bg-indigo-500/10 text-indigo-700" },
];

/**
 * Desktop navigation. A bottom bar stretched across a monitor is a phone
 * interface glued to a wide screen, so wide viewports get the same tabs as a
 * side rail instead, with the add button where a mouse expects it.
 */
export function Sidebar() {
  const [location] = useLocation();
  const { summary } = useProducts();

  const count = (path: string) =>
    path === "/" ? summary.fridge : path === "/pantry" ? summary.pantry : summary.freezer;

  const openAdd = () => {
    signalTourAction("add");
    document.dispatchEvent(new CustomEvent("open-add-modal"));
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-border bg-card px-4 py-6">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <Refrigerator className="h-5 w-5 text-primary" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Koelkast</p>
          <p className="text-xs text-muted-foreground">Tracker</p>
        </div>
      </Link>

      <button
        onClick={openAdd}
        data-tour="add-button"
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[.99]"
      >
        <Plus className="h-4 w-4" />
        Product toevoegen
      </button>

      <nav className="mt-6 flex flex-col gap-1" data-tour="bottom-nav-tabs">
        {TABS.map(({ path, label, Icon, active: activeTone }) => {
          const active = location === path;
          return (
            <Link
              key={path}
              href={path}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? activeTone
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              <span
                className={`text-xs tabular-nums ${active ? "" : "text-muted-foreground"}`}
              >
                {count(path)}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <Link
          href="/account"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            location === "/account"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <UserCircle className="h-4 w-4" />
          Account
        </Link>
        <Link
          href="/deleted"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            location === "/deleted"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <Archive className="h-4 w-4" />
          Verwijderd
        </Link>
        <Link
          href="/help"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            location === "/help"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Uitleg
        </Link>
      </div>
    </aside>
  );
}
