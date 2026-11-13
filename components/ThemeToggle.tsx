"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `theme:switch` detail: the map pushes into `waits` a promise that resolves when its new style is drawn. */
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
    const root = document.documentElement;
    // The map switches first, under a still of itself; once its heavy style pass is over, the page's colours and the
    // map's still fade in the same frame (CSS in globals.css).
    const waits: Promise<unknown>[] = [];
    window.dispatchEvent(new CustomEvent<ThemeSwitchDetail>("theme:switch", { detail: { theme: next, waits } }));
    await Promise.all(waits);
    const fade = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fade) root.classList.add("theme-fading");
    setTheme(next);
    setTimeout(() => {
      root.classList.remove("theme-fading");
      switching = false;
    }, fade ? 700 : 0); // 450 ms fade plus slack for a busy first frame
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
