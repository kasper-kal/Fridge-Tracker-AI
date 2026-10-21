import { useState, useEffect, useRef, useCallback } from "react";
import { useUser as useClerkUser } from "@clerk/react";
import { X, Trash2, Shield, ShieldOff, Home, Users, Palette, ChevronLeft, Delete, RotateCcw } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { toast } from "sonner";

const ADMIN_PIN = "065728";
const SCROLL_THRESHOLD = 10;

const DEFAULT_PRIMARY   = "220 68% 35%";
const DEFAULT_SECONDARY = "200 30% 90%";

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  return `${base}${path}`;
}

function hslStringToHex(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/);
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return "#1a3a6b"; }
}

function hexToHslString(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch { return "220 68% 35%"; }
}

interface HouseholdRow { id: number; name: string; createdAt: string; }
interface UserRow { id: number; username: string; deviceId: string; isBanned: boolean; ipAddress?: string | null; createdAt: string; }

type AdminTab = "households" | "users" | "colors";

function PinScreen({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);

  const press = (digit: string) => {
    if (entered.length >= 6) return;
    const next = entered + digit;
    setEntered(next);
    if (next.length === 6) {
      if (next === ADMIN_PIN) {
        setTimeout(onSuccess, 200);
      } else {
        setShake(true);
        setTimeout(() => { setEntered(""); setShake(false); }, 600);
      }
    }
  };

  const del = () => setEntered((v) => v.slice(0, -1));
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gray-950 text-white pb-12 pt-16 select-none">
      <button onClick={onClose} className="absolute top-5 left-5 text-gray-400 hover:text-white transition-colors">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="flex flex-col items-center gap-6 flex-1 justify-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xl font-semibold">Ontwikkelaar</p>
          <p className="text-sm text-gray-400">Voer de toegangscode in</p>
        </div>
        <div className={`flex gap-3 mt-2 transition-transform duration-75 ${shake ? "translate-x-2" : ""}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
              i < entered.length ? "bg-white border-white scale-110" : "bg-transparent border-gray-500"
            }`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px] px-4">
        {keys.map((k, i) => (
          k === "" ? <div key={i} /> :
          k === "del" ? (
            <button key={i} onClick={del} className="h-16 rounded-2xl bg-white/10 flex items-center justify-center active:scale-95 transition-transform">
              <Delete className="w-5 h-5" />
            </button>
          ) : (
            <button key={i} onClick={() => press(k)} className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center">
              <span className="text-2xl font-light">{k}</span>
            </button>
          )
        ))}
      </div>
    </div>
  );
}

function BanConfirmModal({ username, isBanned, onConfirm, onCancel }: {
  username: string;
  isBanned: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-6">
      <div className="bg-card rounded-3xl p-6 space-y-4 w-full max-w-sm shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldOff className="w-6 h-6 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-foreground">
            {isBanned ? "Ban opheffen?" : "Gebruiker bannen?"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isBanned
              ? <>Wil je de ban van <span className="font-semibold text-foreground">{username}</span> opheffen?</>
              : <>Weet je zeker dat je <span className="font-semibold text-foreground">{username}</span> wilt bannen? De gebruiker krijgt direct geen toegang meer tot de app.</>}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors">
            Annuleren
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-2xl text-white text-sm font-semibold transition-colors ${isBanned ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"}`}>
            {isBanned ? "Ban opheffen" : "Ja, bannen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserConfirmModal({ username, onConfirm, onCancel }: {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-6">
      <div className="bg-card rounded-3xl p-6 space-y-4 w-full max-w-sm shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-foreground">Account definitief verwijderen?</p>
          <p className="text-sm text-muted-foreground">
            Het profiel en de inloggegevens van <span className="font-semibold text-foreground">{username}</span> worden verwijderd. Gedeelde producten, boodschappenlijsten en het huishouden blijven bestaan.
          </p>
          <p className="text-xs font-medium text-destructive">Dit kan niet ongedaan worden gemaakt.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors">
            Annuleren
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors">
            Definitief verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<AdminTab>("households");
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const { primaryColor, secondaryColor, updateColor } = useTheme();
  const [primaryHex, setPrimaryHex] = useState(() => hslStringToHex(primaryColor));
  const [secondaryHex, setSecondaryHex] = useState(() => hslStringToHex(secondaryColor));
  const [savingColors, setSavingColors] = useState(false);
  const [confirmBanUser, setConfirmBanUser] = useState<UserRow | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [hRes, uRes] = await Promise.all([
        fetch(apiUrl("/api/households"), { credentials: "include" }),
        fetch(apiUrl("/api/users"), { credentials: "include" }),
      ]);
      if (!hRes.ok || !uRes.ok) throw new Error("Beheerdersgegevens ophalen mislukt");
      setHouseholds(await hRes.json());
      setUsers(await uRes.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Beheerdersgegevens ophalen mislukt");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPrimaryHex(hslStringToHex(primaryColor)); }, [primaryColor]);
  useEffect(() => { setSecondaryHex(hslStringToHex(secondaryColor)); }, [secondaryColor]);

  const deleteHousehold = async (id: number) => {
    try {
      const res = await fetch(apiUrl(`/api/households/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setHouseholds((h) => h.filter((x) => x.id !== id));
      toast.success("Huishouden verwijderd");
    } catch (e: any) { toast.error(e.message); }
  };

  const executeBan = async (user: UserRow) => {
    setConfirmBanUser(null);
    try {
      const res = await fetch(apiUrl(`/api/users/${user.id}/ban`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((rows) => rows.map((row) =>
        row.id === user.id ? { ...row, isBanned: !row.isBanned } : row,
      ));
      toast.success(user.isBanned
        ? `De ban van ${user.username} is opgeheven`
        : `${user.username} is gebanned`);
    } catch (e: any) { toast.error(e.message); }
  };

  const executeDeleteUser = async (user: UserRow) => {
    setConfirmDeleteUser(null);
    try {
      const res = await fetch(apiUrl(`/api/users/${user.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((rows) => rows.filter((row) => row.id !== user.id));
      toast.success(`${user.username} en het account zijn verwijderd`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gebruiker verwijderen mislukt");
    }
  };

  const saveColors = async () => {
    setSavingColors(true);
    try {
      await updateColor("primaryColor", hexToHslString(primaryHex));
      await updateColor("secondaryColor", hexToHslString(secondaryHex));
      toast.success("Kleuren opgeslagen voor alle gebruikers");
    } catch { toast.error("Opslaan mislukt"); }
    finally { setSavingColors(false); }
  };

  const resetToDefault = async () => {
    setPrimaryHex(hslStringToHex(DEFAULT_PRIMARY));
    setSecondaryHex(hslStringToHex(DEFAULT_SECONDARY));
    setSavingColors(true);
    try {
      await updateColor("primaryColor", DEFAULT_PRIMARY);
      await updateColor("secondaryColor", DEFAULT_SECONDARY);
      toast.success("Kleuren teruggezet naar standaard");
    } catch { toast.error("Terugzetten mislukt"); }
    finally { setSavingColors(false); }
  };

  const tabs: { id: AdminTab; label: string; icon: typeof Home }[] = [
    { id: "households", label: "Huishoudens", icon: Home },
    { id: "users", label: "Gebruikers", icon: Users },
    { id: "colors", label: "Kleuren", icon: Palette },
  ];

  const visibleUsers = users;

  return (
    <>
      {confirmBanUser && (
        <BanConfirmModal
          username={confirmBanUser.username}
          isBanned={confirmBanUser.isBanned}
          onConfirm={() => executeBan(confirmBanUser)}
          onCancel={() => setConfirmBanUser(null)}
        />
      )}
      {confirmDeleteUser && (
        <DeleteUserConfirmModal
          username={confirmDeleteUser.username}
          onConfirm={() => executeDeleteUser(confirmDeleteUser)}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      )}

      <div className="fixed inset-0 z-[100] flex flex-col bg-background">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base text-foreground">Beheer</p>
            <p className="text-xs text-muted-foreground">Ontwikkelaarsinstellingen</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-border px-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
          {tab === "households" && (
            <>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {households.length} huishouden{households.length !== 1 ? "s" : ""}
              </p>
              {households.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Geen huishoudens gevonden</p>
              )}
              {households.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Home className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {h.id} · {new Date(h.createdAt).toLocaleDateString("nl-NL")}</p>
                  </div>
                  <button onClick={() => deleteHousehold(h.id)}
                    className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === "users" && (
            <>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {visibleUsers.length} gebruiker{visibleUsers.length !== 1 ? "s" : ""}
              </p>
              {visibleUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Geen gebruikers</p>
              )}
              {visibleUsers.map((u) => (
                <div key={u.id} className="p-3 rounded-2xl border bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{u.username}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">ID: {u.deviceId.slice(0, 12)}…</p>
                      {u.ipAddress && <p className="text-xs text-muted-foreground font-mono">IP: {u.ipAddress}</p>}
                      <p className="text-xs text-muted-foreground">Lid sinds {new Date(u.createdAt).toLocaleDateString("nl-NL")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmBanUser(u)}
                        title={u.isBanned ? "Ban opheffen" : "Gebruiker bannen"}
                        aria-label={u.isBanned ? `Ban van ${u.username} opheffen` : `${u.username} bannen`}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${u.isBanned ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
                      >
                        {u.isBanned ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteUser(u)}
                        title="Account definitief verwijderen"
                        aria-label={`${u.username} definitief verwijderen`}
                        className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {u.isBanned && (
                    <p className="mt-2 ml-12 text-xs font-semibold text-destructive">Geblokkeerd</p>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === "colors" && (
            <div className="space-y-5">
              <p className="text-xs text-muted-foreground">Wijzigingen gelden voor alle gebruikers van de app.</p>

              <div className="space-y-4">
                {[
                  { label: "Primaire kleur", hex: primaryHex, setHex: setPrimaryHex, defaultHsl: DEFAULT_PRIMARY },
                  { label: "Secundaire kleur", hex: secondaryHex, setHex: setSecondaryHex, defaultHsl: DEFAULT_SECONDARY },
                ].map(({ label, hex, setHex, defaultHsl }) => (
                  <div key={label} className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <button
                        onClick={() => setHex(hslStringToHex(defaultHsl))}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Standaard
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl border border-border shadow-sm shrink-0" style={{ backgroundColor: hex }} />
                      <input type="color" value={hex} onChange={(e) => setHex(e.target.value)}
                        className="flex-1 h-10 rounded-xl cursor-pointer border border-border" />
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{hexToHslString(hex)}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-3">
                <p className="text-sm font-semibold text-foreground">Voorbeeld</p>
                <div className="flex gap-2">
                  <div className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold text-white" style={{ backgroundColor: primaryHex }}>
                    Primair
                  </div>
                  <div className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold border border-border" style={{ backgroundColor: secondaryHex }}>
                    Secundair
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={resetToDefault} disabled={savingColors}
                  className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-foreground disabled:opacity-50 hover:bg-secondary/50 transition-all flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Alles standaard
                </button>
                <button onClick={saveColors} disabled={savingColors}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 hover:brightness-110 transition-all active:scale-[.98]">
                  {savingColors ? "Opslaan..." : "Opslaan"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function DeveloperPanel() {
  const { user: clerkUser, isLoaded } = useClerkUser();
  const [scrollCount, setScrollCount] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [canDevelop, setCanDevelop] = useState(false);
  const lastScrollTime = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanDevelop(false);
    if (!isLoaded || !clerkUser?.id) return;
    let active = true;
    fetch(apiUrl("/api/users/admin-status"), { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : { isAdmin: false })
      .then((result) => {
        if (active) setCanDevelop(result.isAdmin === true);
      })
      .catch(() => {
        if (active) setCanDevelop(false);
      });
    return () => { active = false; };
  }, [clerkUser?.id, isLoaded]);

  const registerScroll = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollTime.current > 3000) {
      setScrollCount(1);
    } else {
      setScrollCount((c) => {
        const next = c + 1;
        if (next >= SCROLL_THRESHOLD) {
          setShowPin(true);
          return 0;
        }
        return next;
      });
    }
    lastScrollTime.current = now;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setScrollCount(0), 3000);
  }, []);

  useEffect(() => {
    if (!canDevelop) return;
    const onWheel = (e: WheelEvent) => { if (e.deltaY > 0) registerScroll(); };
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => { lastTouchY = e.touches[0]?.clientY ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (lastTouchY - endY > 50) registerScroll();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [canDevelop, registerScroll]);

  if (!isLoaded || !canDevelop) return null;
  if (showAdmin) return <AdminPanel onClose={() => setShowAdmin(false)} />;
  if (showPin) return (
    <PinScreen
      onSuccess={() => { setShowPin(false); setShowAdmin(true); }}
      onClose={() => { setShowPin(false); setScrollCount(0); }}
    />
  );
  return null;
}
