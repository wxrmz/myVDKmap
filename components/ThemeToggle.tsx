"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `theme:switch` event detail: sent right before the page theme changes, so the map can start restyling first. */
export type ThemeSwitchDetail = { theme: "light" | "dark" };

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  async function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = isDark ? "light" : "dark";
    const rect = e.currentTarget.getBoundingClientRect();
    // No waiting for the map: the circle starts at the button and reaches the map after it has restyled,
    // so the frame stays frozen only for the React render.
    const apply = () => {
      window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next } }));
      flushSync(() => setTheme(next));
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return apply();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // The old frame is captured at once and stays frozen while `apply` runs, so the map never visibly repaints mid-switch.
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
