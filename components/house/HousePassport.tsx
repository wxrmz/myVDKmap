"use client";

// House passport (§5.4): header, health, sections, actions.
import Link from "next/link";
import { ChevronRight, ExternalLink, Receipt, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMapScene } from "@/components/map/MapContext";
import { IssueStatusBadge } from "@/components/panel/badges";
import { CloseButton } from "@/components/panel/CloseButton";
import { plural } from "@/lib/health";
import { breadcrumbs, complexHref, complexLabel } from "@/lib/nav";
import { ISSUE_CATEGORY_LABELS, WORK_KIND_LABELS, type BuildingPassportDTO } from "@/lib/types";
import { SaveHouseButton, SupportButton } from "./CabinetButtons";
import { HealthRing } from "./HealthRing";
import { Section } from "./Section";
import { ShareButton } from "./ShareButton";
import { Spotlight } from "./Spotlight";

const GIS_HOUSES = "https://dom.gosuslugi.ru/#!/houses";
// shortcut: search link instead of the fund's site — its address could not be confirmed; replace once verified.
const CAP_FUND = `https://yandex.ru/search/?text=${encodeURIComponent("Фонд капитального ремонта многоквартирных домов Приморского края")}`;

const DAY = 86_400_000;
function daysAgo(iso: string) {
  const n = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (n <= 0) return "сегодня";
  if (n === 1) return "вчера";
  return `${n} ${plural(n, ["день", "дня", "дней"])} назад`;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const period = (p: string) => {
  const s = new Date(`${p}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long" });
  return `${s[0].toUpperCase()}${s.slice(1)} ${p.slice(0, 4)}`;
};
const rub = (n: number) => `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;

const external = "inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline";

export function HousePassport({ passport, issueId }: { passport: BuildingPassportDTO; issueId?: string }) {
  const { building: b, openIssues, resolvedIssues, works, bills, health } = passport;
  useMapScene({
    level: "house",
    districtId: b.district?.id,
    complexId: b.complexId ?? undefined,
    buildingId: b.id,
    buildings: [{ id: b.id, lat: b.lat, lng: b.lng }],
  });
  const crumbs = breadcrumbs({ district: b.district, complex: b.complex ?? undefined });
  const facts: [string, React.ReactNode][] = [];
  if (b.floors !== null) facts.push(["Этажей", b.floors]);
  if (b.yearBuilt !== null) facts.push(["Год постройки", b.yearBuilt]);
  if (b.wallMaterial) facts.push(["Стены", b.wallMaterial]);
  if (b.apartments !== null) facts.push(["Квартир", b.apartments]);
  if (b.complex && b.district)
    facts.push([
      "ЖК",
      <Link key="c" href={complexHref(b.district.id, b.complex.id)} prefetch className="underline-offset-4 hover:underline">
        {complexLabel(b.complex.name)}
      </Link>,
    ]);
  if (b.microdistrict) facts.push(["Микрорайон", b.microdistrict.name]);
  const mc = b.managementCompany;
  const q = `?building=${encodeURIComponent(b.id)}`;

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      <header className="relative flex flex-col gap-3 pr-8">
        {/* One level up: the house's ЖК, else its district. */}
        <CloseButton href={crumbs.at(-1)?.href ?? "/"} label="Закрыть дом" />
        <nav aria-label="Где дом" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5" />}
              <Link href={c.href} prefetch className="hover:text-foreground">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">{b.address}</h1>
        <div className="flex items-center gap-2">
          <SaveHouseButton buildingId={b.id} />
          <ShareButton title={b.address} />
        </div>
      </header>

      <Section title="Здоровье дома">
        <HealthRing health={health} />
      </Section>

      <Section title="О доме">
        {facts.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Сведений о доме пока нет.</p>
        )}
        {b.isDemo && <p className="text-xs text-muted-foreground">Часть сведений — демонстрационные.</p>}
      </Section>

      <Section title="Управляющая компания">
        {mc ? (
          <p className="text-sm">
            <span className="font-medium">{mc.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · отвечает в среднем за {Math.round(mc.avgResponseDays)}{" "}
              {plural(Math.round(mc.avgResponseDays), ["день", "дня", "дней"])}
              {mc.isDemo && " · демо-данные"}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">В нашей базе компании нет.</p>
        )}
        <p className="text-sm text-muted-foreground">Настоящую компанию, лицензию и отчёты ищите в ГИС ЖКХ по адресу «{b.address}».</p>
        <a href={GIS_HOUSES} target="_blank" rel="noopener noreferrer" className={external}>
          Найти дом в ГИС ЖКХ <ExternalLink className="size-3.5" />
        </a>
      </Section>

      <Section title="Капремонт">
        {(b.lastCapRepairYear !== null || b.nextCapRepair !== null) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {b.lastCapRepairYear !== null && (
              <>
                <dt className="text-muted-foreground">Последний</dt>
                <dd className="font-medium">{b.lastCapRepairYear}</dd>
              </>
            )}
            {b.nextCapRepair !== null && (
              <>
                <dt className="text-muted-foreground">Следующий по плану</dt>
                <dd className="font-medium">{b.nextCapRepair}</dd>
              </>
            )}
          </dl>
        )}
        <p className="text-sm text-muted-foreground">График и взносы — у Фонда капитального ремонта Приморского края.</p>
        <a href={CAP_FUND} target="_blank" rel="noopener noreferrer" className={external}>
          Фонд капремонта Приморья <ExternalLink className="size-3.5" />
        </a>
      </Section>

      <Section title="Проблемы">
        {openIssues.length ? (
          <ul className="-mx-1 flex flex-col gap-1">
            {openIssues.map((i) => (
              <Spotlight key={i.id} active={i.id === issueId} className="flex flex-col gap-2 px-1 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="font-medium">{i.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {ISSUE_CATEGORY_LABELS[i.category]}
                      <IssueStatusBadge status={i.status} />
                      {daysAgo(i.createdAt)}
                    </span>
                    <SupportButton issueId={i.id} supports={i.supports} />
                  </div>
                </div>
              </Spotlight>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Открытых проблем нет.</p>
        )}
        {resolvedIssues.length > 0 && (
          <p className="text-sm text-turquoise">
            Решено: {resolvedIssues.length} {plural(resolvedIssues.length, ["проблема", "проблемы", "проблем"])}
          </p>
        )}
      </Section>

      <Section
        title="Что меняется рядом"
        action={
          <Link href={`/changes${q}`} prefetch className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Подробнее
          </Link>
        }
      >
        {works.length ? (
          <ul className="flex flex-col gap-3">
            {works.map((w) => (
              <li key={w.id} className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-work" />
                  {WORK_KIND_LABELS[w.kind]} · {day(w.startDate)}
                  {w.endDate && ` – ${day(w.endDate)}`}
                  {w.affectsBuilding && <span className="rounded-full bg-work/20 px-2 py-0.5 text-foreground">ваш дом</span>}
                </span>
                <span className="text-sm font-medium">{w.title}</span>
                <span className="line-clamp-3 text-sm text-muted-foreground">{w.plainSummary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Рядом с домом работ не запланировано.</p>
        )}
      </Section>

      <Section title="Квитанции">
        {bills.length ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {bills.map((bill) => (
              <li key={bill.id} className="flex justify-between">
                <span>{period(bill.period)}</span>
                <span className="font-medium tabular-nums">{rub(bill.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Квитанций пока нет — загрузите свою, ИИ её разберёт.</p>
        )}
      </Section>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <Button asChild className="h-11 rounded-xl">
          <Link href={`/report${q}`} prefetch>
            <TriangleAlert /> Сообщить о проблеме
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={`/bill${q}`} prefetch>
            <Receipt /> Разобрать квитанцию
          </Link>
        </Button>
      </div>

    </div>
  );
}
