"use client";

// Shared bits of the cabinet (and flows): live cabinet hooks, formatters, section frame, empty state, saved house summaries.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CABINET_EVENT, DEFAULT_SETTINGS, rawCabinet, readRaw, type Cabinet } from "@/lib/cabinet";
import type { HouseSummaryDTO } from "@/lib/types";

export const rub = (n: number) => `${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

/** «2026-11» → «Ноябрь 2026». */
export function monthLabel(period: string) {
  const s = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1).toLocaleDateString("ru-RU", { month: "long" });
  return `${s[0].toUpperCase()}${s.slice(1)} ${period.slice(0, 4)}`;
}

export const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function CabinetSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel-box flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Summaries of the given houses from `/api/cabinet/houses`; null while loading. */
export function useHouseSummaries(ids: string[]) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; houses: HouseSummaryDTO[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/cabinet/houses?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<HouseSummaryDTO[]>) : []))
      .then((houses) => setState({ key, houses }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ key, houses: [] });
      });
    return () => ctrl.abort();
  }, [key]);
  if (!key) return [];
  return state?.key === key ? state.houses : null;
}

// --- live cabinet ---
function subscribe(cb: () => void) {
  window.addEventListener(CABINET_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CABINET_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Live cabinet; empty on the server and during hydration. */
export function useCabinet(): Cabinet {
  const raw = useSyncExternalStore(subscribe, rawCabinet, () => null);
  return useMemo(() => readRaw(raw), [raw]);
}

/** Applies the font size setting to `html` (rem-based UI scales with it). */
export function useFontScale() {
  const scale = (useCabinet().settings ?? DEFAULT_SETTINGS).fontScale;
  useEffect(() => {
    document.documentElement.style.fontSize = scale === 1 ? "" : `${scale * 100}%`;
  }, [scale]);
}
