"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  function toggle() {
    const root = document.documentElement;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Colours ease to the new theme (CSS in globals.css); the map crossfades itself in MapView.
      root.classList.add("theme-fading");
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove("theme-fading"), 700); // 450 ms fade plus slack for a busy first frame
    }
    setTheme(isDark ? "light" : "dark");
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
