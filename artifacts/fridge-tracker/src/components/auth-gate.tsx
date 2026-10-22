import { Link } from "wouter";
import { Refrigerator, LogIn, UserPlus, ArrowRight } from "lucide-react";

const GUEST_KEY = "fridge_guest_mode";

export function hasChosenGuestMode() {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberGuestMode() {
  try {
    localStorage.setItem(GUEST_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * Shown when nobody is signed in and this browser has no device profile yet —
 * a fresh device, or the app after a reset. Without it the only route back to
 * an existing account was a small link inside the setup dialog, so users who
 * logged out (or installed on a second device) ended up creating a fresh,
 * empty profile instead of recovering their own.
 */
export function SignedOutGate({ onContinueAsGuest }: { onContinueAsGuest: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="space-y-5">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Refrigerator className="h-9 w-9 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Welkom</p>
          <h1 className="text-3xl font-bold tracking-tight">Koelkast Tracker</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Log in om je koelkast op al je apparaten te gebruiken. Je producten, boodschappenlijst
            en huishouden komen dan automatisch mee.
          </p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Met e-mail en wachtwoord, Google, Apple of GitHub.
          </p>
        </div>
      </div>

      <div className="w-full max-w-xs grid gap-3">
        <Link
          href="/sign-in"
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-[.98] transition-all"
        >
          <LogIn className="h-4 w-4" />
          Inloggen
        </Link>
        <Link
          href="/sign-up"
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-secondary/50 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Account aanmaken
        </Link>
        <button
          onClick={onContinueAsGuest}
          data-testid="continue-without-account"
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Doorgaan zonder account
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground max-w-xs">
        Zonder account blijft je koelkast op dit apparaat staan. Met een account kun je hem later
        terugzetten als je uitgelogd raakt of een nieuw apparaat gebruikt.
      </p>
    </div>
  );
}
