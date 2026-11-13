"use client";

// Hover card on the map (§5.2 «Плашки при наведении»): one card that glides between targets.
// State lives in a tiny store outside React so hover re-renders only this component.
import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { plural } from "@/lib/health";
import { complexLabel } from "@/lib/nav";
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_STATUS_LABELS,
  WORK_KIND_LABELS,
  type CityWorkDTO,
  type DistrictWithCountsDTO,
  type IssueCategory,
  type IssueDTO,
  type MapComplexDTO,
} from "@/lib/types";

export type TipTarget =
  | { kind: "district"; district: DistrictWithCountsDTO; complexes: number }
  | { kind: "cluster"; issues: IssueDTO[] }
  | { kind: "issue"; issue: IssueDTO }
  | { kind: "work"; work: CityWorkDTO }
  | { kind: "complex"; complex: MapComplexDTO };

/** `x`, `y` — the target point in px inside the map container. */
export interface Tip {
  target: TipTarget;
  x: number;
  y: number;
  pinned?: boolean;
}

export const TIP_WIDTH = 256;
const OPEN_DOWN_ABOVE = 240;
const GAP = 16;

let shown: Tip | null = null;
let queued: Tip | null | undefined;
let frame = 0;
const listeners = new Set<() => void>();

// The positioner element; moves of the same target go straight to its style, so following the cursor never re-renders React.
let positioner: HTMLDivElement | null = null;

const keyOf = (t: TipTarget) => {
  switch (t.kind) {
    case "district": return `d:${t.district.id}`;
    case "cluster": return `c:${t.issues[0]?.id}:${t.issues.length}`;
    case "issue": return `i:${t.issue.id}`;
    case "work": return `w:${t.work.id}`;
    case "complex": return `x:${t.complex.id}`;
  }
};

function place(el: HTMLDivElement, tip: Tip, glide: boolean) {
  el.style.transition = glide ? "transform 160ms ease-out" : "none";
  el.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
  const card = el.firstElementChild as HTMLElement | null;
  if (card) card.style.transform = `translate(-50%, ${tip.y < OPEN_DOWN_ABOVE ? `${GAP}px` : `calc(-100% - ${GAP}px)`})`;
}

function flush() {
  frame = 0;
  const next = queued ?? null;
  queued = undefined;
  const same = next && shown && keyOf(next.target) === keyOf(shown.target) && !!next.pinned === !!shown.pinned;
  shown = next;
  if (same && positioner) place(positioner, next, false);
  else listeners.forEach((l) => l());
}

/** Queues the tip (null hides it); applied once per animation frame. While a tip is pinned only `force` or another pinned tip replace it. */
export function setTip(tip: Tip | null, force = false) {
  const current = queued === undefined ? shown : queued;
  if (current?.pinned && !force && !tip?.pinned) return;
  queued = tip;
  frame ||= requestAnimationFrame(flush);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Content({ target }: { target: TipTarget }) {
  switch (target.kind) {
    case "district": {
      const d = target.district;
      return (
        <>
          <p className="mb-1.5 font-semibold">{d.name} район</p>
          <Row label="Население" value={d.population.toLocaleString("ru-RU")} />
          <Row label="ЖК" value={target.complexes} />
          <Row label="Открытые проблемы" value={d.openIssues} />
        </>
      );
    }
    case "cluster": {
      const counts = new Map<IssueCategory, number>();
      for (const i of target.issues) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const n = target.issues.length;
      return (
        <>
          <p className="font-semibold">
            {n} {plural(n, ["проблема", "проблемы", "проблем"])}
          </p>
          <p className="text-sm">{top.map(([c, k]) => `${ISSUE_CATEGORY_LABELS[c]} · ${k}`).join(", ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Нажмите, чтобы приблизить</p>
        </>
      );
    }
    case "issue": {
      const i = target.issue;
      return (
        <>
          <p className="text-xs font-medium text-coral">{ISSUE_CATEGORY_LABELS[i.category]}</p>
          <p className="font-semibold leading-snug">{i.title}</p>
          {i.address && <p className="text-sm text-muted-foreground">{i.address}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {ISSUE_STATUS_LABELS[i.status]} · {date(i.createdAt)}
          </p>
        </>
      );
    }
    case "work": {
      const w = target.work;
      return (
        <>
          <p className="text-xs font-medium text-muted-foreground">
            {WORK_KIND_LABELS[w.kind]} · {w.endDate ? `${date(w.startDate)} – ${date(w.endDate)}` : `с ${date(w.startDate)}`}
          </p>
          <p className="font-semibold leading-snug">{w.title}</p>
          <p className="mt-1 line-clamp-4 text-sm">{w.plainSummary}</p>
        </>
      );
    }
    case "complex": {
      const c = target.complex;
      const top = Number(c.floors?.match(/\d+/g)?.at(-1));
      return (
        <>
          <p className="font-semibold leading-snug">{complexLabel(c.name)}</p>
          {c.street && <p className="text-sm text-muted-foreground">{c.street}</p>}
          <p className="mt-1 text-sm">
            {capitalize(c.status)}
            {c.floors && ` · ${c.floors} ${plural(top, ["этаж", "этажа", "этажей"])}`}
          </p>
          {c.developer && <p className="text-sm text-muted-foreground">{c.developer}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {c.houses} {plural(c.houses, ["дом", "дома", "домов"])} · {c.openIssues}{" "}
            {plural(c.openIssues, ["проблема", "проблемы", "проблем"])}
          </p>
        </>
      );
    }
  }
}

export function MapTip() {
  const tip = useSyncExternalStore(
    subscribe,
    () => shown,
    () => null,
  );
  // New target: glide from the previous spot (§5.2); later cursor moves are applied in `flush` without a transition.
  const attach = useCallback((el: HTMLDivElement | null) => {
    positioner = el;
    if (el && shown) place(el, shown, el.dataset.placed === "1");
    if (el) el.dataset.placed = "1";
  }, []);
  useLayoutEffect(() => {
    if (positioner && tip) place(positioner, tip, true);
  }, [tip]);
  return (
    <AnimatePresence>
      {tip && (
        <div ref={attach} className="pointer-events-none absolute top-0 left-0 z-20">
          <div className="absolute left-0">
            <motion.div
              role="tooltip"
              className="panel-box text-card-foreground"
              style={{ width: TIP_WIDTH }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <Content target={tip.target} />
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
