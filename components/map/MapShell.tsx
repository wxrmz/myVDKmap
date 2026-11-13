"use client";

// App shell (§5.1): rail / tab bar, the map beside the rail, the panel with search on map pages,
// flow pages (/report, /bill, /changes, /me) as an overlay over the map.
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useFontScale } from "@/components/cabinet/shared";
import { MapView } from "@/components/map/MapView";
import { PanelSheet } from "@/components/panel/PanelSheet";
import { useSession } from "@/lib/session";
import { useMap } from "./MapContext";
import { isMapPath, Rail, TabBar } from "./Rail";

const PHONE = "(max-width: 767.98px)";
const subscribePhone = (cb: () => void) => {
  const mq = matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const FLOW_WIDTH = 680;

export function MapShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Server and hydration render the desktop layout; phones switch right after hydration (under the splash).
  const mobile = useSyncExternalStore(subscribePhone, () => matchMedia(PHONE).matches, () => false);
  useFontScale();
  useSession(); // loads the session once, so a signed-in cabinet syncs on any page
  return (
    <>
      <Rail />
      <MapView className="bottom-16 md:bottom-0 md:left-[88px]" />
      {isMapPath(pathname) ? (
        <PanelSheet mobile={mobile}>{children}</PanelSheet>
      ) : (
        <FlowOverlay mobile={mobile}>{children}</FlowOverlay>
      )}
      <TabBar />
    </>
  );
}

/** Desktop: a wide card right of the rail, the map stays visible beside it. Phone: a full-screen sheet above the tab bar. */
function FlowOverlay({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  const { setInsets } = useMap();
  useEffect(() => {
    if (!mobile) setInsets({ top: 0, right: 0, bottom: 40, left: Math.min(FLOW_WIDTH, innerWidth - 120) + 32 });
  }, [mobile, setInsets]);

  if (mobile)
    return (
      // While the report wizard takes a point (`data-map-pick` on <html>), the sheet steps aside to show the map.
      <section
        aria-label="Раздел"
        className="fixed inset-x-0 top-0 bottom-16 z-20 overflow-y-auto overscroll-contain bg-background animate-in fade-in slide-in-from-bottom-4 duration-200 [[data-map-pick]_&]:invisible"
      >
        {children}
      </section>
    );
  return (
    <div className="pointer-events-none fixed inset-y-0 left-[88px] z-20 flex p-4">
      <section
        aria-label="Раздел"
        style={{ width: `min(${FLOW_WIDTH}px, calc(100vw - 120px))` }}
        className="pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-background shadow-lg ring-1 ring-border animate-in fade-in slide-in-from-left-2 duration-200"
      >
        {children}
      </section>
    </div>
  );
}
