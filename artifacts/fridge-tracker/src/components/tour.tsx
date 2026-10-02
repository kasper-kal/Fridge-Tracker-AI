import { useEffect, useState } from "react";

export const TOUR_SEEN_KEY = "fridge_tour_seen";
export type TourAction =
  | "add"
  | "add-method-chosen"
  | "add-menu"
  | "product-created"
  | "swipe"
  | "add-closed"
  | "tour-finished";

export function signalTourAction(action: TourAction) {
  document.dispatchEvent(new CustomEvent("tour-action", { detail: action }));
}

const STEPS = [
  {
    target: '[data-tour="add-button"]',
    action: "add" as TourAction,
    title: "Producten toevoegen",
    description: "Tik op de + knop. Voeg daarna zelf een product toe; dat wordt meteen je eerste echte product.",
    pad: 18,
    tooltipBelow: false,
  },
  {
    target: '[data-tour="product-list"]',
    action: "swipe" as TourAction,
    title: "Probeer een veegactie",
    description:
      "Veeg je nieuwe product naar links om de beschikbare acties te zien.",
    pad: 12,
    tooltipBelow: false,
  },
];

const ADD_OPTIONS_STEP = {
  target: '[data-tour="add-methods"]',
  action: "add-method-chosen" as TourAction,
  title: "Kies hoe je wilt toevoegen",
  description: "Scan een bon, scan een barcode of vul het product handmatig in. Je kunt hieronder direct een optie kiezen.",
  pad: 8,
  tooltipBelow: false,
};

type TourMode = "add" | "add-options" | "swipe";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

function measure(selector: string, pad: number): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  if (b.width === 0 && b.height === 0) return null;
  const w = b.width + pad * 2;
  const h = b.height + pad * 2;
  return {
    x: b.left - pad,
    y: b.top - pad,
    w,
    h,
    r: Math.min(24, w / 2, h / 2),
  };
}

export function TourOverlay({ onDone, mode }: { onDone: () => void; mode: TourMode }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  const current = mode === "add"
    ? STEPS[0]
    : mode === "add-options"
      ? ADD_OPTIONS_STEP
      : STEPS[1];

  useEffect(() => {
    setVisible(false);
    const run = () => {
      const r = measure(current.target, current.pad);
      if (r) {
        setRect(r);
        requestAnimationFrame(() => setVisible(true));
      }
    };
    run();
    const timers = [150, 350, 650].map((delay) => window.setTimeout(run, delay));
    window.addEventListener("resize", run);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", run);
    };
  }, [mode, current.target, current.pad]);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const action = (event as CustomEvent<TourAction>).detail;
      if (action !== current.action) return;
      if (mode !== "swipe") return;
      onDone();
    };
    document.addEventListener("tour-action", handleAction);
    return () => document.removeEventListener("tour-action", handleAction);
  }, [current.action, mode, onDone]);

  if (!rect) return null;

  const tooltipAbove =
    !current.tooltipBelow || rect.y + rect.h > window.innerHeight * 0.58;

  const tooltipGap = mode === "add-options" ? 6 : 20;
  const tooltipStyle = tooltipAbove
    ? { bottom: window.innerHeight - rect.y + tooltipGap }
    : { top: rect.y + rect.h + 20 };

  return (
    <>
      {/* SVG spotlight overlay */}
      <div
        className={`fixed inset-0 z-[60] pointer-events-none transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={rect.r} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-mask)" />
        </svg>
      </div>

      {/* Pulsing ring around target */}
      <div
        className={`fixed z-[61] pointer-events-none border-2 border-white/90 transition-all duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: rect.r,
          animation: "tour-pulse 2s ease-in-out infinite",
        }}
      />

      {/* Tooltip card */}
      <div
        className={`fixed z-[62] left-4 right-4 pointer-events-auto transition-all duration-300 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
        style={tooltipStyle}
      >
        <div className="bg-card rounded-3xl p-5 shadow-2xl border border-border max-w-[360px] mx-auto">
          {/* Progress */}
            <div className="flex gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  (mode !== "swipe" && i === 0) || (mode === "swipe" && i === 1)
                    ? "w-6 bg-primary"
                    : i < (mode === "swipe" ? 1 : 0)
                      ? "w-1.5 bg-primary/35"
                      : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            {mode === "swipe" ? "Daarna dit" : "Eerst dit"}
          </p>
          <h3 className="font-bold text-lg text-foreground mb-1.5">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.description}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={onDone}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Overslaan
            </button>
            <p className="text-sm font-semibold text-primary text-right">
              {mode === "add"
                ? "Voeg je eerste product toe"
                : mode === "add-options"
                  ? "Kies een optie"
                  : "Veeg naar links om verder te gaan"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255,255,255,0.12), 0 0 20px rgba(255,255,255,0.15); }
          50%       { box-shadow: 0 0 0 8px rgba(255,255,255,0.06), 0 0 30px rgba(255,255,255,0.25); }
        }
      `}</style>
    </>
  );
}
