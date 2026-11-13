"use client";

// Cabinet sections «Мои дома» and «Обращения» (§5.8).
import Link from "next/link";
import { Bell, BellOff, Construction, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isDone } from "@/components/flows/WorksFeed";
import { toggleSavedHouse, updateCabinet } from "@/lib/cabinet";
import { plural } from "@/lib/health";
import { houseHref, issueHref, workHref } from "@/lib/nav";
import { ISSUE_CATEGORY_LABELS, WORK_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CabinetSection, dayLabel, Empty, useHouseSummaries, useCabinet } from "./shared";

const HEALTH_TONE = { good: "text-turquoise", warn: "text-work", bad: "text-coral" } as const;

export function HousesSection() {
  const { houses, subscriptions } = useCabinet();
  const summaries = useHouseSummaries(houses);
  const now = Date.now();
  const works = new Map(
    (summaries ?? []).flatMap((h) => h.works.filter((w) => !isDone(w, now)).map((w) => [w.id, { ...w, address: h.address }] as const)),
  );

  const toggleSub = (id: string) =>
    updateCabinet((c) => ({
      ...c,
      subscriptions: c.subscriptions.includes(id) ? c.subscriptions.filter((s) => s !== id) : [...c.subscriptions, id],
    }));

  return (
    <>
      <CabinetSection title="Мои дома">
        {!houses.length ? (
          <Empty>
            Вы ещё не сохранили ни одного дома. Найдите свой дом на{" "}
            <Link href="/" prefetch className="font-medium text-foreground underline underline-offset-4">
              карте
            </Link>{" "}
            и нажмите «Сохранить дом».
          </Empty>
        ) : summaries === null ? (
          houses.map((h) => <Skeleton key={h} className="h-16 w-full" />)
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {summaries.map((h) => {
              const subscribed = subscriptions.includes(h.id);
              return (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link href={houseHref(h.id)} prefetch className="font-medium underline-offset-4 hover:underline">
                      {h.address}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {h.district && `${h.district} район · `}
                      <span className={HEALTH_TONE[h.health.level]}>{h.health.label}</span>
                      {" · "}
                      {h.openIssues
                        ? `${h.openIssues} ${plural(h.openIssues, ["открытая проблема", "открытые проблемы", "открытых проблем"])}`
                        : "открытых проблем нет"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-pressed={subscribed}
                    aria-label={subscribed ? "Не сообщать о работах у дома" : "Сообщать о работах у дома"}
                    title={subscribed ? "Сообщаем о работах" : "Сообщать о работах"}
                    onClick={() => toggleSub(h.id)}
                    className="rounded-full"
                  >
                    {subscribed ? <Bell className="fill-current" /> : <BellOff />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Убрать ${h.address} из моих домов`}
                    onClick={() => toggleSavedHouse(h.id)}
                    className="rounded-full"
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CabinetSection>

      {houses.length > 0 && summaries !== null && (
        <CabinetSection title="Что меняется у моих домов">
          {works.size ? (
            <ul className="flex flex-col gap-3">
              {[...works.values()].map((w) => (
                <li key={w.id} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-work/20">
                    <Construction className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={workHref(w.id)} prefetch className="font-medium underline-offset-4 hover:underline">
                      {w.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {WORK_KIND_LABELS[w.kind]} · {w.affectsBuilding ? "касается дома" : "рядом с домом"} {w.address}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>У ваших домов работ не объявлено.</Empty>
          )}
        </CabinetSection>
      )}
    </>
  );
}

export function IssuesSection() {
  const { issues, draft } = useCabinet();
  return (
    <>
      {draft && (
        <CabinetSection title="Черновик">
          <p className={cn("text-sm", !draft.text && "text-muted-foreground")}>{draft.text || "Фото без описания"}</p>
          {draft.address && <p className="text-sm text-muted-foreground">{draft.address}</p>}
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-10 rounded-xl">
              <Link href="/report" prefetch>
                Продолжить
              </Link>
            </Button>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => updateCabinet((c) => ({ ...c, draft: null }))}>
              Удалить черновик
            </Button>
          </div>
        </CabinetSection>
      )}
      <CabinetSection title="Мои обращения">
        {issues.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {[...issues].reverse().map((i) => {
              return (
                <li key={i.id} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={issueHref(i.id)} prefetch className="font-medium underline-offset-4 hover:underline">
                      {i.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {ISSUE_CATEGORY_LABELS[i.category]} · {i.address} · {dayLabel(i.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            Обращений пока нет.{" "}
            <Link href="/report" prefetch className="font-medium text-foreground underline underline-offset-4">
              Сообщить о проблеме
            </Link>
          </Empty>
        )}
      </CabinetSection>
    </>
  );
}
