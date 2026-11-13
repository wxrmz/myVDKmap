"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `theme:switch` event detail, sent in the same step as the page's theme so the map flips with it. */
export type ThemeSwitchDetail = { theme: "light" | "dark" };

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  async function toggle() {
    const next = isDark ? "light" : "dark";
    // Page and map change in one step (the map shows or hides its night map), then fade in together.
    const apply = () => {
      flushSync(() => setTheme(next));
      window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next } }));
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
