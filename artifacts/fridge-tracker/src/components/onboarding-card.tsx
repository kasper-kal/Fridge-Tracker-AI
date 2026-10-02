import type { ReactNode } from "react";

export const ONBOARDING_TOTAL_STEPS = 7;

export function OnboardingCard({
  step,
  children,
  compact = false,
}: {
  step: number;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      role="region"
      aria-label={`Onboarding, stap ${step} van ${ONBOARDING_TOTAL_STEPS}`}
      className={`w-full max-w-[360px] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card rounded-3xl ${
        compact ? "p-4" : "p-5"
      } shadow-2xl border border-border`}
    >
      <div
        role="progressbar"
        aria-label={`Stap ${step} van ${ONBOARDING_TOTAL_STEPS}`}
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_TOTAL_STEPS}
        aria-valuenow={step}
        aria-valuetext={`Stap ${step} van ${ONBOARDING_TOTAL_STEPS}`}
        className="flex gap-1.5 mb-4"
      >
        {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, index) => {
          const position = index + 1;
          return (
            <span
              key={position}
              aria-hidden="true"
              className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                position === step
                  ? "flex-[2] bg-primary"
                  : position < step
                    ? "bg-primary/35"
                    : "bg-border"
              }`}
            />
          );
        })}
      </div>
      {children}
    </section>
  );
}