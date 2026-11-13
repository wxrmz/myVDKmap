"use client";

import { useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `theme:switch` event detail: the map pushes into `waits` a promise with the function that shows it in the new theme
 * (its night map), applied in the same step as the page.
 */
export type ThemeSwitchDetail = { theme: "light" | "dark"; waits: Promise<() => void>[] };

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // The icon flips on press, the page right after.
  const [pending, setPending] = useState<"light" | "dark" | null>(null);
  const isDark = (pending ?? resolvedTheme) === "dark";

  async function toggle() {
    if (pending) return;
    const next = isDark ? "light" : "dark";
    setPending(next);
    // The map answers with how to show itself in the new theme; page and map then change in one step and fade in together.
    const waits: Promise<() => void>[] = [];
    window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next, waits } }));
    const reveals = await Promise.all(waits);
    const apply = () => {
      flushSync(() => {
        setTheme(next);
        setPending(null);
      });
      reveals.forEach((reveal) => reveal());
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return apply();
    const transition = document.startViewTransition(apply);
    await transition.ready;
    // Plain fade of the new frame over the old one: two still snapshots, composited by the GPU.
    document.documentElement.animate(
      { opacity: [0, 1] },
      { duration: 300, easing: "ease-out", pseudoElement: "::view-transition-new(root)" },
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Сменить тему"
      // Starts on press, not release: answers a few dozen ms sooner.
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
