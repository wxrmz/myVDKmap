// City works from the newsvl.ru news feed (§6.4): road closures, repairs, outages and improvement in Vladivostok.
// A news item about works that names a street of the city becomes a work with its houses, dates and a link to the
// article. `npm run works:fetch` runs it (prisma/works-feed.ts; cron on the server). Server only.
import { prisma } from "@/lib/db";
import { newsHouses, summarizeDocument } from "@/lib/ai/rules";
import { norm, vlDay } from "@/lib/utils";

export const FEED_URL = "https://www.newsvl.ru/rss/";
const DAY = 86_400_000;
const meters = (lat1: number, lng1: number, lat2: number, lng2: number) =>
  111_320 * Math.hypot(lat1 - lat2, (lng1 - lng2) * Math.cos((lat1 * Math.PI) / 180));
/** Works with an end date stay in «Завершены» this long; works without dates are news of the day and go sooner. */
const KEEP_DONE = 30 * DAY;
const KEEP_UNDATED = 3 * DAY;

export interface NewsItem {
  id: string;
  title: string;
  text: string;
  link: string;
  published: Date;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|[a-z]+);/g, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(Number(e.slice(1))) : (ENTITIES[e] ?? m)))
    .trim();
const tag = (item: string, name: string) => decode(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item)?.[1] ?? "");

/** RSS items with an article id and a date; the «Читать полностью» tail of the text is dropped. */
export function parseFeed(xml: string): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const link = tag(item, "link");
    const id = /\/(\d+)\/?$/.exec(link)?.[1];
    const published = new Date(tag(item, "pubDate"));
    if (!id || Number.isNaN(published.getTime())) return [];
    const text = tag(item, "description").replace(/\s*Читать полностью:[\s\S]*$/, "").trim();
    return [{ id: `news-${id}`, title: tag(item, "title").replace(/\s+/g, " "), text, link, published }];
  });
}

const WORK_NEWS =
  /перекр|ограничен\S* (?:движени|проезд)|ремонт|асфальт|отключ|без (?:света|воды|горячей|холодной|отоплени|тепла|электричеств)|прокладк|раскоп|замен\S* (?:труб|сет|кабел)|благоустр|аварийн\S* работ/;
/**
 * News about works by the words of its headline: the text of other news mentions repairs and closed water too
 * («сотрудники школы перекрыли воду»). Whether it names a street is checked later, against the city's streets.
 */
export const isWorkNews = (n: Pick<NewsItem, "title">) => WORK_NEWS.test(norm(n.title));

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DAYS_RE = new RegExp(`(?:(с|со|до|по)\\s+)?(\\d{1,2})(?:\\s*(?:[–—-]|и|по)\\s*(\\d{1,2}))?\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?`, "gu");
const NUMERIC_RE = /(?:(с|со|до|по)\s+)?(\d{2})\.(\d{2})\.(\d{4})/gu;
const dayMonth = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Vladivostok" });
/** «14–15 ноября», «14 ноября — 1 декабря», «с 13 ноября» (no end in the text). */
export function periodLabel(start: Date, end: Date | null) {
  if (!end) return `с ${dayMonth(start)}`;
  const [a, b] = [dayMonth(start), dayMonth(end)];
  if (a === b) return a;
  const [da, ma] = a.split(" ");
  return ma === b.split(" ")[1] ? `${da}–${b}` : `${a} — ${b}`;
}
const noon = (day: string) => new Date(`${day}T12:00:00+10:00`);
const isoDay = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Days the text names, as the work's start and end (noon in Vladivostok). A date without a year is the nearest one
 * around the publication; «до 1 декабря» alone starts on the publication day. No dates: the publication day, no end.
 */
export function workDates(text: string, published: Date): { start: Date; end: Date | null } {
  const t = norm(text);
  const pubDay = vlDay(published);
  const year = Number(pubDay.slice(0, 4));
  const days: { day: Date; until: boolean }[] = [];
  const add = (y: number | null, m: number, d: number, prefix: string | undefined) => {
    if (d < 1 || d > 31 || m < 1 || m > 12) return;
    let day = noon(isoDay(y ?? year, m, d));
    if (y === null && day.getTime() < published.getTime() - 180 * DAY) day = noon(isoDay(year + 1, m, d));
    days.push({ day, until: prefix === "до" || prefix === "по" });
  };
  for (const m of t.matchAll(DAYS_RE)) {
    const month = MONTHS.indexOf(m[4]) + 1;
    const y = m[5] ? Number(m[5]) : null;
    add(y, month, Number(m[2]), m[3] ? undefined : m[1]);
    if (m[3]) add(y, month, Number(m[3]), undefined);
  }
  for (const m of t.matchAll(NUMERIC_RE)) add(Number(m[4]), Number(m[3]), Number(m[2]), m[1]);
  if (!days.length) return { start: noon(pubDay), end: null };
  const times = days.map((d) => d.day.getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const onlyUntil = days.every((d) => d.until);
  return { start: onlyUntil ? noon(pubDay) : new Date(first), end: new Date(last) };
}

/** Reads the feed and saves its works; old ones it saved earlier are removed. */
export async function syncNewsWorks(now = new Date()) {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; mydom-vl works feed)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`newsvl.ru: HTTP ${res.status}`);
  const news = parseFeed(new TextDecoder("windows-1251").decode(await res.arrayBuffer())).filter(isWorkNews);
  // The prepared works were retold from the same site: a news item about one of them (same kind, same days,
  // within a kilometre) is not added twice.
  const prepared = await prisma.cityWork.findMany({ where: { sourceUrl: null } });

  let saved = 0;
  for (const n of news) {
    const text = `${n.title}.\n${n.text}`;
    const houses = await newsHouses(text);
    if (!houses) continue;
    const { start, end } = workDates(text, n.published);
    // The headline says what the works are; the text may add «без отключения электричества» to a road closure.
    const byText = summarizeDocument(text);
    const byTitle = summarizeDocument(n.title);
    const { kind, what } = byTitle.kind !== "other" ? byTitle : byText;
    const where = [...new Map(byText.where.map((w) => [norm(w), w])).values()];
    const plainSummary = `${what}${where.length ? ` — ${where.join("; ")}` : ""}, ${periodLabel(start, end)}.`;
    const twin = prepared.some(
      (w) =>
        w.kind === kind &&
        w.startDate <= (end ?? start) &&
        (w.endDate ?? w.startDate) >= start &&
        w.lat !== null &&
        w.lng !== null &&
        meters(w.lat, w.lng, houses.lat, houses.lng) < 1000,
    );
    if (twin) continue;
    const row = {
      title: n.title,
      sourceText: `${n.text}\nИсточник: newsvl.ru, ${n.published.toLocaleDateString("ru-RU", { timeZone: "Asia/Vladivostok" })}.`,
      plainSummary,
      kind,
      startDate: start,
      endDate: end,
      lat: houses.lat,
      lng: houses.lng,
      sourceUrl: n.link,
    };
    await prisma.$transaction([
      prisma.cityWork.upsert({ where: { id: n.id }, create: { id: n.id, ...row }, update: row }),
      prisma.cityWorkImpact.deleteMany({ where: { workId: n.id } }),
      prisma.cityWorkImpact.createMany({ data: houses.ids.map((buildingId) => ({ workId: n.id, buildingId })) }),
    ]);
    saved++;
  }

  const { count: removed } = await prisma.cityWork.deleteMany({
    where: {
      sourceUrl: { not: null },
      OR: [{ endDate: { lt: new Date(now.getTime() - KEEP_DONE) } }, { endDate: null, startDate: { lt: new Date(now.getTime() - KEEP_UNDATED) } }],
    },
  });
  return { news: news.length, saved, removed };
}
