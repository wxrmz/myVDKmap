// City works from the newsvl.ru news feed (§6.4): road closures, repairs, outages and improvement in Vladivostok.
// A news item about works that names a street of the city becomes a work with its houses, dates and a link to the
// article. `npm run works:fetch` runs it (prisma/works-feed.ts; cron on the server). Server only.
import { prisma } from "@/lib/db";
import { houseMatches, streetRefs, summarizeDocument } from "@/lib/ai/rules";
import { allAddressPoints, ensureOsmBuilding, streetPattern } from "@/lib/search";
import type { WorkKind } from "@/lib/types";
import { norm, vlDay } from "@/lib/utils";

export const FEED_URL = "https://www.newsvl.ru/rss/";
const DAY = 86_400_000;

type LatLng = [lat: number, lng: number];
const meters = (a: LatLng, b: LatLng) => 111_320 * Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180));
const mean = (ps: LatLng[]): LatLng => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];

/** Every house this close to the place of a work is affected by it. */
const RADIUS_M = 500;
/** An outage text listing this many streets names the area cut off: every house of those streets this close counts. */
const AREA_STREETS = 3;
const AREA_M = 3000;
/** Two named streets pin a place when they come this close: a crossing, or «от Русской до Маковского» (784 m apart). */
const CROSSING_M = 1000;
/** One named street pins a place only when the whole street lies this close to its middle. */
const SHORT_STREET_M = 600;
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

/**
 * Where a work without house numbers happens, from the houses of its streets in text order: where the
 * first two named streets come closest, or the middle of a single short street. `gap` is half the distance between the
 * two streets: the houses are searched that much wider. Null when the text does not pin a place (one long street, or
 * streets far apart): such a work gets no houses rather than random ones.
 */
export function workPoint(streets: LatLng[][]): { at: LatLng; gap: number } | null {
  const named = streets.filter((s) => s.length);
  if (named.length >= 2) {
    let best: { d: number; at: LatLng } | null = null;
    for (const a of named[0])
      for (const b of named[1]) {
        const d = meters(a, b);
        if (!best || d < best.d) best = { d, at: mean([a, b]) };
      }
    return best && best.d <= CROSSING_M ? { at: best.at, gap: best.d / 2 } : null;
  }
  if (!named.length) return null;
  const mid = mean(named[0]);
  const center = named[0].reduce((a, b) => (meters(a, mid) <= meters(b, mid) ? a : b));
  return named[0].every((p) => meters(p, center) <= SHORT_STREET_M) ? { at: center, gap: 0 } : null;
}

/** «ул. Русская, 54» → street and number. */
export const splitAddress = (address: string) => {
  const comma = address.indexOf(",");
  return comma < 0 ? { street: address, number: "" } : { street: address.slice(0, comma), number: address.slice(comma + 1).trim() };
};

export interface HouseSpot {
  street: string;
  number: string;
  lat: number;
  lng: number;
}

/**
 * Houses of a work among `spots` (the first spot of an address wins): the houses the text names by number, plus around
 * the place of the work every house within 500 m — or, for an outage listing 3 or more streets (the area cut off),
 * every house of those streets within 3 km. The place is `point` when given (prepared works), else the middle of the
 * named houses, else `workPoint` of the named streets; without a place only the named houses.
 */
export function pickHouses<T extends HouseSpot>(text: string, kind: WorkKind, spots: T[], point: LatLng | null = null) {
  const refs = streetRefs(text);
  // «ул. Маковского» and «пер. Маковского» are one name in a text.
  const nameOf = (street: string) => norm(street.replace(/^\S+\.\s*/, ""));
  const numbered = refs.filter((r) => r.numbers.length);
  const named = spots.filter((s) => numbered.some((r) => r.re.test(norm(s.street)) && houseMatches(r.numbers, s.number)));
  let at = point ?? (named.length ? mean(named.map((s): LatLng => [s.lat, s.lng])) : null);
  let gap = 0;
  if (!at) {
    // Streets in the order the text names them.
    const t = norm(text);
    const byName = new Map<string, LatLng[]>();
    for (const r of [...refs].sort((a, b) => t.search(a.re) - t.search(b.re))) {
      const name = nameOf(r.street);
      const own = spots.filter((s) => norm(s.street) === norm(r.street)).map((s): LatLng => [s.lat, s.lng]);
      byName.set(name, [...(byName.get(name) ?? []), ...own]);
    }
    const place = workPoint([...byName.values()]);
    at = place?.at ?? null;
    gap = place?.gap ?? 0;
  }
  const area = kind === "utility_outage" && new Set(refs.map((r) => nameOf(r.street))).size >= AREA_STREETS;
  const around = !at
    ? []
    : spots.filter((s) => {
        const d = meters(at, [s.lat, s.lng]);
        return area ? d <= AREA_M && refs.some((r) => r.re.test(norm(s.street))) : d <= RADIUS_M + gap;
      });
  const houses = new Map<string, T>();
  for (const s of [...named, ...around]) {
    const key = norm(`${s.street}, ${s.number}`);
    if (!houses.has(key)) houses.set(key, s);
  }
  // Back in the order of `spots`, so a house we already have beats its OSM twin.
  const order = new Map(spots.map((s, i) => [s, i]));
  return { houses: [...houses.values()].sort((a, b) => order.get(a)! - order.get(b)!), point: at, streets: refs.map((r) => r.street) };
}

/** Houses of a news item (OSM-only ones get passports) and the point of the work; null when no city street is named. */
async function newsHouses(text: string, kind: WorkKind): Promise<{ ids: string[]; point: LatLng | null; streets: string[] } | null> {
  const spots = [
    ...(await prisma.building.findMany({ select: { id: true, address: true, lat: true, lng: true } })).map((b) => ({ ...splitAddress(b.address), lat: b.lat, lng: b.lng, id: b.id, osm: 0 })),
    ...[...allAddressPoints()].map((p) => ({ street: p[1], number: p[2], lat: p[3], lng: p[4], id: "", osm: p[0] })),
  ];
  const { houses, point, streets } = pickHouses(text, kind, spots);
  if (!streets.length) return null;
  const ids = new Set<string>();
  for (const h of houses) {
    const id = h.id || (await ensureOsmBuilding(h.osm)); // one at a time: two creations of one address would collide
    if (id) ids.add(id);
  }
  return { ids: [...ids], point, streets };
}

/** Reads the feed and saves its works; old ones it saved earlier are removed. */
export async function syncNewsWorks(now = new Date()) {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; mydom-vl works feed)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`newsvl.ru: HTTP ${res.status}`);
  const news = parseFeed(new TextDecoder("windows-1251").decode(await res.arrayBuffer())).filter(isWorkNews);
  // The prepared works were retold from the same site: a news item about one of them (same kind, same days, within
  // a kilometre — or, without a point, naming one of its streets) is not added twice.
  const prepared = await prisma.cityWork.findMany({ where: { sourceUrl: null } });

  let saved = 0;
  for (const n of news) {
    const text = `${n.title}.\n${n.text}`;
    const { start, end } = workDates(text, n.published);
    // The headline says what the works are; the text may add «без отключения электричества» to a road closure.
    const byText = summarizeDocument(text);
    const byTitle = summarizeDocument(n.title);
    const { kind, what } = byTitle.kind !== "other" ? byTitle : byText;
    const houses = await newsHouses(text, kind);
    if (!houses) continue;
    const { point } = houses;
    const where = [...new Map(byText.where.map((w) => [norm(w), w])).values()];
    const plainSummary = `${what}${where.length ? ` — ${where.join("; ")}` : ""}, ${periodLabel(start, end)}.`;
    const twin = prepared.some(
      (w) =>
        w.kind === kind &&
        w.startDate <= (end ?? start) &&
        (w.endDate ?? w.startDate) >= start &&
        (point && w.lat !== null && w.lng !== null
          ? meters([w.lat, w.lng], point) < 1000
          : houses.streets.some((s) => streetPattern(s)?.test(norm(w.sourceText)))),
    );
    if (twin) continue;
    const row = {
      title: n.title,
      sourceText: `${n.text}\nИсточник: newsvl.ru, ${n.published.toLocaleDateString("ru-RU", { timeZone: "Asia/Vladivostok" })}.`,
      plainSummary,
      kind,
      startDate: start,
      endDate: end,
      lat: point?.[0] ?? null,
      lng: point?.[1] ?? null,
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
