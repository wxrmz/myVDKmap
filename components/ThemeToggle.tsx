"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `theme:switch` event detail: listeners push a promise into `waits` that resolves when they are ready. */
export type ThemeSwitchDetail = { theme: "light" | "dark"; waits: Promise<unknown>[] };

const noopSubscribe = () => () => {};
let switching = false;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  async function toggle() {
    if (switching) return;
    switching = true;
    const next = isDark ? "light" : "dark";
    // Map first (it pushes "style applied" into `waits`), then the page; the screen is dark meanwhile.
    const apply = async () => {
      const waits: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next, waits } }));
      flushSync(() => setTheme(next));
      await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 600))]);
    };
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return await apply();
      // Fade the whole page to black, switch, fade back.
      // Timers, not animation events: the veil always goes away, even if the tab stops painting.
      const veil = document.createElement("div");
      veil.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#000;opacity:0;pointer-events:none";
      document.body.append(veil);
      const fade = (to: number, ms: number) => {
        veil.style.transition = `opacity ${ms}ms ease-in-out`;
        veil.getBoundingClientRect(); // commit the start opacity so the transition runs
        veil.style.opacity = String(to);
        return new Promise((r) => setTimeout(r, ms));
      };
      try {
        await fade(1, 220);
        await apply();
        await fade(0, 280);
      } finally {
        veil.remove();
      }
    } finally {
      switching = false;
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Сменить тему"
      onClick={toggle}
      className={cn("relative size-11 rounded-full [&_svg:not([class*='size-'])]:size-5", className)}
    >
      {mounted && (
        <AnimatePresence initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </motion.span>
        </AnimatePresence>
      )}
    </Button>
  );
}
