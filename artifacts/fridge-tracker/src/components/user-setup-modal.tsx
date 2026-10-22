import { useState } from "react";
import { Refrigerator, User, ArrowRight } from "lucide-react";
import { useUser as useClerkUser } from "@clerk/react";
import { useUser } from "@/context/user-context";
import { toast } from "sonner";
import { OnboardingCard } from "@/components/onboarding-card";

export function UserSetupModal() {
  const { isRegistered, register, suggestedName } = useUser();
  const { user: clerkUser } = useClerkUser();
  const [username, setUsername] = useState(suggestedName);
  const [loading, setLoading] = useState<"named" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isRegistered) return null;

  const name = username.trim();

  const submit = async (kind: "named" | "guest") => {
    setError(null);
    setLoading(kind);
    try {
      await register(kind === "guest" ? "" : name);
      if (kind === "guest") toast.success("Je gaat verder als gast");
      else toast.success(`Welkom, ${name}!`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registratie mislukt";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/40 p-4">
      <OnboardingCard>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Refrigerator className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-foreground">
              {clerkUser ? "Laatste stap" : "Hoe mogen we je noemen?"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Alleen zichtbaar voor huisgenoten en beheerders.
            </p>
          </div>
        </div>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("named");
          }}
        >
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="setup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Jouw naam, bijv. Thomas"
              maxLength={32}
              autoFocus
              autoComplete="name"
              aria-invalid={error ? true : undefined}
              className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading !== null}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[.98] disabled:opacity-60"
          >
            {loading === "named" ? "Bezig…" : name ? `Aan de slag als ${name}` : "Aan de slag"}
          </button>
        </form>

        <button
          type="button"
          data-testid="setup-continue-as-guest"
          onClick={() => void submit("guest")}
          disabled={loading !== null}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          {loading === "guest" ? "Bezig…" : "Doorgaan zonder naam"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <p className="mt-1 text-center text-xs text-muted-foreground">
          Als gast kun je alles doen, behalve een huishouden delen. Je kunt je naam later altijd
          nog instellen bij Account.
        </p>
      </OnboardingCard>
    </div>
  );
}
