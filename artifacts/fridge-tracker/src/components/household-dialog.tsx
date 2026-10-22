import { useState, useCallback, useEffect } from "react";
import { Users, Plus, LogIn, LogOut, Home, Eye, EyeOff, QrCode, ScanLine, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/context/household-context";
import { useUser } from "@/context/user-context";
import { CameraScanner } from "@/components/camera-scanner";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  return `${base}${path}`;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Fout ${res.status}`);
  return data;
}

function encodeQR(name: string, pin: string) {
  return JSON.stringify({ n: name, p: pin });
}

function decodeQR(text: string): { name: string; pin: string } | null {
  try {
    const obj = JSON.parse(text);
    if (obj?.n && obj?.p) return { name: obj.n, pin: obj.p };
  } catch {}
  return null;
}

export function HouseholdDialog() {
  const { household, setHousehold, leave } = useHousehold();
  const { deviceId, isGuest } = useUser();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinMode, setJoinMode] = useState<"form" | "qr">("form");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showHouseholdPin, setShowHouseholdPin] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const closeHandler = () => setOpen(false);
    document.addEventListener("close-household-dialog", closeHandler);
    return () => document.removeEventListener("close-household-dialog", closeHandler);
  }, []);

  const reset = () => {
    setName("");
    setPin("");
    setShowQR(false);
    setJoinMode("form");
    setConfirmDelete(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !pin.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/households", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), pin: pin.trim(), deviceId }),
      });
      setHousehold({ id: data.id, name: data.name, pin: pin.trim(), isCreator: true });
      toast.success(`Huishouden "${data.name}" aangemaakt — deel de pincode met je huisgenoten`);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Aanmaken mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (joinName = name, joinPin = pin) => {
    if (!joinName.trim() || !joinPin.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/households/join", {
        method: "POST",
        body: JSON.stringify({ name: joinName.trim(), pin: joinPin.trim(), deviceId }),
      });
      setHousehold({ id: data.id, name: data.name, pin: joinPin.trim(), isCreator: data.isCreator ?? false });
      toast.success(`Aangesloten bij ${data.name}`);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = useCallback((text: string) => {
    const decoded = decodeQR(text);
    if (!decoded) {
      toast.error("Ongeldige QR-code");
      setJoinMode("form");
      return;
    }
    setName(decoded.name);
    setPin(decoded.pin);
    setJoinMode("form");
    handleJoin(decoded.name, decoded.pin);
  }, []);

  const handleLeave = () => {
    const naam = household?.name;
    leave();
    toast.success(naam ? `${naam} verlaten` : "Huishouden verlaten");
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!household) return;
    setLoading(true);
    try {
      await apiFetch(`/api/households/${household.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      });
      leave();
      toast.success(`Huishouden "${household.name}" verwijderd`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Verwijderen mislukt");
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  const qrValue = household?.pin ? encodeQR(household.name, household.pin) : "";

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DrawerTrigger asChild>
        <button
          aria-label="Huishouden"
          title="Huishouden"
          className="relative p-2 rounded-full hover:bg-secondary transition-colors active:scale-95"
        >
          <Users className="w-6 h-6 text-foreground" />
          {household && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-w-[430px] mx-auto max-h-[90vh] lg:rounded-3xl lg:bottom-6">
        <DrawerTitle className="sr-only">Huishouden</DrawerTitle>

        <div className="overflow-y-auto px-6 pt-6 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Home className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Huishouden</h2>
              <p className="text-sm text-muted-foreground">
                {household ? `Verbonden met "${household.name}"` : "Deel je koelkast met huisgenoten"}
              </p>
            </div>
          </div>

          {household ? (
            <div className="space-y-4">
              {/* Connected card */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">{household.name}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {household.isCreator ? "Jij hebt dit huishouden aangemaakt" : "Iedereen met de naam + pincode ziet dit"}
                  </p>
                </div>
              </div>

              {/* PIN display */}
              {household.pin && (
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pincode</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-mono font-bold tracking-widest flex-1">
                      {showHouseholdPin ? household.pin : "•".repeat(household.pin.length)}
                    </span>
                    <button
                      onClick={() => setShowHouseholdPin((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showHouseholdPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowQR((v) => !v)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {showQR ? "QR-code verbergen" : "QR-code tonen"}
                </Button>

                {showQR && qrValue && (
                  <div className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-white rounded-2xl border">
                    <QRCodeSVG value={qrValue} size={180} includeMargin />
                    <p className="text-xs text-center text-gray-500 max-w-[200px]">
                      Scan met de app om automatisch lid te worden van <strong>{household.name}</strong>
                    </p>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={handleLeave}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Huishouden verlaten
              </Button>

              {/* Delete — only for creator */}
              {household.isCreator && (
                confirmDelete ? (
                  <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/30 space-y-3">
                    <p className="text-sm font-semibold text-destructive">Huishouden verwijderen?</p>
                    <p className="text-xs text-muted-foreground">
                      Dit verwijdert het huishouden permanent. Huisgenoten verliezen de verbinding.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setConfirmDelete(false)}
                        disabled={loading}
                      >
                        Annuleren
                      </Button>
                      <Button
                        className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDelete}
                        disabled={loading}
                      >
                        {loading ? "Bezig..." : "Ja, verwijderen"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Huishouden verwijderen
                  </Button>
                )
              )}
            </div>
          ) : isGuest ? (
            <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-foreground">Eerst een naam</p>
              <p className="text-xs text-muted-foreground">
                Je gebruikt de app als gast. Met een naam kun je een huishouden aanmaken of je bij
                je huisgenoten aansluiten.
              </p>
              <Link href="/account" onClick={() => setOpen(false)}>
                <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
                  Naam instellen
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                {(["create", "join"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); reset(); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      tab === t ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {t === "create" ? "Aanmaken" : "Lid worden"}
                  </button>
                ))}
              </div>

              {tab === "join" && (
                <div className="flex rounded-lg bg-muted/50 p-0.5 gap-0.5">
                  <button
                    onClick={() => setJoinMode("form")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      joinMode === "form" ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Naam + pin
                  </button>
                  <button
                    onClick={() => setJoinMode("qr")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      joinMode === "qr" ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    QR scannen
                  </button>
                </div>
              )}

              {(tab === "create" || (tab === "join" && joinMode === "form")) && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Naam huishouden</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="bijv. Familie de Vries"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Pincode</label>
                    <div className="relative">
                      <Input
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
                        placeholder="bijv. 1234"
                        type={showPin ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10 bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "join" && joinMode === "qr" && (
                <div className="py-2 rounded-2xl overflow-hidden">
                  <CameraScanner
                    onResult={handleQRScan}
                    label="Scan de QR-code van je huisgenoot"
                  />
                </div>
              )}

              {(tab === "create" || (tab === "join" && joinMode === "form")) && (
                <>
                  <Button
                    className="w-full"
                    onClick={tab === "create" ? handleCreate : () => handleJoin()}
                    disabled={!name.trim() || !pin.trim() || loading}
                  >
                    {tab === "create" ? (
                      <><Plus className="w-4 h-4 mr-2" />Huishouden aanmaken</>
                    ) : (
                      <><LogIn className="w-4 h-4 mr-2" />Lid worden</>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {tab === "create"
                      ? "Deel de naam + pincode met huisgenoten zodat zij kunnen inloggen."
                      : "Voer de naam en pincode in die je huisgenoot heeft aangemaakt."}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
