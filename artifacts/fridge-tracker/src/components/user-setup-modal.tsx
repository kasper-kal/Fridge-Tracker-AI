import { useState } from "react";
import { Refrigerator, User } from "lucide-react";
import { useUser } from "@/context/user-context";
import { toast } from "sonner";
import { OnboardingCard } from "@/components/onboarding-card";

export function UserSetupModal() {
  const { isRegistered, register } = useUser();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  if (isRegistered) return null;

  const handleRegister = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      await register(username.trim());
      toast.success(`Welkom, ${username.trim()}!`);
    } catch (e: any) {
      toast.error(e.message ?? "Registratie mislukt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/[.78] p-4 backdrop-blur-sm sm:p-6">
      <OnboardingCard>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
            <Refrigerator className="h-7 w-7 text-primary" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Account instellen</p>
          <h2 className="text-2xl font-bold text-foreground">Welkom!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Kies een gebruikersnaam om aan de slag te gaan met je koelkast tracker.
          </p>
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleRegister();
          }}
        >
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="setup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Jouw naam, bijv. Thomas"
              maxLength={32}
              required
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim() || loading}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all active:scale-[.98]"
          >
            {loading ? "Bezig..." : "Aan de slag \u2192"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Je naam is alleen zichtbaar voor huisgenoten en beheerders.
        </p>
      </OnboardingCard>
    </div>
  );
}
