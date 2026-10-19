import { useState } from "react";
import { Link } from "wouter";
import { User, Pencil, Check, X, Home, FileText, Shield, ChevronRight, LogOut, AlertTriangle, BookOpen, RotateCcw } from "lucide-react";
import { Layout } from "@/components/layout";
import { useUser } from "@/context/user-context";
import { useHousehold } from "@/context/household-context";
import { toast } from "sonner";
import { requestOnboardingReplay } from "@/components/onboarding-slides";

export default function AccountPage() {
  const { user, deviceId, updateUsername } = useUser();
  const { household, leave } = useHousehold();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    localStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("fridge_device_id");
    localStorage.removeItem("fridge_user");
    window.location.reload();
  };

  const saveUsername = async () => {
    if (!newName.trim() || newName.trim() === user?.username) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateUsername(newName.trim());
      toast.success("Naam bijgewerkt");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message ?? "Bijwerken mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="pt-12 pb-4 px-6 bg-gradient-to-b from-primary/5 to-transparent">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Account</h1>
        <p className="text-muted-foreground mt-1 font-medium">Jouw profiel en instellingen</p>
      </div>

      <div className="px-6 pb-32 space-y-4 mt-2">
        {/* Profile card */}
        <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                    autoFocus
                    maxLength={32}
                    className="flex-1 text-base font-semibold bg-transparent border-b-2 border-primary outline-none text-foreground"
                  />
                  <button onClick={saveUsername} disabled={saving} className="text-primary hover:brightness-110">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setEditing(false); setNewName(user?.username ?? ""); }} className="text-muted-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-foreground truncate">{user?.username}</p>
                  <button onClick={() => { setEditing(true); setNewName(user?.username ?? ""); }} className="text-muted-foreground hover:text-primary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                ID: {deviceId.slice(0, 8)}…{deviceId.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Household */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Huishouden</p>
          </div>
          {household ? (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Home className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{household.name}</p>
                  <p className="text-xs text-muted-foreground">{household.isCreator ? "Jij bent de maker" : "Lid"}</p>
                </div>
              </div>
              <button
                onClick={() => { leave(); toast.success("Huishouden verlaten"); }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Verlaten
              </button>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">Geen huishouden gekoppeld.</p>
            </div>
          )}
        </div>

        {/* Links */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border">
          <Link href="/help">
            <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-left">Gebruikersaanwijzing</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Link>
          <button
            onClick={requestOnboardingReplay}
            data-testid="restart-tutorial"
            aria-label="Rondleiding opnieuw starten"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium text-left">Rondleiding opnieuw starten</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <Link href="/terms">
            <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-left">Gebruiksvoorwaarden</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Link>
          <Link href="/privacy">
            <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-left">Privacybeleid</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Link>
        </div>

        {/* Logout */}
        {!confirmLogout ? (
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Log uit
          </button>
        ) : (
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">Weet je het zeker?</p>
            </div>
            <p className="text-xs text-muted-foreground">Je wordt uitgelogd en je account wordt verwijderd van dit apparaat. Je kunt daarna een nieuw account aanmaken.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Log uit
              </button>
            </div>
          </div>
        )}

        {/* Reset app */}
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-border text-muted-foreground hover:bg-secondary/30 transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            App resetten
          </button>
        ) : (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">App volledig resetten?</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Dit wist <strong>alles</strong>: je account, alle producten, je huishouden, cookie-instellingen en onboardinggeschiedenis. De app start daarna opnieuw op alsof hij nooit is gebruikt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                Alles wissen
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Koelkast Tracker · versie 1.0
        </p>
      </div>
    </Layout>
  );
}
