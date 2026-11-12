"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const HIDDEN_ON = ["/bill", "/changes", "/report", "/me"];
const MIN_MS = 700;
const MAX_MS = 6000;

/** Server-rendered splash (§5.10): bar fill is pure CSS; JS only finishes it on `map:ready` or after 6 s. */
export function Splash() {
  const pathname = usePathname();
  // Decided once: client navigation to the map later must not bring the splash back.
  const [gone, setGone] = useState(() => HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gone) return;
    let started = false;
    const finish = async () => {
      if (started) return;
      started = true;
      const root = rootRef.current;
      const fill = fillRef.current;
      if (!root || !fill) return;
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - performance.now())));
      setReady(true);
      await fill.animate(
        [{ transform: getComputedStyle(fill).transform }, { transform: "scaleX(1)" }],
        { duration: 280, easing: "ease-out", fill: "forwards" },
      ).finished;
      await root.animate(
        [
          { opacity: 1, transform: "scale(1)", filter: "blur(0)" },
          { opacity: 0, transform: "scale(1.03)", filter: "blur(8px)" },
        ],
        { duration: 450, easing: "ease-in", fill: "forwards" },
      ).finished;
      setGone(true);
    };
    const timer = setTimeout(finish, Math.max(0, MAX_MS - performance.now()));
    window.addEventListener("map:ready", finish);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("map:ready", finish);
    };
  }, [gone]);

  if (gone) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-4 text-foreground"
    >
      <div className="text-4xl font-semibold tracking-tight">Мой дом</div>
      <div className="mt-1 text-lg text-muted-foreground">Владивосток</div>
      <div className="mt-6 h-1.5 w-72 max-w-full overflow-hidden rounded-full bg-foreground/10">
        <div ref={fillRef} className="splash-fill h-full w-full rounded-full bg-foreground" />
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{ready ? "Готово" : "Загружаем карту города…"}</div>
    </div>
  );
}
