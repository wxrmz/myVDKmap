"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Prefetches pages once the start is over (load + 2 s, then idle time), so they do not compete with the map. */
export function useIdlePrefetch(hrefs: string[]) {
  const router = useRouter();
  const key = hrefs.join("\n");
  useEffect(() => {
    const idle = "requestIdleCallback" in window; // Safari before 18 has none
    let task = 0;
    const run = () => {
      const go = () => key.split("\n").forEach((h) => router.prefetch(h));
      task = idle ? requestIdleCallback(go, { timeout: 3000 }) : window.setTimeout(go, 0);
    };
    const timer = window.setTimeout(run, document.readyState === "complete" ? 2000 : 4000);
    return () => {
      clearTimeout(timer);
      if (idle) cancelIdleCallback(task);
    };
  }, [key, router]);
}
