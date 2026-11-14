"use client";

// Panel of the map pages (§5.1): desktop — 384 px column (search width) over the map under the search;
// phone — bottom sheet with 3 snap points (100 px, opened by level, 64 px from the top), dragged by the handle.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { useMap, type MapLevel } from "@/components/map/MapContext";
import { MapControls } from "@/components/map/MapControls";

const TAB_BAR = 48; // h-12 of TabBar (components/map/Rail.tsx)
const COLLAPSED = 100;
// Opened: the title and the first block over the map (district figures; a complex's status, address and facts are taller).
const OPENED = (level: MapLevel) => (level === "complex" ? 236 : 200);
const TOP_GAP = 64;
// Room for the search and chips over the phone map, so the camera keeps targets visible.
const MOBILE_TOP = 120;
const DESKTOP_COLUMN = 16 + 384 + 16;

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

function snapsFor(height: number, level: MapLevel) {
  const max = height - TAB_BAR - TOP_GAP;
  return [COLLAPSED, Math.min(OPENED(level), Math.round((height - TAB_BAR) / 2)), max];
}

export function PanelSheet({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  const { setInsets } = useMap();
  useEffect(() => {
    if (!mobile) setInsets({ top: 0, right: 0, bottom: 40, left: DESKTOP_COLUMN });
  }, [mobile, setInsets]);

  if (!mobile)
    return (
      <div className="pointer-events-none fixed inset-y-0 left-[88px] z-20 flex w-[416px] flex-col gap-3 p-4">
        <MapControls mobile={false} />
        <section
          aria-label="Панель"
          className="pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-background shadow-lg ring-1 ring-border"
        >
          {children}
        </section>
      </div>
    );
  return (
    <>
      <MapControls mobile />
      <BottomSheet>{children}</BottomSheet>
    </>
  );
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  const { scene, setInsets } = useMap();
  const [viewport, setViewport] = useState(() => innerHeight);
  const snaps = useMemo(() => snapsFor(viewport, scene.level), [viewport, scene.level]);
  const [index, setIndex] = useState(scene.level === "city" ? 0 : 1);
  const height = useMotionValue(snaps[index]);
  const drag = useRef<{ y: number; h: number; t: number; v: number; moved: boolean } | null>(null);

  const snapTo = useCallback(
    (i: number) => {
      setIndex(i);
      animate(height, snaps[i], { type: "spring", stiffness: 420, damping: 42 });
    },
    [height, snaps],
  );

  useEffect(() => subscribeResize(() => setViewport(innerHeight)), []);
  useEffect(() => {
    // A new viewport or level moves the sheet to its snap.
    animate(height, snaps[index], { type: "spring", stiffness: 420, damping: 42 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `index` is left out: snapTo animates its own changes, a second spring would fight it
  }, [snaps, height]);

  // Collapsed at city level; opened to half when a deeper page appears.
  const level = scene.level;
  const prevLevel = useRef(level);
  useEffect(() => {
    if (prevLevel.current === level) return;
    prevLevel.current = level;
    if (level === "city") snapTo(0);
    else if (index === 0) snapTo(1);
  }, [level, index, snapTo]);

  useEffect(() => {
    setInsets({ top: MOBILE_TOP, right: 0, bottom: snaps[index], left: 0 });
  }, [snaps, index, setInsets]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: height.get(), t: e.timeStamp, v: 0, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const next = Math.min(snaps[2], Math.max(COLLAPSED - 40, d.h - (e.clientY - d.y)));
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (next - height.get()) / dt;
    d.t = e.timeStamp;
    if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
    height.set(next);
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) return snapTo((index + 1) % snaps.length);
    const projected = height.get() + d.v * 180;
    const nearest = snaps.reduce((best, s, i) => (Math.abs(s - projected) < Math.abs(snaps[best] - projected) ? i : best), 0);
    snapTo(nearest);
  }

  return (
    <motion.section
      aria-label="Панель"
      style={{ height, bottom: TAB_BAR }}
      className="fixed inset-x-0 z-20 flex flex-col rounded-t-3xl bg-background shadow-[0_-4px_24px_rgb(0_0_0/0.12)] ring-1 ring-border"
    >
      <button
        type="button"
        aria-label={index === 2 ? "Свернуть панель" : "Развернуть панель"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            snapTo((index + 1) % snaps.length);
          }
        }}
        className="grid h-6 w-full shrink-0 cursor-grab touch-none place-items-center active:cursor-grabbing"
      >
        <span className="h-1.5 w-12 rounded-full bg-foreground/25" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [&>div>div:first-child]:pt-1">{children}</div>
    </motion.section>
  );
}
