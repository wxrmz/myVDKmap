"use client";

// App shell (§5.1): rail / tab bar, the map beside the rail, the panel with search on map pages.
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MapView } from "@/components/map/MapView";
import { PanelSheet } from "@/components/panel/PanelSheet";
import { isMapPath, Rail, TabBar } from "./Rail";

const PHONE = "(max-width: 767.98px)";
const subscribePhone = (cb: () => void) => {
  const mq = matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function MapShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Server and hydration render the desktop layout; phones switch right after hydration (under the splash).
  const mobile = useSyncExternalStore(subscribePhone, () => matchMedia(PHONE).matches, () => false);
  return (
    <>
      <Rail />
      <MapView className="bottom-16 md:bottom-0 md:left-[88px]" />
      {isMapPath(pathname) ? <PanelSheet mobile={mobile}>{children}</PanelSheet> : children}
      <TabBar />
    </>
  );
}
