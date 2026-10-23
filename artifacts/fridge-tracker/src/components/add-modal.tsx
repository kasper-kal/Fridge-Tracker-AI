import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Trash2, Plus, Camera, PenLine, ChevronRight, X, Loader2, Save, Upload, Barcode, Refrigerator, Snowflake, Package } from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useParseReceipt } from "@workspace/api-client-react";
import { useProducts } from "@/context/products-context";
import { UnitSelect } from "@/components/unit-select";
import { CameraScanner } from "@/components/camera-scanner";
import { toast } from "sonner";
import { signalTourAction } from "@/components/tour";
import Tesseract from "tesseract.js";

type View = "menu" | "manual" | "scan" | "barcode";
type StorageLocation = "fridge" | "freezer" | "pantry";

export function AddModal() {
  const [path] = useLocation();
  // The + on the Vriezer page should not offer to add to the fridge first.
  const routeLocation: StorageLocation =
    path === "/freezer" ? "freezer" : path === "/pantry" ? "pantry" : "fridge";

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [prefillName, setPrefillName] = useState("");
  const [prefillLocation, setPrefillLocation] = useState<StorageLocation>("fridge");
  const [tutorialActive, setTutorialActive] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    const closeHandler = () => resetAndClose();
    const tutorialHandler = (event: Event) => {
      const { action } = (event as CustomEvent<{ action: string }>).detail;
      if (action === "add") setTutorialActive(true);
      if (action === "tour-finished") {
        setTutorialActive(false);
        resetAndClose(true);
      } else if (action === "product-created" || action === "add-closed") {
        setTutorialActive(false);
      }
    };
    document.addEventListener("open-add-modal", handler);
    document.addEventListener("close-add-modal", closeHandler);
    document.addEventListener("tour-action", tutorialHandler);
    return () => {
      document.removeEventListener("open-add-modal", handler);
      document.removeEventListener("close-add-modal", closeHandler);
      document.removeEventListener("tour-action", tutorialHandler);
    };
  }, []);

  const resetAndClose = (tutorialCompleted = false) => {
    setOpen(false);
    if (!tutorialCompleted) signalTourAction("add-closed");
    setTimeout(() => { setView("menu"); setPrefillName(""); setPrefillLocation(routeLocation); }, 300);
  };

  const goToManual = useCallback((name = "", loc: StorageLocation = routeLocation) => {
    setPrefillName(name);
    setPrefillLocation(loc);
    setView("manual");
    if (tutorialActive) {
      signalTourAction(name.trim() ? "add-prefilled" : "add-manual-chosen");
    }
  }, [tutorialActive, routeLocation]);

  const selectView = (nextView: View) => {
    setView(nextView);
    if (tutorialActive) {
      signalTourAction(nextView === "scan" ? "add-receipt-chosen" : "add-barcode-chosen");
    }
  };

  const returnToMenu = () => {
    setView("menu");
    if (tutorialActive) signalTourAction("add-menu");
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
          return;
        }
        resetAndClose();
      }}
    >
      <DrawerTrigger asChild>
        <Button
          size="icon"
          aria-label="Product toevoegen"
          title="Product toevoegen"
          className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-card px-6 pb-safe lg:pb-6 pt-2 lg:pt-6 border-t border-card-border rounded-t-3xl h-[85vh] max-h-[800px] outline-none lg:inset-x-0 lg:mx-auto lg:w-[560px] lg:rounded-3xl lg:bottom-6 lg:h-auto lg:min-h-0 lg:max-h-[85vh]">
        <DrawerTitle className="sr-only">Item toevoegen</DrawerTitle>

        {view === "menu" && (
          <MenuView
            onScan={() => selectView("scan")}
            onManual={() => goToManual()}
            onBarcode={() => selectView("barcode")}
          />
        )}
        {view === "manual" && (
          <ManualAddFlow
            onClose={resetAndClose}
            onBack={returnToMenu}
            prefillName={prefillName}
            prefillLocation={prefillLocation}
            tutorialActive={tutorialActive}
          />
        )}
        {view === "scan" && (
          <ScanReceiptFlow
            onClose={resetAndClose}
            onBack={returnToMenu}
            onManual={() => goToManual()}
          />
        )}
        {view === "barcode" && (
          <BarcodeFlow onClose={resetAndClose} onBack={returnToMenu} onFound={goToManual} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function MenuView({
  onScan,
  onManual,
  onBarcode,
}: {
  onScan: () => void;
  onManual: () => void;
  onBarcode: () => void;
}) {
  return (
    <>
      <h2 className="text-2xl font-bold text-card-foreground mb-4">Item toevoegen</h2>

      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300" data-tour="add-methods">
        <button
          onClick={onScan}
          className="flex items-center p-5 bg-secondary/30 hover:bg-secondary/50 rounded-2xl transition-all group"
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <Camera className="h-6 w-6" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-lg text-card-foreground">Bon scannen</div>
            <div className="text-sm text-muted-foreground">Items automatisch detecteren met AI</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          onClick={onBarcode}
          className="flex items-center p-5 bg-secondary/30 hover:bg-secondary/50 rounded-2xl transition-all group"
        >
          <div className="h-12 w-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <Barcode className="h-6 w-6" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-lg text-card-foreground">Barcode scannen</div>
            <div className="text-sm text-muted-foreground">Scan een product via de camera</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          onClick={onManual}
          className="flex items-center p-5 bg-secondary/30 hover:bg-secondary/50 rounded-2xl transition-all group"
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <PenLine className="h-6 w-6" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-lg text-card-foreground">Handmatig toevoegen</div>
            <div className="text-sm text-muted-foreground">Vul zelf de details in</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </>
  );
}

function BarcodeFlow({
  onClose,
  onBack,
  onFound,
}: {
  onClose: () => void;
  onBack: () => void;
  onFound: (name: string, location: StorageLocation) => void;
}) {
  const [scanning, setScanning] = useState(true);
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [barcode, setBarcode] = useState("");

  const handleBarcode = useCallback(async (code: string) => {
    setScanning(false);
    setLooking(true);
    setBarcode(code);
    signalTourAction("add-target-changed");

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`);
      const data = await res.json();
      const productName: string | undefined =
        data?.product?.product_name_nl ||
        data?.product?.product_name ||
        data?.product?.generic_name_nl ||
        data?.product?.generic_name;

      if (productName) {
        toast.success(`Product gevonden: ${productName}`);
        onFound(productName, "fridge");
      } else {
        setNotFound(true);
        signalTourAction("add-target-changed");
      }
    } catch {
      setNotFound(true);
      signalTourAction("add-target-changed");
    } finally {
      setLooking(false);
    }
  }, [onFound]);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-card-foreground">Barcode scannen</h2>
        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {scanning && (
          <>
            <CameraScanner
              onResult={handleBarcode}
              label="Richt op een EAN/UPC barcode op de verpakking"
            />
            <Button variant="ghost" className="w-full max-w-sm" onClick={() => onFound("", "fridge")}>
              Camera werkt niet? Handmatig invoeren
            </Button>
          </>
        )}

        {looking && (
          <div className="flex flex-col items-center gap-4 py-8" data-tour="add-scan-action">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Product opzoeken…</p>
              <p className="text-sm text-muted-foreground font-mono mt-1">{barcode}</p>
            </div>
          </div>
        )}

        {notFound && (
          <div className="flex flex-col items-center gap-4 py-8 text-center" data-tour="add-scan-action">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Barcode className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">Product niet gevonden</p>
              <p className="text-sm text-muted-foreground">Barcode: {barcode}</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <Button variant="outline" className="flex-1" onClick={() => {
                setNotFound(false);
                setScanning(true);
                signalTourAction("add-target-changed");
              }}>
                Opnieuw scannen
              </Button>
              <Button className="flex-1" onClick={() => onFound("", "fridge")}>
                Handmatig
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ManualAddFlow({
  onClose,
  onBack,
  prefillName = "",
  prefillLocation = "fridge",
  tutorialActive,
}: {
  onClose: (tutorialCompleted?: boolean) => void;
  onBack: () => void;
  prefillName?: string;
  prefillLocation?: StorageLocation;
  tutorialActive: boolean;
}) {
  const [name, setName] = useState(prefillName);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState<StorageLocation>(prefillLocation);
  const [saving, setSaving] = useState(false);

  const { createProduct } = useProducts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    setSaving(true);
    const locationLabel = location === "fridge" ? "koelkast" : location === "freezer" ? "vriezer" : "voorraad";
    await createProduct({
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit: unit.trim() || "st",
      storageLocation: location,
    });
    setSaving(false);
    toast.success(`${name.trim()} toegevoegd aan ${locationLabel}`);
    signalTourAction("product-created", { storageLocation: location });
    onClose(true);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-card-foreground">Handmatig toevoegen</h2>
        <Button variant="ghost" size="icon" onClick={onBack} type="button" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col flex-1 min-h-0" data-tour="add-active-content">
      <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-2" data-tour="product-name">
          <Label htmlFor="name" className="text-sm font-medium">Productnaam</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              const nextName = e.target.value;
              setName(nextName);
              if (tutorialActive) {
                signalTourAction(nextName.trim() ? "add-name-ready" : "add-name-cleared");
              }
            }}
            onBlur={(e) => {
              if (tutorialActive) {
                signalTourAction(e.currentTarget.value.trim() ? "add-name-ready" : "add-name-cleared");
              }
            }}
            placeholder="bijv. Biologische Melk"
            className="h-12 rounded-xl bg-secondary/20"
            autoFocus={!tutorialActive}
          />
        </div>

        <div className="flex gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor="qty" className="text-sm font-medium">Hoeveelheid</Label>
            <Input
              id="qty"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="h-12 rounded-xl bg-secondary/20"
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label className="text-sm font-medium">Eenheid</Label>
            <UnitSelect value={unit || "st"} onChange={setUnit} />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Bewaren in</Label>
          <RadioGroup
            value={location}
            onValueChange={(v) => setLocation(v as StorageLocation)}
            className="grid grid-cols-3 gap-3"
          >
            <div>
              <RadioGroupItem value="fridge" id="fridge-m" className="peer sr-only" />
              <Label
                htmlFor="fridge-m"
                className="flex flex-col items-center justify-center p-3 border-2 border-transparent bg-secondary/30 rounded-2xl peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all hover:bg-secondary/50 text-center"
              >
                <Refrigerator className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm text-foreground mt-1">Koelkast</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="pantry" id="pantry-m" className="peer sr-only" />
              <Label
                htmlFor="pantry-m"
                className="flex flex-col items-center justify-center p-3 border-2 border-transparent bg-secondary/30 rounded-2xl peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all hover:bg-secondary/50 text-center"
              >
                <Package className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm text-foreground mt-1">Voorraad</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="freezer" id="freezer-m" className="peer sr-only" />
              <Label
                htmlFor="freezer-m"
                className="flex flex-col items-center justify-center p-3 border-2 border-transparent bg-secondary/30 rounded-2xl peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all hover:bg-secondary/50 text-center"
              >
                <Snowflake className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm text-foreground mt-1">Vriezer</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="pt-4 mt-auto">
        <Button
          data-tour="save-product"
          type="submit"
          disabled={saving}
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Item opslaan
        </Button>
      </div>
      </div>
    </form>
  );
}

function ScanReceiptFlow({
  onClose,
  onBack,
  onManual,
}: {
  onClose: (tutorialCompleted?: boolean) => void;
  onBack: () => void;
  onManual: () => void;
}) {
  const [step, setStep] = useState<"upload" | "ocr" | "api" | "confirm">("upload");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<
    { name: string; quantity: number; unit: string; location: "fridge" | "freezer" | "pantry" }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createProduct } = useProducts();
  const parseMutation = useParseReceipt();

  const processFile = async (file: File) => {
    setScanError(null);
    setStep("ocr");
    setOcrProgress(0);
    try {
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const ocrText = result.data.text.trim();
      if (!ocrText) {
        const message = "Geen tekst gevonden. Maak een scherpere foto of voeg de producten handmatig toe.";
        setScanError(message);
        toast.error(message);
        setStep("upload");
        signalTourAction("add-target-changed");
        return;
      }

      setStep("api");
      const items = await parseMutation.mutateAsync({ data: { text: ocrText } });
      setParsedItems(items.map((i) => ({
        name: i.name,
        quantity: i.quantity ?? 1,
        unit: i.unit ?? "st",
        location: "fridge" as const,
      })));
      setStep("confirm");
      if (items.length > 0) signalTourAction("add-save-ready");
      signalTourAction("add-target-changed");
    } catch (err) {
      console.error(err);
      const message = "De bon kon niet worden gelezen. Probeer opnieuw of voeg de producten handmatig toe.";
      setScanError(message);
      toast.error(message);
      setStep("upload");
      signalTourAction("add-target-changed");
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleSaveAll = async () => {
    if (parsedItems.length === 0) return onClose();
    setSaving(true);
    for (const item of parsedItems) {
      await createProduct({ name: item.name, quantity: item.quantity, unit: item.unit, storageLocation: item.location });
    }
    setSaving(false);
    const names = parsedItems.slice(0, 2).map(i => i.name).join(", ");
    const extra = parsedItems.length > 2 ? ` en ${parsedItems.length - 2} meer` : "";
    toast.success(`${names}${extra} toegevoegd`);
    signalTourAction("product-created", {
      storageLocation: parsedItems[0]?.location ?? "fridge",
    });
    onClose(true);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    setParsedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-card-foreground">Bon scannen</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={step === "upload" ? onBack : () => { setStep("upload"); setParsedItems([]); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col flex-1 min-h-0" data-tour="add-active-content">
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Camera className="w-10 h-10" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-card-foreground">Voeg een bonafbeelding toe</p>
              <p className="text-sm text-muted-foreground max-w-[260px]">
                Tekst wordt lokaal uitgelezen. Alleen de tekst wordt naar AI gestuurd — nooit de afbeelding.
              </p>
            </div>
            {scanError && (
              <div role="alert" className="w-full max-w-xs rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-foreground">
                {scanError}
              </div>
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleCameraChange} />
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <div className="flex flex-col gap-3 w-full max-w-xs" data-tour="add-scan-action">
              <Button size="lg" className="w-full h-14 rounded-2xl text-base font-bold" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="w-5 h-5 mr-2" /> Foto nemen
              </Button>
              <Button size="lg" variant="outline" className="w-full h-14 rounded-2xl text-base font-bold" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-5 h-5 mr-2" /> Uploaden van apparaat
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={onManual}>
                Lukt scannen niet? Handmatig invoeren
              </Button>
            </div>
          </div>
        )}

        {(step === "ocr" || step === "api") && (
          <div className="flex flex-col items-center justify-center h-full space-y-8 py-12">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-secondary rounded-full" />
              <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" style={{ animationDuration: "1.5s" }} />
              <span className="text-lg font-bold text-primary">{step === "ocr" ? `${ocrProgress}%` : "AI"}</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold">{step === "ocr" ? "Tekst lezen..." : "Items identificeren..."}</h3>
              <p className="text-sm text-muted-foreground">{step === "ocr" ? "Bon lokaal scannen op je apparaat" : "Bontekst naar AI sturen"}</p>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 pb-4">
            <p className="font-medium text-muted-foreground mb-2">
              Bekijk {parsedItems.length} gedetecteerd{parsedItems.length !== 1 ? "e items" : " item"}
            </p>
            {parsedItems.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">Er zijn geen items gedetecteerd.</p>
                <p className="text-sm text-muted-foreground">Je kunt een nieuwe foto proberen of de producten zelf invoeren.</p>
                <div className="mx-auto flex w-full max-w-xs flex-col gap-2" data-tour="add-scan-action">
                  <Button variant="outline" onClick={() => { setScanError(null); setStep("upload"); }}>
                    Bon opnieuw proberen
                  </Button>
                  <Button variant="ghost" onClick={onManual}>Handmatig invoeren</Button>
                </div>
              </div>
            ) : (
              parsedItems.map((item, i) => (
                <div key={i} className="bg-secondary/20 border border-secondary p-4 rounded-2xl space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(i)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="pr-10">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      className="font-semibold text-base border-transparent bg-transparent hover:bg-secondary/40 focus:bg-background px-2 -ml-2 transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number" min="0" step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-20 bg-background"
                    />
                    <UnitSelect value={item.unit || "st"} onChange={(v) => updateItem(i, "unit", v)} size="sm" className="w-28" />
                    <div className="flex bg-background rounded-lg border p-1 ml-auto shrink-0 gap-0.5">
                      {(["fridge", "freezer", "pantry"] as const).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => updateItem(i, "location", loc)}
                          className={`p-1.5 rounded-md transition-colors ${
                            item.location === loc
                              ? loc === "fridge" ? "bg-primary text-primary-foreground"
                                : loc === "freezer" ? "bg-primary text-primary-foreground"
                                : "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {loc === "fridge"
                            ? <Refrigerator className="w-4 h-4" />
                            : loc === "freezer"
                            ? <Snowflake className="w-4 h-4" />
                            : <Package className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {step === "confirm" && parsedItems.length > 0 && (
        <div className="pt-4 mt-auto shrink-0 bg-card border-t -mx-6 px-6 pb-2">
          <Button
            data-tour="save-product"
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Alle {parsedItems.length} item{parsedItems.length !== 1 ? "s" : ""} opslaan
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}
