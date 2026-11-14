"use client";

// One issue (§5.4–5.5): what it is, the photo and the resident's words, where, and «Меня тоже касается».
import Image from "next/image";
import Link from "next/link";
import { House, MapPin } from "lucide-react";
import { useMapScene } from "@/components/map/MapContext";
import { SupportButton } from "@/components/house/CabinetButtons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { houseHref } from "@/lib/nav";
import { ISSUE_CATEGORY_LABELS, ISSUE_KIND_LABELS, type IssueDTO } from "@/lib/types";
import { cn, dayLabel } from "@/lib/utils";
import { IssueStatusBadge } from "./badges";
import { CloseButton } from "./CloseButton";
import { IssueVotes, type IssueVotesState } from "./IssueVotes";


export function IssuePanel({
  issue: i,
  authority,
  districtId,
  votes,
}: {
  issue: IssueDTO;
  authority: string | null;
  districtId?: string;
  votes: IssueVotesState;
}) {
  useMapScene({
    level: "house",
    districtId,
    focus: { lat: i.lat, lng: i.lng },
    buildingId: i.buildingId ?? undefined,
    buildings: i.buildingId ? [{ id: i.buildingId, lat: i.lat, lng: i.lng }] : [],
  });

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      <header className="relative flex flex-col gap-2 pr-8">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("rounded-full px-2.5 py-0.5 font-medium", i.kind === "accident" ? "bg-coral text-white" : "bg-coral/15 text-coral")}>
            {ISSUE_KIND_LABELS[i.kind]}
          </span>
          <span className="rounded-full px-2.5 py-0.5 ring-1 ring-border">{ISSUE_CATEGORY_LABELS[i.category]}</span>
          <IssueStatusBadge status={i.status} />
          {i.closedByResidents && <span className="text-xs text-muted-foreground">по отзывам жителей</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{i.title}</h1>
        <p className="text-sm text-muted-foreground">Отмечено {dayLabel(i.createdAt)}</p>
        <CloseButton href={i.buildingId ? houseHref(i.buildingId) : "/"} label="Закрыть обращение" />
      </header>

      {i.photoUrl && (
        <Image
          src={i.photoUrl}
          alt="Фото проблемы"
          width={800}
          height={600}
          unoptimized={!i.photoUrl.startsWith("/api/")}
          className="max-h-80 w-full rounded-2xl bg-muted object-contain ring-1 ring-border"
        />
      )}

      <section className="panel-box flex flex-col gap-2">
        <h2 className="font-semibold">Что случилось</h2>
        <p className="whitespace-pre-wrap">{i.description}</p>
      </section>

      <section className="panel-box flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-border">
          {i.buildingId ? <House className="size-4" /> : <MapPin className="size-4" />}
        </span>
        {i.buildingId ? (
          <Link href={houseHref(i.buildingId)} prefetch className="min-w-0 flex-1 font-medium underline-offset-4 hover:underline">
            {i.address ?? "Дом"}
          </Link>
        ) : (
          <span className="min-w-0 flex-1 font-medium">
            Точка на карте ({i.lat.toFixed(5)}, {i.lng.toFixed(5)})
          </span>
        )}
      </section>

      {i.status !== "resolved" && (
        <section className="panel-box flex flex-col gap-2">
          <h2 className="font-semibold">Вас это тоже касается?</h2>
          {i.supports > 0 && <p className="text-sm text-muted-foreground">Уже отметились: {i.supports}.</p>}
          <SupportButton issueId={i.id} supports={i.supports} />
        </section>
      )}

      {(i.status !== "resolved" || i.closedByResidents) && (
        <IssueVotes key={i.status} issueId={i.id} closed={i.closedByResidents} initial={votes} />
      )}

      {(authority || i.appealText) && (
        <Accordion type="single" collapsible className="panel-box py-0">
          <AccordionItem value="appeal" className="border-0">
            <AccordionTrigger>Обращение{authority && ` · ${authority}`}</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm whitespace-pre-wrap">{i.appealText}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
