"use client";

// «Что меняется в городе» (§5.7): street search, groups now / soon / done, `?building=` first, `?work=` highlighted.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { houseHref } from "@/lib/nav";
import { WORK_KIND_LABELS, type CityWorkDTO } from "@/lib/types";
import { cn, dayLabel, norm, vlDay } from "@/lib/utils";
import { WorksSearch } from "./WorksSearch";

const MAX_CHIPS = 8;
const SHOWN_HOUSES = 4;

/** Done from the day after `endDate`, by the Vladivostok calendar. */
export function isDone(w: Pick<CityWorkDTO, "endDate">, now: number) {
  return Boolean(w.endDate) && vlDay(w.endDate!) < vlDay(now);
}

const dates = (w: CityWorkDTO) => (w.endDate ? `${dayLabel(w.startDate)} — ${dayLabel(w.endDate)}` : `с ${dayLabel(w.startDate)}, срок не указан`);

export function WorksFeed({
  works,
  streets,
  buildingId,
  workId,
}: {
  works: CityWorkDTO[];
  streets: Record<string, string[]>;
  buildingId?: string;
  workId?: string;
}) {
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());
  const q = norm(query.trim());

  const texts = useMemo(
    () => new Map(works.map((w) => [w.id, norm([w.title, w.plainSummary, w.sourceText, ...w.buildings.map((b) => b.address)].join("\n"))])),
    [works],
  );
  const allStreets = useMemo(() => [...new Set(Object.values(streets).flat())].sort((a, b) => a.localeCompare(b, "ru")), [streets]);

  const shown = q ? works.filter((w) => (streets[w.id] ?? []).some((s) => norm(s).includes(q)) || texts.get(w.id)!.includes(q)) : works;
  const suggestions = q ? allStreets.filter((s) => norm(s).includes(q) && norm(s) !== q).slice(0, MAX_CHIPS) : [];

  const mine = (w: CityWorkDTO) => Boolean(buildingId && w.buildings.some((b) => b.id === buildingId));
  // Your house first, then works from the news (newest first), then the rest by start date.
  const fresh = (w: CityWorkDTO) => (w.sourceUrl ? Date.parse(w.startDate) : 0);
  const ordered = [...shown].sort((a, b) => Number(mine(b)) - Number(mine(a)) || fresh(b) - fresh(a));
  const today = vlDay(now);
  const current = ordered.filter((w) => vlDay(w.startDate) <= today && !isDone(w, now));
  const soon = ordered.filter((w) => vlDay(w.startDate) > today);
  const done = ordered.filter((w) => isDone(w, now));

  const highlightedDone = works.some((w) => w.id === workId && isDone(w, now));
  const [doneOpen, setDoneOpen] = useState(highlightedDone);
  // A new `?work=` (e.g. a marker click while on this page): drop the filter so the card is there, open its group.
  useEffect(() => {
    if (!workId) return;
    setQuery("");
    if (highlightedDone) setDoneOpen(true);
  }, [highlightedDone, workId]);

  const card = (w: CityWorkDTO) => <WorkCard key={w.id} work={w} mine={mine(w)} active={w.id === workId} />;

  return (
    <div className="flex flex-col gap-5">
      <WorksSearch query={query} onQuery={setQuery} suggestions={suggestions} found={shown.length} />

      {current.length > 0 && (
        <Group
          title={
            <>
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-work opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-work" />
              </span>
              Идут сейчас
            </>
          }
        >
          {current.map(card)}
        </Group>
      )}
      {soon.length > 0 && <Group title="Скоро начнутся">{soon.map(card)}</Group>}
      {done.length > 0 && (
        <details open={doneOpen} onToggle={(e) => setDoneOpen(e.currentTarget.open)} className="group flex flex-col">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl py-1 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            Завершены <span className="text-muted-foreground">{done.length}</span>
            <span className="ml-auto text-sm font-normal text-muted-foreground group-open:hidden">Показать</span>
            <span className="ml-auto hidden text-sm font-normal text-muted-foreground group-open:inline">Скрыть</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-3">{done.map(card)}</ul>
        </details>
      )}
    </div>
  );
}

function Group({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function WorkCard({ work: w, mine, active }: { work: CityWorkDTO; mine: boolean; active: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!active) return;
    // after a frame: the group may have just opened
    const f = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return () => cancelAnimationFrame(f);
  }, [active]);
  return (
    <li
      ref={ref}
      id={`work-${w.id}`}
      className={cn("panel-box flex flex-col gap-2 transition-[background-color,box-shadow] duration-300", active && "bg-work/10 ring-2 ring-work")}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-work/20 px-2.5 py-0.5 font-medium">{WORK_KIND_LABELS[w.kind]}</span>
        {mine && <span className="rounded-full px-2.5 py-0.5 font-medium ring-1 ring-work">Касается вашего дома</span>}
        {w.sourceUrl && <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">Из новостей</span>}
      </div>
      <h3 className="text-base font-semibold">{w.title}</h3>
      <p className="text-sm text-muted-foreground">{dates(w)}</p>
      <p className="text-sm">{w.plainSummary}</p>
      {w.buildings.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Затронуто домов: {w.buildings.length}. </span>
          {w.buildings.slice(0, SHOWN_HOUSES).map((b, i) => (
            <span key={b.id}>
              {i > 0 && ", "}
              <Link href={houseHref(b.id)} prefetch={false} className="font-medium underline-offset-4 hover:underline">
                {b.address}
              </Link>
            </span>
          ))}
          {w.buildings.length > SHOWN_HOUSES && " и другие"}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Исходный текст</summary>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{w.sourceText}</p>
        {w.sourceUrl && (
          <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium underline underline-offset-4">
            Новость целиком на newsvl.ru
          </a>
        )}
      </details>
    </li>
  );
}
