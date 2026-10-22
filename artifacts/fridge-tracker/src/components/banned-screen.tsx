import { ShieldOff, UserPlus } from "lucide-react";
import { useClerk } from "@clerk/react";

export function BannedScreen() {
  const { signOut } = useClerk();

  const clearAccountData = async () => {
    localStorage.removeItem("fridge_device_id");
    localStorage.removeItem("fridge_user");
    localStorage.removeItem("fridge_guest_mode");
    try {
      // Without this the blocked Clerk session survives the reload and the
      // "new account" button would just land back on this screen.
      await signOut();
    } catch {
      /* already signed out */
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background px-6 text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="w-10 h-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Account geblokkeerd</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Je account is geblokkeerd door een beheerder. Neem contact op als je denkt dat dit een vergissing is.
        </p>
      </div>
      <button
        onClick={() => void clearAccountData()}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-colors text-sm font-medium text-foreground"
      >
        <UserPlus className="w-4 h-4" />
        Nieuw account maken
      </button>
    </div>
  );
}
