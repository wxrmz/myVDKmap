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
      // The page itself dims to dark, switches, brightens back. Timers, not animation events: it always comes back.
      const root = document.documentElement;
      const fade = (brightness: number, ms: number) => {
        root.style.transition = `filter ${ms}ms ease-in-out`;
        root.style.filter = `brightness(${brightness})`;
        return new Promise((r) => setTimeout(r, ms));
      };
      try {
        root.style.filter = "brightness(1)";
        root.getBoundingClientRect(); // commit the start so the transition runs
        await fade(0, 220);
        await apply();
        await fade(1, 280);
      } finally {
        root.style.transition = "";
        root.style.filter = "";
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
