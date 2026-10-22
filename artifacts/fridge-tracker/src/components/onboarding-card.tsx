import type { ReactNode } from "react";

export function OnboardingCard({
  step,
  totalSteps,
  progressLabel = "Rondleiding",
  children,
  compact = false,
}: {
  step?: number;
  totalSteps?: number;
  progressLabel?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const showProgress = step !== undefined && totalSteps !== undefined;

  return (
    <section
      role="region"
      aria-label={
        showProgress
          ? `${progressLabel}, ${step} van ${totalSteps}`
          : "Onboarding"
      }
      className={`mx-auto w-full max-w-[360px] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card rounded-3xl ${
        compact ? "p-4" : "p-5"
      } shadow-2xl border border-border`}
    >
      {showProgress && (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {progressLabel} · {step}/{totalSteps}
          </p>
          <div
            role="progressbar"
            aria-label={`${progressLabel}, ${step} van ${totalSteps}`}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-valuenow={step}
            aria-valuetext={`${progressLabel}, ${step} van ${totalSteps}`}
            className="flex gap-1.5"
          >
            {Array.from({ length: totalSteps }, (_, index) => {
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
        </div>
      )}
      {children}
    </section>
  );
}