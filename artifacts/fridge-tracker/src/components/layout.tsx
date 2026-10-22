import { ReactNode, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { NetworkIndicator } from "./network-indicator";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 65;
const EDGE_THRESHOLD = 50;
const SWIPE_MIN = 80;
const BOTTOM_ZONE = 130;

const TAB_ORDER = ["/", "/pantry", "/freezer"];

interface LayoutProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
}

export function Layout({ children, onRefresh }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const [location, navigate] = useLocation();

  const touchStartY = useRef<number | null>(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const gestureStartX = useRef<number | null>(null);
  const gestureStartY = useRef<number | null>(null);
  const gestureType = useRef<"nav-left" | "nav-right" | "add-modal" | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const { clientX, clientY } = touch;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      gestureStartX.current = clientX;
      gestureStartY.current = clientY;

      if (clientX < EDGE_THRESHOLD) {
        gestureType.current = "nav-left";
      } else if (clientX > winW - EDGE_THRESHOLD) {
        gestureType.current = "nav-right";
      } else if (clientY > winH - BOTTOM_ZONE) {
        gestureType.current = "add-modal";
      } else {
        gestureType.current = null;
      }

      if (!onRefresh) return;
      const el = mainRef.current;
      if (el && el.scrollTop === 0) {
        touchStartY.current = clientY;
      }
    },
    [onRefresh]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!onRefresh || touchStartY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        setPullY(Math.min(dy * 0.45, PULL_THRESHOLD + 20));
      }
    },
    [onRefresh, refreshing]
  );

  const handleTouchEnd = useCallback(
    async (e: React.TouchEvent) => {
      if (onRefresh && touchStartY.current !== null) {
        touchStartY.current = null;
        if (pullY >= PULL_THRESHOLD && !refreshing) {
          setRefreshing(true);
          setPullY(PULL_THRESHOLD);
          try { await onRefresh(); } catch {}
          setRefreshing(false);
        }
        setPullY(0);
      }

      if (
        gestureStartX.current === null ||
        gestureStartY.current === null ||
        !gestureType.current
      )
        return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - gestureStartX.current;
      const dy = touch.clientY - gestureStartY.current;
      const type = gestureType.current;

      gestureStartX.current = null;
      gestureStartY.current = null;
      gestureType.current = null;

      if (
        (type === "nav-left" || type === "nav-right") &&
        Math.abs(dx) > SWIPE_MIN &&
        Math.abs(dy) < Math.abs(dx) * 0.7
      ) {
        const idx = TAB_ORDER.indexOf(location);
        if (idx === -1) return;
        if (dx > 0 && idx > 0) navigate(TAB_ORDER[idx - 1]);
        else if (dx < 0 && idx < TAB_ORDER.length - 1) navigate(TAB_ORDER[idx + 1]);
      } else if (
        type === "add-modal" &&
        dy < -SWIPE_MIN &&
        Math.abs(dy) > Math.abs(dx) * 1.2
      ) {
        document.dispatchEvent(new CustomEvent("open-add-modal"));
      }
    },
    [onRefresh, pullY, refreshing, location, navigate]
  );

  const showIndicator = pullY > 8 || refreshing;

  return (
    <div className="app-shell min-h-[100dvh] lg:h-[100dvh] bg-background relative flex flex-col lg:flex-row overflow-hidden">
      <NetworkIndicator />
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
      {onRefresh && showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-end z-30 pointer-events-none"
          style={{ height: refreshing ? PULL_THRESHOLD : pullY }}
        >
          <div className="pb-2">
            <RefreshCw
              className={`w-5 h-5 text-primary transition-all ${
                refreshing ? "animate-spin" : "opacity-70"
              }`}
              style={{
                transform: refreshing
                  ? undefined
                  : `rotate(${Math.min((pullY / PULL_THRESHOLD) * 360, 360)}deg)`,
              }}
            />
          </div>
        </div>
      )}

      <main
        ref={mainRef}
        className="flex-1 pb-24 lg:pb-12 overflow-y-auto custom-scrollbar"
        style={{
          paddingTop: showIndicator ? (refreshing ? PULL_THRESHOLD : pullY) : 0,
          transition:
            pullY === 0 ? "padding-top 0.3s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
      <BottomNav />
      </div>
    </div>
  );
}
