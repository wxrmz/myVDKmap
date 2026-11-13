"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Highlights its row and scrolls it to the center after a frame (`?issue=`, §5.4). */
export function Spotlight({ active, className, children }: { active: boolean; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!active) return;
    const f = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return () => cancelAnimationFrame(f);
  }, [active]);
  return (
    <li ref={ref} className={cn(className, active && "rounded-xl bg-coral/10 px-3 ring-1 ring-coral/40")}>
      {children}
    </li>
  );
}
