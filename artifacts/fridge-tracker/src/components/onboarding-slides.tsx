import { useState } from "react";
import { ShoppingCart, Refrigerator, ChevronRight } from "lucide-react";
import { OnboardingCard } from "@/components/onboarding-card";

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
    icon: <ShoppingCart className="w-10 h-10 text-amber-400" />,
    iconBg: "bg-amber-400/15",
    eyebrow: "Herken je dit?",
    title: "Je staat in de supermarkt.",
    body: "Maar moet je nou wel of niet melk halen? Is er nog genoeg brood thuis? En die soep van vorige week \u2014 weg of niet?",
    cta: "Volgende",
  },
  {
    icon: <Refrigerator className="w-10 h-10 text-primary" />,
    iconBg: "bg-primary/10",
    eyebrow: "De oplossing",
    title: "Koelkast Tracker weet het voor je.",
    body: "Altijd precies zien wat je thuis hebt \u2014 nooit meer dubbele boodschappen of lege koelkast momenten.",
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
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/[.78] p-4 backdrop-blur-sm sm:p-6">
      <OnboardingCard
        step={index + 1}
        totalSteps={slides.length}
        progressLabel="Introductie"
      >
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl ${current.iconBg}`}>
            {current.icon}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            {current.eyebrow}
          </p>
          <h1 className="text-3xl font-bold leading-tight text-foreground">
            {current.title}
          </h1>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-muted-foreground">
            {current.body}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[.98]"
          >
            {current.cta}
            {!isLast && <ChevronRight className="h-5 w-5" />}
          </button>
          {!isLast && (
            <button
              onClick={skip}
              className="w-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Intro overslaan
            </button>
          )}
          {isLast && (
            <button
              onClick={skip}
              className="w-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Intro overslaan
            </button>
          )}
        </div>
      </OnboardingCard>
    </div>
  );
}
