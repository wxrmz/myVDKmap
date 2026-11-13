"use client";

// District level (§5.3): header, metrics, frequent issues, management companies, microdistricts and complexes, AI digest.
import Link from "next/link";
import { Building2, ChevronRight, ExternalLink } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useMap, useMapScene } from "@/components/map/MapContext";
import { plural } from "@/lib/health";
import { cn } from "@/lib/utils";
import { complexHref, complexLabel } from "@/lib/nav";
import { ISSUE_CATEGORY_LABELS, type DistrictDetailDTO, type DistrictStatsDTO } from "@/lib/types";
import { AiDigest } from "./AiDigest";
import { CloseButton } from "./CloseButton";

export const GIS_ZHKH = "https://dom.gosuslugi.ru/";

export function DistrictPanel({ district, stats }: { district: DistrictDetailDTO; stats: DistrictStatsDTO }) {
  useMapScene({ level: "district", districtId: district.id });
  const { complexes } = useMap();
  const max = stats.topCategories[0]?.count ?? 1;
  const microdistricts = district.microdistricts.filter((m) => m.complexes.length);
  const metrics = [
    { value: district.complexCount, label: plural(district.complexCount, ["жилой комплекс", "жилых комплекса", "жилых комплексов"]) },
    { value: stats.openIssues, label: plural(stats.openIssues, ["открытая проблема", "открытые проблемы", "открытых проблем"]), coral: true },
    { value: district.buildingCount, label: plural(district.buildingCount, ["дом на карте", "дома на карте", "домов на карте"]) },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      <header className="relative flex items-start gap-3 pr-8">
        <span className="mt-2.5 size-3 shrink-0 rounded-full" style={{ background: district.color }} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{district.name} район</h1>
          <p className="text-muted-foreground">
            {district.population.toLocaleString("ru-RU")} {plural(district.population, ["житель", "жителя", "жителей"])} · данные{" "}
            {district.populationYear} года
          </p>
        </div>
        <CloseButton href="/" label="Закрыть район" />
      </header>

      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="panel-box flex flex-col gap-1 p-3">
            <span className={m.coral && m.value ? "text-2xl font-semibold text-coral" : "text-2xl font-semibold"}>{m.value}</span>
            <span className="text-xs leading-tight text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>

      <section className="panel-box flex flex-col gap-3">
        <h2 className="font-semibold">Частые проблемы</h2>
        {stats.topCategories.length ? (
          <ul className="flex flex-col gap-2.5">
            {stats.topCategories.map((c) => (
              <li key={c.category} className="flex flex-col gap-1 text-sm">
                <span className="flex justify-between">
                  {ISSUE_CATEGORY_LABELS[c.category]}
                  <span className="text-muted-foreground">{c.count}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-coral" style={{ width: `${(c.count / max) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Открытых проблем нет.</p>
        )}
      </section>

      <section className="panel-box flex flex-col gap-2">
        <h2 className="font-semibold">Управляющие компании</h2>
        <p className="text-sm text-muted-foreground">
          Какая компания обслуживает ваш дом, её лицензия и отчёты — в ГИС ЖКХ.
        </p>
        <a
          href={GIS_ZHKH}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          Открыть ГИС ЖКХ <ExternalLink className="size-3.5" />
        </a>
      </section>

      <section className="panel-box flex flex-col p-1.5">
        <h2 className="px-3 pt-2 pb-1 font-semibold">Микрорайоны и ЖК</h2>
        {microdistricts.length ? (
          <Accordion type="multiple" defaultValue={microdistricts.length === 1 ? [microdistricts[0].id] : []}>
            {microdistricts.map((m) => (
              <AccordionItem key={m.id} value={m.id} className="border-b-0">
                <AccordionTrigger className="items-center rounded-xl px-3 py-3 text-base hover:bg-muted hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{m.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{m.complexes.length}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-0.5 pb-1.5">
                  {m.complexes.map((c) => {
                    const stats = complexes.find((x) => x.id === c.id);
                    const building = c.status.startsWith("строится");
                    return (
                      <Link
                        key={c.id}
                        href={complexHref(district.id, c.id)}
                        prefetch
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-card">
                          <Building2 className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium">{complexLabel(c.name)}</span>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className={cn("size-1.5 rounded-full", building ? "bg-work" : "bg-turquoise")} />
                              {c.status}
                            </span>
                            {c.floors && <span>· {c.floors} эт.</span>}
                            {stats && stats.openIssues > 0 && (
                              <span className="text-coral">
                                · {stats.openIssues} {plural(stats.openIssues, ["проблема", "проблемы", "проблем"])}
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="px-3 pb-2 text-sm text-muted-foreground">Новых ЖК в базе нет — дом можно найти через поиск.</p>
        )}
      </section>

      <AiDigest districtId={district.id} />
    </div>
  );
}
