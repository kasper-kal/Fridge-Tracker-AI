import { useState } from "react";
import { ShoppingCart, Refrigerator, ChevronRight } from "lucide-react";

const STORY_KEY = "fridge_onboarding_seen";
export const ONBOARDING_RESTART_EVENT = "restart-onboarding";

export function requestOnboardingReplay() {
  document.dispatchEvent(new Event(ONBOARDING_RESTART_EVENT));
}

export function hasSeenOnboarding() {
  return !!localStorage.getItem(STORY_KEY);
}

const slides = [
  {
    icon: <ShoppingCart className="h-5 w-5 text-amber-500" />,
    iconBg: "bg-amber-400/15",
    eyebrow: "Herken je dit?",
    title: "Nooit meer twijfelen in de winkel.",
    body: "Je ziet meteen wat er thuis nog ligt \u2014 en wat je moet halen.",
    cta: "Volgende",
  },
  {
    icon: <Refrigerator className="h-5 w-5 text-primary" />,
    iconBg: "bg-primary/10",
    eyebrow: "Zo werkt het",
    title: "Bon scannen, klaar.",
    body: "Scan een kassabon of barcode en je voorraad staat erin. Delen met huisgenoten kan ook.",
    cta: "Start de rondleiding",
  },
];

export function OnboardingSlides({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);

  const current = slides[index];
  const isLast = index === slides.length - 1;

  const markSeen = () => {
    localStorage.setItem(STORY_KEY, "1");
  };

  const next = () => {
    if (isLast) {
      markSeen();
      onDone();
    } else {
      setIndex(1);
    }
  };

  const skip = () => {
    markSeen();
    onSkip();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40"
      onClick={skip}
    >
      <section
        role="dialog"
        aria-label={`Introductie, ${index + 1} van ${slides.length}`}
        onClick={(event) => event.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-[28px] border-t border-border bg-card p-5 pb-safe shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.45)] lg:mb-8 lg:rounded-[28px] lg:border"
      >
        <div className="mb-4 flex gap-1.5" aria-hidden="true">
          {slides.map((_, position) => (
            <span
              key={position}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                position === index ? "bg-primary" : position < index ? "bg-primary/35" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${current.iconBg}`}>
            {current.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {current.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-bold leading-snug text-foreground">
              {current.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {current.body}
            </p>
          </div>
        </div>

        <button
          onClick={next}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[.98]"
        >
          {current.cta}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          onClick={skip}
          className="mt-1 w-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Intro overslaan
        </button>
      </section>
    </div>
  );
}
