"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `theme:switch` event detail: the map pushes into `waits` a promise that resolves once it has redrawn in the new theme
 * under a still of itself, with a function that takes the still away.
 */
export type ThemeSwitchDetail = { theme: "light" | "dark"; waits: Promise<() => void>[] };

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  async function toggle(button: HTMLButtonElement) {
    const next = isDark ? "light" : "dark";
    const rect = button.getBoundingClientRect();
    // Map first: it redraws hidden under a still of itself. Then the page, with the still taken away in the same step,
    // so the circle opens on the new page and the new map together.
    const waits: Promise<() => void>[] = [];
    window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next, waits } }));
    const reveals = await Promise.all(waits);
    const apply = () => {
      flushSync(() => setTheme(next));
      reveals.forEach((reveal) => reveal());
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return apply();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    await transition.ready;
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Сменить тему"
      // Starts on press, not release: the ~50 ms the map needs for its new style pass while the button is still held.
      onPointerDown={(e) => e.button === 0 && e.isPrimary && toggle(e.currentTarget)}
      // Keyboard (Enter / Space) has no pointerdown; its click comes with detail 0.
      onClick={(e) => e.detail === 0 && toggle(e.currentTarget)}
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
