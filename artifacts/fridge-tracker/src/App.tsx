import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser as useClerkUser } from "@clerk/react";
import { nlNL } from "@clerk/localizations";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Link } from "wouter";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HouseholdProvider } from "@/context/household-context";
import { ProductsProvider } from "@/context/products-context";
import { ShoppingListProvider } from "@/context/shopping-list-context";
import { UserProvider } from "@/context/user-context";
import { ThemeProvider } from "@/context/theme-context";
import { useUser } from "@/context/user-context";
import { useEffect, useState, type ReactNode } from "react";
import { hasSeenOnboarding, OnboardingSlides, ONBOARDING_RESTART_EVENT } from "@/components/onboarding-slides";
import { UndoRedoBar } from "@/components/undo-redo-bar";
import { CookieBanner } from "@/components/cookie-banner";
import { UserSetupModal } from "@/components/user-setup-modal";
import { BannedScreen } from "@/components/banned-screen";
import { SignedOutGate, hasChosenGuestMode, rememberGuestMode } from "@/components/auth-gate";
import { DeveloperPanel } from "@/components/developer-panel";
import { TourOverlay, TOUR_SEEN_KEY, signalTourAction } from "@/components/tour";
import type { TourActionDetail } from "@/components/tour";
import NotFound from "@/pages/not-found";
import FridgePage from "@/pages/fridge";
import FreezerPage from "@/pages/freezer";
import PantryPage from "@/pages/pantry";
import AccountPage from "@/pages/account";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import DeletedPage from "@/pages/deleted";
import HelpPage from "@/pages/help";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkConfigured = Boolean(clerkPubKey);
const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#174a8b",
    colorText: "#172033",
    borderRadius: "1rem",
  },
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={FridgePage} />
      <Route path="/freezer" component={FreezerPage} />
      <Route path="/pantry" component={PantryPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/deleted" component={DeletedPage} />
      <Route path="/help" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function TourNavigation({ active }: { active: boolean }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleProductCreated = (event: Event) => {
      const { action, storageLocation } =
        (event as CustomEvent<TourActionDetail>).detail;
      if (!active || action !== "product-created" || !storageLocation) return;

      const pathByLocation = {
        fridge: "/",
        freezer: "/freezer",
        pantry: "/pantry",
      };
      setLocation(pathByLocation[storageLocation]);
    };

    document.addEventListener("tour-action", handleProductCreated);
    return () => document.removeEventListener("tour-action", handleProductCreated);
  }, [active, setLocation]);

  return null;
}

function AppInner() {
  const { isBanned, isRegistered, isLoading } = useUser();
  const { isLoaded: isClerkLoaded, isSignedIn } = useClerkUser();
  const [guestMode, setGuestMode] = useState(hasChosenGuestMode);

  const [phase, setPhase] = useState<
    | "none"
    | "story"
    | "add"
    | "add-options"
    | "adding-manual"
    | "adding-receipt"
    | "adding-barcode"
    | "add-save"
    | "swipe"
    | "setup"
    | "done"
  >(() => {
    if (!hasSeenOnboarding()) return "story";
    if (!localStorage.getItem(TOUR_SEEN_KEY)) return "add";
    return "none";
  });

  useEffect(() => {
    if (phase === "none") {
      setPhase(isRegistered ? "done" : "setup");
    } else if (phase === "setup" && isRegistered) {
      setPhase("done");
    }
  }, [isRegistered, phase]);

  useEffect(() => {
    const handleTourAction = (event: Event) => {
      const { action } = (event as CustomEvent<TourActionDetail>).detail;
      if (action === "add" && phase === "add") setPhase("add-options");
      if (action === "add-manual-chosen" && (
        phase === "add-options" || phase === "adding-receipt" || phase === "adding-barcode"
      )) setPhase("adding-manual");
      if (action === "add-receipt-chosen" && phase === "add-options") setPhase("adding-receipt");
      if (action === "add-barcode-chosen" && phase === "add-options") setPhase("adding-barcode");
      if (action === "add-prefilled" && (
        phase === "add-options" || phase === "adding-receipt" || phase === "adding-barcode"
      )) setPhase("add-save");
      if (action === "add-name-ready" && phase === "adding-manual") setPhase("add-save");
      if (action === "add-name-cleared" && phase === "add-save") setPhase("adding-manual");
      if (action === "add-save-ready" && (
        phase === "adding-receipt" || phase === "adding-barcode"
      )) setPhase("add-save");
      if (action === "add-menu" && (
        phase === "adding-manual" ||
        phase === "adding-receipt" ||
        phase === "adding-barcode" ||
        phase === "add-save"
      )) setPhase("add-options");
      if (action === "product-created" && (
        phase === "adding-manual" ||
        phase === "adding-receipt" ||
        phase === "adding-barcode" ||
        phase === "add-save" ||
        phase === "add-options"
      )) setPhase("swipe");
      if (action === "add-closed" && (
        phase === "adding-manual" ||
        phase === "adding-receipt" ||
        phase === "adding-barcode" ||
        phase === "add-save" ||
        phase === "add-options"
      )) setPhase("add");
    };
    document.addEventListener("tour-action", handleTourAction);
    return () => document.removeEventListener("tour-action", handleTourAction);
  }, [phase]);

  const finishTour = () => {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    signalTourAction("tour-finished");
    setPhase("setup");
  };

  useEffect(() => {
    const restart = () => {
      localStorage.removeItem("fridge_onboarding_seen");
      localStorage.removeItem(TOUR_SEEN_KEY);
      setPhase("story");
    };
    document.addEventListener(ONBOARDING_RESTART_EVENT, restart);
    return () => document.removeEventListener(ONBOARDING_RESTART_EVENT, restart);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground grid place-items-center">
        <div className="text-sm text-muted-foreground">Account laden…</div>
      </div>
    );
  }
  // Nobody signed in and no profile on this device: offer a real sign-in path
  // instead of dropping straight into "create a brand new profile". Without a
  // Clerk key there is no sign-in to offer, so the app keeps its old behaviour.
  if (clerkConfigured && isClerkLoaded && !isSignedIn && !isRegistered && !guestMode) {
    return (
      <SignedOutGate
        onContinueAsGuest={() => {
          rememberGuestMode();
          setGuestMode(true);
        }}
      />
    );
  }
  if (isBanned) return <BannedScreen />;
  const onboardingPhase = [
    "story",
    "add",
    "add-options",
    "adding-manual",
    "adding-receipt",
    "adding-barcode",
    "add-save",
    "swipe",
    "setup",
  ].includes(phase);

  return (
    <>
      <Router />
      <TourNavigation
        active={
          phase === "add-options" ||
          phase === "adding-manual" ||
          phase === "adding-receipt" ||
          phase === "adding-barcode" ||
          phase === "add-save"
        }
      />
      {!onboardingPhase && <UndoRedoBar />}
      {!onboardingPhase && (
        <Toaster position="top-center" offset={{ top: "12px" }} mobileOffset={{ top: "12px" }} />
      )}
      {phase === "done" && <CookieBanner />}
      <DeveloperPanel />

      {phase === "story" && (
        <OnboardingSlides
          onDone={() => {
            setPhase("add");
          }}
          onSkip={() => setPhase("add")}
        />
      )}

      {phase === "add" && <TourOverlay mode="add" onDone={finishTour} />}
      {phase === "add-options" && <TourOverlay mode="add-options" onDone={finishTour} />}
      {phase === "adding-manual" && <TourOverlay mode="add-manual" onDone={finishTour} />}
      {phase === "adding-receipt" && <TourOverlay mode="add-receipt" onDone={finishTour} />}
      {phase === "adding-barcode" && <TourOverlay mode="add-barcode" onDone={finishTour} />}
      {phase === "add-save" && <TourOverlay mode="add-save" onDone={finishTour} />}
      {phase === "swipe" && <TourOverlay mode="swipe" onDone={finishTour} />}

      {phase === "setup" && (
        <UserSetupModal />
      )}
    </>
  );
}

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <ThemeProvider>
            <HouseholdProvider>
              <ShoppingListProvider>
                <ProductsProvider>
                  <AppInner />
                </ProductsProvider>
              </ShoppingListProvider>
            </HouseholdProvider>
          </ThemeProvider>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AuthPage({ children }: { children: ReactNode }) {
  // Email, phone, username and social buttons make Clerk's card tall, so this
  // page scrolls instead of centring the card off both edges of the screen.
  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-background text-foreground">
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-10">
        <Link href="/" className="text-sm font-semibold text-primary">
          Terug naar de koelkast
        </Link>
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${appBase}/sign-in`}
      signUpUrl={`${appBase}/sign-up`}
      signInFallbackRedirectUrl={`${appBase}/`}
      signUpFallbackRedirectUrl={`${appBase}/`}
      localization={nlNL}
      appearance={clerkAppearance}
    >
      <WouterRouter base={appBase}>
        <Switch>
          <Route path="/sign-in/*?">
            <AuthPage>
              <SignIn
                routing="path"
                path={`${appBase}/sign-in`}
                signUpUrl={`${appBase}/sign-up`}
              />
            </AuthPage>
          </Route>
          <Route path="/sign-up/*?">
            <AuthPage>
              <SignUp
                routing="path"
                path={`${appBase}/sign-up`}
                signInUrl={`${appBase}/sign-in`}
              />
            </AuthPage>
          </Route>
          <Route>
            <AppProviders />
          </Route>
        </Switch>
      </WouterRouter>
    </ClerkProvider>
  );
}

export default App;
