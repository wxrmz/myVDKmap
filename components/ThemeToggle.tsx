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

  function toggle() {
    if (switching) return;
    const next = isDark ? "light" : "dark";
    // Map first (it pushes "style applied" into `waits`), then the page.
    const apply = async () => {
      const waits: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next, waits } }));
      flushSync(() => setTheme(next));
      await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 300))]);
    };
    // Every colour, the map included, crossfades from the old theme to the new one (CSS in globals.css).
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return void apply();
    switching = true;
    const transition = document.startViewTransition(apply);
    transition.ready.catch(() => {}); // a skipped transition rejects `ready`; the theme is applied anyway
    transition.finished.finally(() => (switching = false));
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Сменить тему"
      // Starts on press, not release: the ~50 ms the map needs for its new style pass while the button is still held.
      onPointerDown={(e) => e.button === 0 && e.isPrimary && toggle()}
      // Keyboard (Enter / Space) has no pointerdown; its click comes with detail 0.
      onClick={(e) => e.detail === 0 && toggle()}
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
