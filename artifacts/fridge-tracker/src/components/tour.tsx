import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { OnboardingCard } from "@/components/onboarding-card";

export const TOUR_SEEN_KEY = "fridge_tour_seen";
export const TOUR_STEP_COUNT = 5;
export type TourAction =
  | "add"
  | "add-manual-chosen"
  | "add-receipt-chosen"
  | "add-barcode-chosen"
  | "add-prefilled"
  | "add-name-ready"
  | "add-name-cleared"
  | "add-save-ready"
  | "add-menu"
  | "add-target-changed"
  | "product-created"
  | "swipe"
  | "add-closed"
  | "tour-finished";

export interface TourActionDetail {
  action: TourAction;
  storageLocation?: "fridge" | "freezer" | "pantry";
}

export function signalTourAction(
  action: TourAction,
  payload: Omit<TourActionDetail, "action"> = {},
) {
  document.dispatchEvent(
    new CustomEvent<TourActionDetail>("tour-action", {
      detail: { action, ...payload },
    }),
  );
}

const ADD_STEP = {
  target: '[data-tour="add-button"]',
  action: "add" as TourAction,
  title: "Voeg een product toe",
  description: "Tik op de + knop onderaan. Je kunt een bon scannen, een barcode scannen of alles handmatig invullen.",
  pad: 18,
  tooltipBelow: false,
};

const ADD_OPTIONS_STEP = {
  target: '[data-tour="add-methods"]',
  action: "add-manual-chosen" as TourAction,
  title: "Kies hoe je wilt toevoegen",
  description: "Bon scannen, barcode scannen of handmatig toevoegen. Handmatig invoeren werkt altijd als scannen niet lukt.",
  pad: 8,
  tooltipBelow: false,
};

const ADD_MANUAL_STEP = {
  target: '[data-tour="product-name"]',
  action: "product-created" as TourAction,
  title: "Vul de productnaam in",
  description: "Begin met de naam. Daarna wijzen we je naar de knop om het product op te slaan.",
  pad: 8,
  tooltipBelow: false,
};

const ADD_RECEIPT_STEP = {
  target: '[data-tour="add-scan-action"]',
  action: "product-created" as TourAction,
  title: "Maak een foto van de bon",
  description: "Kies Foto nemen of upload een afbeelding. Herkenning mislukt? Kies Handmatig invoeren.",
  pad: 8,
  tooltipBelow: false,
};

const ADD_BARCODE_STEP = {
  target: '[data-tour="add-scan-action"]',
  action: "product-created" as TourAction,
  title: "Scan een barcode",
  description: "Richt de camera op de barcode. Werkt scannen niet, kies dan Handmatig invoeren.",
  pad: 8,
  tooltipBelow: false,
};

const ADD_SAVE_STEP = {
  target: '[data-tour="save-product"]',
  action: "product-created" as TourAction,
  title: "Sla je product op",
  description: "Kies eventueel de hoeveelheid en bewaarlocatie. Tik daarna op Item opslaan.",
  pad: 8,
  tooltipBelow: false,
  tooltipTop: true,
};

type TourMode =
  | "add"
  | "add-options"
  | "add-manual"
  | "add-receipt"
  | "add-barcode"
  | "add-save"
  | "swipe";
const SWIPE_STEP = {
  target: '[data-tour="swipe-target"]',
  action: "swipe" as TourAction,
  title: "Probeer een veegactie",
  description: "Veeg het gemarkeerde product naar links om de beschikbare acties te zien.",
  pad: 8,
  tooltipBelow: true,
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

interface TourStep {
  target: string;
  action: TourAction;
  title: string;
  description: string;
  pad: number;
  tooltipBelow: boolean;
  tooltipTop?: boolean;
}

/**
 * The first match that is actually on screen. The + button exists twice - once
 * in the desktop sidebar, once above the phone tab bar - and the copy for the
 * other screen size measures 0x0. Taking the first match blindly pointed the
 * tour at the hidden one and reported the + as "not visible" on a phone.
 */
function findTarget(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (window.getComputedStyle(el).visibility === "hidden") continue;
    return el;
  }
  return null;
}

function measure(selector: string, pad: number): Rect | null {
  const el = findTarget(selector);
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
  const [hasMeasured, setHasMeasured] = useState(false);
  const [targetFound, setTargetFound] = useState(false);
  const [targetInView, setTargetInView] = useState(false);
  const [tooltipTop, setTooltipTop] = useState(16);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const current: TourStep = mode === "add"
    ? ADD_STEP
    : mode === "add-options"
      ? ADD_OPTIONS_STEP
      : mode === "add-manual"
        ? ADD_MANUAL_STEP
        : mode === "add-receipt"
          ? ADD_RECEIPT_STEP
          : mode === "add-barcode"
            ? ADD_BARCODE_STEP
            : mode === "add-save"
              ? ADD_SAVE_STEP
              : SWIPE_STEP;
  const compactTooltip =
    mode === "add-options" ||
    mode === "add-manual" ||
    mode === "add-receipt" ||
    mode === "add-barcode" ||
    mode === "add-save";
  const onboardingStep =
    mode === "add"
      ? 1
      : mode === "add-options"
        ? 2
        : mode === "add-manual" || mode === "add-receipt" || mode === "add-barcode"
          ? 3
          : mode === "add-save"
            ? 4
            : 5;

  useEffect(() => {
    setVisible(false);
    setHasMeasured(false);
    const run = () => {
      const target = findTarget(current.target);
      const nextRect = target ? measure(current.target, current.pad) : null;
      setHasMeasured(true);
      setTargetFound(!!nextRect);
      setRect((previous) => {
        if (
          previous &&
          nextRect &&
          previous.x === nextRect.x &&
          previous.y === nextRect.y &&
          previous.w === nextRect.w &&
          previous.h === nextRect.h
        ) {
          return previous;
        }
        return nextRect;
      });

      if (!target || !nextRect) {
        setTargetInView(false);
        setVisible(true);
        return;
      }
      const bounds = target.getBoundingClientRect();
      setTargetInView(
        bounds.bottom > 0 &&
          bounds.top < window.innerHeight &&
          bounds.right > 0 &&
          bounds.left < window.innerWidth,
      );
      requestAnimationFrame(() => setVisible(true));
    };
    run();
    const timers = [150, 350, 650].map((delay) => window.setTimeout(run, delay));
    let frame = 0;
    const scheduleRun = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    };
    const resizeObserver = new ResizeObserver(scheduleRun);
    const observeTarget = () => {
      resizeObserver.disconnect();
      const target = findTarget(current.target);
      if (target) resizeObserver.observe(target);
      scheduleRun();
    };
    const mutationObserver = new MutationObserver(observeTarget);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleRun);
    window.addEventListener("scroll", scheduleRun, true);
    return () => {
      timers.forEach(window.clearTimeout);
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleRun);
      window.removeEventListener("scroll", scheduleRun, true);
    };
  }, [mode, current.target, current.pad]);

  useLayoutEffect(() => {
    if (!hasMeasured) return;

    const positionTooltip = () => {
      const cardHeight = tooltipRef.current?.getBoundingClientRect().height;
      if (!cardHeight) return;

      const margin = 16;
      if (current.tooltipTop) {
        setTooltipTop(margin);
        return;
      }
      if (!targetInView || !rect) {
        setTooltipTop(Math.max(margin, (window.innerHeight - cardHeight) / 2));
        return;
      }
      const gap = compactTooltip ? 6 : 20;
      const availableAbove = rect.y - margin;
      const availableBelow = window.innerHeight - (rect.y + rect.h) - margin;
      const fitsAbove = availableAbove >= cardHeight + gap;
      const fitsBelow = availableBelow >= cardHeight + gap;

      let top: number;
      if (!current.tooltipBelow && fitsAbove) {
        top = rect.y - cardHeight - gap;
      } else if (current.tooltipBelow && fitsBelow) {
        top = rect.y + rect.h + gap;
      } else if (fitsAbove) {
        top = rect.y - cardHeight - gap;
      } else if (fitsBelow) {
        top = rect.y + rect.h + gap;
      } else {
        const idealTop =
          availableAbove >= availableBelow
            ? rect.y - cardHeight - gap
            : rect.y + rect.h + gap;
        top = Math.min(
          window.innerHeight - cardHeight - margin,
          Math.max(margin, idealTop),
        );
      }

      setTooltipTop(top);
    };

    positionTooltip();
    const observer = new ResizeObserver(positionTooltip);
    if (tooltipRef.current) observer.observe(tooltipRef.current);
    window.addEventListener("resize", positionTooltip);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionTooltip);
    };
  }, [compactTooltip, current.tooltipBelow, current.tooltipTop, hasMeasured, rect, targetInView]);

  useEffect(() => {
    const pendingRefreshes: number[] = [];
    const refreshTarget = () => {
      const r = measure(current.target, current.pad);
      if (r) {
        setRect(r);
        setTargetFound(true);
        const target = findTarget(current.target);
        if (target) {
          const bounds = target.getBoundingClientRect();
          setTargetInView(
            bounds.bottom > 0 &&
              bounds.top < window.innerHeight &&
              bounds.right > 0 &&
              bounds.left < window.innerWidth,
          );
        }
        requestAnimationFrame(() => setVisible(true));
      }
    };
    const handleAction = (event: Event) => {
      const { action } = (event as CustomEvent<TourActionDetail>).detail;
      if (action === "add-target-changed") {
        [150, 350, 650].forEach((delay) => {
          pendingRefreshes.push(window.setTimeout(refreshTarget, delay));
        });
        return;
      }
      if (action !== current.action) return;
      if (mode !== "swipe") return;
      onDone();
    };
    document.addEventListener("tour-action", handleAction);
    return () => {
      document.removeEventListener("tour-action", handleAction);
      pendingRefreshes.forEach(window.clearTimeout);
    };
  }, [current.action, mode, onDone]);

  if (!hasMeasured) return null;

  return (
    <>
      {targetInView && rect && (
        <>
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
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
            </svg>
          </div>

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
        </>
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={`fixed z-[62] left-4 right-4 pointer-events-auto transition-[opacity,transform] duration-300 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
        style={{ top: tooltipTop }}
      >
        <OnboardingCard
          step={onboardingStep}
          totalSteps={TOUR_STEP_COUNT}
          progressLabel="Rondleiding"
          compact={compactTooltip}
        >
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            {mode === "swipe" ? "Daarna dit" : "Eerst dit"}
          </p>
          <h3 className="font-bold text-base leading-snug text-foreground mb-1">{current.title}</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{current.description}</p>
          {!targetFound && (
            <p role="status" className="mb-4 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
              Dit onderdeel is hier niet zichtbaar. Je kunt de app blijven gebruiken of de rondleiding overslaan.
            </p>
          )}
          {targetFound && !targetInView && mode === "swipe" && (
            <p role="status" className="mb-4 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
              Het product staat buiten beeld. Scroll naar het gemarkeerde product; deze uitleg blijft zichtbaar.
            </p>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onDone}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "swipe" ? "Verder zonder veegactie" : "Rondleiding overslaan"}
            </button>
            <p className="text-sm font-semibold text-primary text-right">
              {mode === "add"
                ? "Tik op +"
                : mode === "add-options"
                  ? "Kies een invoermethode"
                  : mode === "add-manual"
                    ? "Vul de productnaam in"
                    : mode === "add-receipt"
                      ? "Kies een foto of upload"
                      : mode === "add-barcode"
                        ? "Richt op de barcode"
                        : mode === "add-save"
                          ? "Tik op Item opslaan"
                          : "Veeg naar links om verder te gaan"}
            </p>
          </div>
        </OnboardingCard>
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
