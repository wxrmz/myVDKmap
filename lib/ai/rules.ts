// Rules (§6.1): keyword classification, the authority handbook, prepared fixtures and DB facts. Server only.
import { billChecks, billInsights } from "@/lib/bills";
import { prisma } from "@/lib/db";
import { BILL_ITEM_GLOSSARY, DEMO_BILLS, DEMO_BUILDING_ID, TARIFFS, periodLabel } from "@/lib/fixtures/bills";
import { DEMO_DOCUMENTS } from "@/lib/fixtures/documents";
import { plural } from "@/lib/health";
import { getAuthorities, getDistrict, getDistrictStats } from "@/lib/queries";
import { getWorkStreets, streetPattern } from "@/lib/search";
import { ISSUE_CATEGORY_LABELS, type BillItem, type BillKind, type IssueCategory, type WorkKind } from "@/lib/types";
import { norm, vlDay } from "@/lib/utils";
import type { BillInput, BillOutput, BillRaw, ClassifyInput, ClassifyOutput, DigestOutput, DocSummary } from "./schemas";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (now: number, before: number) => Math.round((now / before - 1) * 100);

// ---------------------------------------------------------------- classifyIssue

const CATEGORY_RULES: [IssueCategory, RegExp][] = [
  ["road", /яма|ямы|ямк|асфальт|дорог/],
  ["lighting", /фонар|свет|темно/],
  ["entrance", /подъезд/],
  ["flooding", /затоп|лужа|лужи|вода стоит|стоит вода|ливнев/],
  ["garbage", /мусор|контейнер|свалк/],
  ["elevator", /лифт|шахт/],
  ["roof", /крыш|протека/],
  ["yard", /двор|детская площадка|детской площадк|лавочк/],
  ["water", /вода из крана|из крана|нет воды|ржав/],
  ["noise", /шум|музык/],
];

/** Handbook phrase that names the body for each category (matched against `Authority.handles`). */
const HANDLE_FOR: Record<IssueCategory, string> = {
  road: "ямы на городских дорогах",
  lighting: "уличное освещение",
  entrance: "подъезд",
  flooding: "подтоплен",
  garbage: "мусор у дома",
  elevator: "лифт",
  roof: "крыша",
  yard: "уборка двора",
  water: "качество воды",
  noise: "шум",
  other: "универсальный канал",
};

/** Titles for a report with only a photo; with text, the resident's own words are the title. */
const TITLES: Record<IssueCategory, string> = {
  road: "Яма на дороге",
  lighting: "Не горит уличное освещение",
  entrance: "Неполадки в подъезде",
  flooding: "Подтопление после дождя",
  garbage: "Не убирают мусор",
  elevator: "Не работает лифт",
  roof: "Протекает крыша",
  yard: "Непорядок во дворе",
  water: "Плохая вода из крана",
  noise: "Шум мешает жителям",
  other: "Проблема у дома",
};

/** What the appeal says when there is only a photo. */
const PHOTO_DESCRIPTIONS: Partial<Record<IssueCategory, string>> = {
  road: "На проезжей части образовалась яма: покрытие разрушено, машины объезжают её, есть риск повредить колёса и упасть пешеходам.",
};

/** The demo photo (`pothole.svg`): by its path, or by the SVG text inside a data URL. */
function photoCategory(photo: string | undefined): IssueCategory | null {
  if (!photo) return null;
  let s = photo;
  const m = /^data:image\/svg\+xml(;base64)?,([\s\S]*)$/.exec(photo);
  if (m) s = m[1] ? Buffer.from(m[2], "base64").toString("utf8") : decodeURIComponent(m[2]);
  return /pothole/i.test(s) ? "road" : null;
}

/** Power gone in a flat or the whole house: not street lighting, and no body in the handbook covers it. */
const POWER_OUT = /электричеств|электроэнерг|розетк|(?:отключ|выключ|пропал|нет|отруб)\S* свет|свет\S* (?:в|во) (?:квартир|доме|всем доме)/;

/** First sentence of the description, up to ~60 characters, as the title. */
function titleFrom(text: string) {
  const first = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0].replace(/[.!?…]+$/, "");
  if (!first) return "";
  return cap(first.length <= 60 ? first : `${first.slice(0, 60).replace(/[\s,;:—-]+\S*$/, "")}…`);
}

const today = () => new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Vladivostok" });

export async function classifyIssue({ text, address, photo }: ClassifyInput): Promise<ClassifyOutput> {
  const t = norm(text);
  const power = POWER_OUT.test(t) && !/подъезд|фонар|улиц/.test(t);
  const rule = t && !power ? CATEGORY_RULES.find(([, re]) => re.test(t)) : undefined;
  const byPhoto = rule ? null : photoCategory(photo);
  const category: IssueCategory = rule?.[0] ?? byPhoto ?? "other";
  const indoors = category === "lighting" && /подъезд/.test(t);

  const authorities = await getAuthorities();
  const handle = indoors ? "свет в подъезде" : HANDLE_FOR[category];
  const authority =
    authorities.find((a) => a.handles.some((h) => norm(h).includes(handle))) ??
    authorities.find((a) => a.id === "pos") ??
    authorities[0];
  if (!authority) throw new Error("Authority handbook is empty: run the seed");
  const duty = authority.handles.find((h) => norm(h).includes(handle)) ?? authority.handles[0];

  const severity = /опасн|ребен|дети|детей|авари|травм|искрит|оголен/.test(t) ? 3 : /немного|небольш|слегка/.test(t) ? 1 : 2;
  const label = ISSUE_CATEGORY_LABELS[category];
  const word = rule && new RegExp(`[\\p{L}-]*(?:${rule[1].source})[\\p{L}-]*`, "u").exec(t)?.[0];
  const reasoning = power
    ? `Похоже на отключение электричества в доме, а не на уличное освещение. Обращение пойдёт через ${authority.name}: это ${duty}.`
    : word
    ? `В описании есть «${word}» — это категория «${label}». ${authority.name} отвечает за: ${duty}.`
    : byPhoto
      ? `На фото — разрушенное дорожное покрытие, значит категория «${label}». ${authority.name} отвечает за: ${duty}.`
      : `Точную категорию по описанию не определить, поэтому обращение пойдёт через ${authority.name}: это ${duty}.`;

  const description = text
    ? text.replace(/\s+/g, " ").replace(/([^.!?])$/, "$1.")
    : (PHOTO_DESCRIPTIONS[category] ?? "Проблема видна на приложенной фотографии.");
  const place = /владивосток/.test(norm(address)) ? address : `г. Владивосток, ${address}`;
  const appealText = [
    `Кому: ${authority.name}`,
    "ОБРАЩЕНИЕ",
    `Прошу принять меры по адресу: ${place}.`,
    cap(description),
    ...(severity === 3 ? ["Ситуация опасна для жителей, прошу рассмотреть обращение в первоочередном порядке."] : []),
    "Прошу провести проверку, устранить проблему и сообщить мне о принятых мерах и сроках их выполнения в установленный законом срок.",
    ...(photo ? ["Фотография прилагается."] : []),
    `Дата: ${today()}`,
  ].join("\n\n");

  const title = titleFrom(text) || (indoors ? "Не горит свет в подъезде" : TITLES[category]);
  return { category, title, severity, authorityId: authority.id, reasoning, appealText };
}

// ---------------------------------------------------------------- parseBill

const MONTHS = Array.from({ length: 12 }, (_, i) => periodLabel(`2000-${String(i + 1).padStart(2, "0")}`).split(" ")[0]);
const num = (s: string) => Number(s.replace(/[\s ]/g, "").replace(",", "."));
const SKIP_LINE = /^(адрес|площадь|расч|услуга|единый|лицев|период|плательщик|получатель)/;
/** A sum at the end of a line, «1234,56» or «1 234,56»: in «982.02 1 956.99» it is 1 956.99, not 21 956.99. */
const MONEY = /(?<![\d.,])((?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)[.,]\d{2})\s*(?:₽|руб\.?|рублей)?\s*$/;
/** Unit printed after a service name in GIS ЖКХ receipts: «м[3*]», «м[2*] общ. пл», «кВт.ч». */
const UNIT = /\s+(м\[[23]\*?\]|м[23²³]|квт\.?\s?ч)(\s+общ\.?\s*пл\.?)?$/iu;
const UNIT_LABEL: Record<string, string> = { 2: "м²", 3: "м³" };

/**
 * Lines of a receipt as text: the `demoBillText` format («name | volume unit × tariff | amount»), «name … amount», or the
 * text of a GIS ЖКХ payment document. In the latter, services are only the rows of the «Расчет размера платы» table: the
 * payee block above it and the reference volumes below it are not charges.
 */
const RESOURCE = /вод|сточн|электр|энерг|тепл|газ/;

function parseBillText(text: string): BillRaw {
  let period: string | undefined;
  let total: number | undefined;
  let periodSum: number | undefined;
  const items: BillItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const table = lines.findIndex((l) => /^расч[её]т размера платы/.test(norm(l)));
  let inTable = table < 0;
  // Rows after «в том числе» are the resources inside the row above (water, power for the common property), already in
  // its sum: not charges of their own, so they are left out. The first row that is not a resource ends the list.
  let partOf = false;
  lines.forEach((line, n) => {
    const l = norm(line);
    if (n === table) inTable = true;
    const month =
      /период[^\p{L}]*([\p{L}]+)\s+(\d{4})/u.exec(l) ?? /период\D*(\d{2})[./](\d{4})/.exec(l) ?? /^за\s+([\p{L}]+)\s*[-–—]?\s*(\d{4})/u.exec(l);
    if (month && !period) {
      const m = /^\d+$/.test(month[1]) ? Number(month[1]) : MONTHS.findIndex((x) => norm(x) === month[1]) + 1;
      if (m >= 1 && m <= 12) period = `${month[2]}-${String(m).padStart(2, "0")}`;
      return;
    }
    const money = MONEY.exec(line);
    if (/сумма к оплате за расч[её]тный период/.test(l)) {
      if (money && periodSum === undefined) periodSum = num(money[1]);
      return;
    }
    if (/итого|к оплате|всего/.test(l)) {
      // The first «Итого»: later ones are for penalties or include old debt.
      if (money && total === undefined) total = num(money[1]);
      if (/^итого/.test(l)) inTable = false; // the table ends at its «Итого»; column headers also say «к оплате»
      return;
    }
    if (/^в том числе/.test(l)) {
      partOf = true;
      return;
    }
    if (!inTable || !money || SKIP_LINE.test(l)) return;
    const parts = line.split("|").map((p) => p.trim());
    // Without «|» the name ends before the first number or «-» column standing apart: «Взнос … 54,30 м² × 12,00 651,60».
    let name = (parts.length > 1 ? parts[0] : line.slice(0, money.index).replace(/\s(?:\d|-\s)[\s\S]*$/, "")).replace(/[\s.…:–—-]+$/, "").trim();
    const unit = UNIT.exec(name);
    if (unit) name = name.slice(0, unit.index).trim();
    if (!/\p{L}/u.test(name)) return;
    if (partOf && RESOURCE.test(norm(name))) return;
    partOf = false;
    const item: BillItem = { name, amount: num(money[1]) };
    if (unit) item.unit = UNIT_LABEL[unit[1].replace(/\D/g, "")] ?? "кВт·ч";
    const use = /([\d.,]+)\s*(\S+)?\s*[×x*]\s*([\d\s.,]+?)\s*(?:₽|руб\.?)?$/.exec(parts.length > 2 ? parts.slice(1, -1).join(" ") : "");
    if (use) Object.assign(item, { volume: num(use[1]), ...(use[2] && { unit: use[2] }), tariff: num(use[3]) });
    items.push(item);
  });
  const sum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  return { ...(period && { period }), items, total: periodSum ?? total ?? sum };
}

const glossary = (name: string) =>
  BILL_ITEM_GLOSSARY[name] ?? Object.values(BILL_ITEM_GLOSSARY).find((g, i) => [Object.keys(BILL_ITEM_GLOSSARY)[i], g.plainName].some((k) => norm(k) === norm(name)));

const ACTIONS: [RegExp, string][] = [
  [/отоплен/, "Сравните сумму с соседями по дому. Если батареи грели плохо или отопление дали позже, попросите управляющую компанию сделать перерасчёт."],
  [/водоотвед|канализ/, "Канализация считается как горячая и холодная вода вместе: проверьте, что объём в квитанции равен сумме показаний ваших счётчиков."],
  [/вод/, "Сверьте показания счётчика с квитанцией и передавайте их вовремя — иначе начислят по среднему или по нормативу."],
  [/одн|общедом/, "Это общий расход дома. Если он растёт, спросите в управляющей компании показания общедомового счётчика."],
  [/электр/, "Сверьте показания счётчика электроэнергии с квитанцией и передавайте их вовремя — иначе начислят по среднему или по нормативу."],
  [/тко|мусор/, "Начисляется по нормативу на жильца: проверьте, сколько человек указано в квитанции."],
];
const actionFor = (name: string) =>
  ACTIONS.find(([re]) => re.test(norm(name)))?.[1] ?? "Сверьте объём с показаниями. Если сумма не сходится, попросите управляющую компанию её пересчитать.";

const money = (n: number) => n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Plain names, history of the house and «what changed and what to do» for recognised receipt lines.
 * The house history is made of combined housing receipts, so other kinds (capital repair, power) are not compared with it.
 */
async function analyzeBill(
  raw: BillRaw,
  buildingId = DEMO_BUILDING_ID,
  kind: BillKind = "housing",
  previous: BillInput["previous"] = [],
): Promise<BillOutput> {
  const rows = kind === "housing" ? await prisma.bill.findMany({ where: { buildingId }, orderBy: { period: "asc" } }) : [];
  const house: { period: string; items: BillItem[]; total: number }[] = rows.length
    ? rows.map((b) => ({ period: b.period, items: JSON.parse(b.items) as BillItem[], total: b.total }))
    : kind === "housing" && buildingId === DEMO_BUILDING_ID
      ? DEMO_BILLS
      : [];
  // The resident's own receipts win over the house history for the same month: they are this flat's numbers.
  const own = new Map(previous.map((b) => [b.period, b]));
  const history = [...house.filter((b) => !own.has(b.period)), ...own.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
  const earlier = history.filter((b) => !raw.period || b.period < raw.period);
  const prev = earlier.at(-1);
  const same = (a: string, b: string) => norm(a) === norm(b);

  const changes: BillOutput["changes"] = [];
  for (const item of raw.items) {
    const before = prev?.items.find((i) => same(i.name, item.name));
    const amountDelta = before && before.amount > 0 ? pct(item.amount, before.amount) : null;
    const tariff = item.tariff && Object.values(TARIFFS).find((t) => Math.abs(t.new - item.tariff!) < 0.005);
    const tariffNote = tariff ? `тариф с 1 октября 2026 вырос с ${money(tariff.old)} до ${money(tariff.new)} ₽ за ${tariff.unit}` : "";

    const has = (b: { items: BillItem[] }) => b.items.some((i) => same(i.name, item.name));
    if (/отоплен/.test(norm(item.name)) && (!before || earlier.some((b) => !has(b)))) {
      const start = earlier.find((b, i) => i > 0 && has(b) && !has(earlier[i - 1]))?.period ?? raw.period;
      const since = start ? /* month to genitive: октябрь → октября, март → марта */ ` с ${periodLabel(start).replace(/[ьй] /, "я ").replace(/т /, "та ")}` : "";
      changes.push({
        item: item.name,
        deltaPercent: amountDelta ?? 100,
        likelyReason: `Начался отопительный сезон: отопление начисляют${since}, а сумма зависит от погоды и общедомового счётчика тепла${tariffNote ? `; кроме того, ${tariffNote}` : ""}.`,
        action: actionFor(item.name),
      });
    } else if (tariff && pct(tariff.new, tariff.old) >= 3) {
      changes.push({ item: item.name, deltaPercent: pct(tariff.new, tariff.old), likelyReason: `Индексация: ${tariffNote}.`, action: actionFor(item.name) });
    } else if (amountDelta !== null && amountDelta >= 3) {
      const volumes = before?.volume !== undefined && item.volume !== undefined;
      changes.push({
        item: item.name,
        deltaPercent: amountDelta,
        likelyReason:
          volumes && item.volume! > before!.volume!
            ? `Расход вырос: ${[item.volume, item.unit].filter(Boolean).join(" ")} против ${before!.volume} в прошлом месяце.`
            : volumes
              ? "Сумма выросла при том же объёме — уточните причину в управляющей компании."
              : `Сумма выросла: ${money(item.amount)} ₽ против ${money(before!.amount)} ₽ в прошлом месяце.`,
        action: actionFor(item.name),
      });
    } else if (amountDelta !== null && amountDelta <= -3) {
      changes.push({
        item: item.name,
        deltaPercent: amountDelta,
        likelyReason: `Сумма снизилась: ${money(item.amount)} ₽ против ${money(before!.amount)} ₽ в прошлом месяце.`,
        action: "Ничего делать не нужно. Если снижение большое, а расход прежний, проверьте, не начислили ли по среднему вместо показаний.",
      });
    }
  }

  const totals = new Map(history.map((b) => [b.period, b.total]));
  if (raw.period) totals.set(raw.period, raw.total);
  const items = raw.items.map((i) => {
    const g = glossary(i.name);
    return { ...i, plainName: g?.plainName ?? i.name, explanation: g?.explanation ?? "Этой строки нет в нашем справочнике: что именно в неё входит, подскажет управляющая компания." };
  });
  const byMonth = [...totals].sort(([a], [b]) => (a < b ? -1 : 1)).map(([period, total]) => ({ period, total }));
  return {
    ...(raw.period && { period: raw.period }),
    items,
    total: raw.total,
    history: byMonth,
    changes,
    checks: billChecks(items, raw.total),
    insights: billInsights(items, raw.total, byMonth, raw.period),
  };
}

const latestDemoBill = (): BillRaw => {
  const { period, items, total } = DEMO_BILLS.at(-1)!;
  return { period, items, total };
};

/** Null when there is no text to read (a PDF without a text layer). */
export async function parseBill({ buildingId, text, demo, kind = "housing", previous }: Partial<BillInput>): Promise<BillOutput | null> {
  if (demo) return analyzeBill(latestDemoBill(), DEMO_BUILDING_ID);
  if (!text) return null;
  return analyzeBill(parseBillText(text), buildingId ?? DEMO_BUILDING_ID, kind, previous);
}

// ---------------------------------------------------------------- summarizeDocument

const demoDocument = (text: string) => DEMO_DOCUMENTS.find((d) => norm(d.sourceText).trim() === norm(text).trim());

/**
 * House numbers at the start of `s` (the text right after a street name): «д. 5», «дома 3–11», «5, 7, 9», «с 1 по 15», «13ж».
 * `length` is how many characters of `s` the numbers took.
 */
function parseHouseNumbers(s: string): { numbers: string[]; length: number } {
  const t = norm(s);
  // «1-й Лесной» after a street is the next street, not house 1.
  const item = /(?:с\s+)?(\d{1,3})(?!\d)(?![-–][а-я])([а-я]?)(?:\s*(?:[-–—]|по)\s*(\d{1,3})[а-я]?)?(?![\p{L}\d:.])(?!\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря))/uy;
  const sep = /\s*(?:,\s*(?:и\s+)?|\s+и\s+)(?:(?:д\.|дом(?:а|ов)?)\s*)?/uy;
  let i = /^[\s,]*(?:(?:д\.|дом(?:а|ов)?|№)\s*)?/u.exec(t)![0].length;
  const numbers: string[] = [];
  let length = 0;
  for (;;) {
    item.lastIndex = i;
    const m = item.exec(t);
    if (!m) break;
    const [from, to] = [Number(m[1]), m[3] ? Number(m[3]) : null];
    if (to !== null && to > from && to - from <= 200) for (let n = from; n <= to; n++) numbers.push(String(n));
    else numbers.push(`${m[1]}${m[2]}`, ...(to !== null ? [String(to)] : []));
    length = i = item.lastIndex;
    sep.lastIndex = i;
    if (!sep.exec(t)) break;
    i = sep.lastIndex;
  }
  return { numbers, length };
}

export const houseNumbers = (s: string) => parseHouseNumbers(s).numbers;

/** Streets of the city named in the text, each with the house numbers written right after its mentions. */
export function streetRefs(text: string) {
  const t = norm(text);
  const found = getWorkStreets([{ id: "doc", title: "", plainSummary: "", sourceText: text, buildings: [] }]).doc ?? [];
  // «Зелёный Бульвар» in the text also matches «пер. Зелёный»: a street whose name is part of another found one is dropped.
  const name = (street: string) => norm(street.replace(/^\S+\.\s*/, "")).split(/\s+/);
  const named = found
    .filter((a) => !found.some((b) => name(b).length > name(a).length && name(a).every((w) => name(b).includes(w))))
    .map((street) => {
      const re = streetPattern(street)!;
      // Street names are capitalised: «ул. Связи» counts, «в связи с» does not.
      const spans = [...t.matchAll(new RegExp(re.source, "gu"))]
        .filter((m) => /\p{Lu}/u.test(text.slice(m.index, m.index + m[0].length)))
        .map((m): [number, number] => [m.index, m.index + m[0].length]);
      return { street, re, spans };
    });
  // A mention inside a longer one of another street is that street's: «Лесной» in «1-й Лесной» is not «пер. Лесной».
  const inside = ([a, b]: [number, number], self: (typeof named)[number]) =>
    named.some((o) => o !== self && o.spans.some(([c, d]) => c <= a && b <= d && d - c > b - a));
  return named.flatMap((n) => {
    const mentions = n.spans.filter((span) => !inside(span, n));
    if (!mentions.length) return [];
    const numbers: string[] = [];
    let raw = "";
    for (const [, end] of mentions) {
      const after = text.slice(end);
      const p = parseHouseNumbers(after);
      numbers.push(...p.numbers);
      if (p.numbers.length && !raw) raw = after.slice(0, p.length).replace(/^[\s,]+/, "");
    }
    return [{ street: n.street, re: n.re, numbers, raw }];
  });
}

export const houseMatches = (numbers: string[], houseNumber: string) => {
  const token = /^\d+[а-я]?/.exec(norm(houseNumber).trim())?.[0];
  return !!token && numbers.some((n) => n === token || n === /^\d+/.exec(token)![0]);
};

/** Houses in the DB the text points to: the seeded impacts for a demo document, otherwise streets plus house numbers. */
export async function bindBuildings(text: string): Promise<{ id: string; address: string }[]> {
  const demo = demoDocument(text);
  if (demo) {
    const impacts = await prisma.cityWorkImpact.findMany({
      where: { workId: demo.id },
      select: { building: { select: { id: true, address: true } } },
      orderBy: { building: { address: "asc" } },
    });
    return impacts.map((i) => i.building);
  }
  const refs = streetRefs(text);
  if (!refs.length) return [];
  const buildings = await prisma.building.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } });
  return buildings.filter((b) => {
    const comma = b.address.indexOf(",");
    const street = norm(comma < 0 ? b.address : b.address.slice(0, comma));
    const number = comma < 0 ? "" : b.address.slice(comma + 1);
    return refs.some((r) => r.re.test(street) && (!r.numbers.length || houseMatches(r.numbers, number)));
  });
}

const KIND_RULES: [WorkKind, RegExp][] = [
  ["cap_repair", /капремонт|капитальн\S* ремонт/],
  ["utility_outage", /отключ|горяч|холодн|электр|водоснабж|водопровод|теплотрасс|без отоплен/],
  ["road", /асфальт|дорог|проезд|перекры|перекрест|движени/],
  ["improvement", /благоустр|сквер|парк(?!ов)/],
  ["construction", /строит|мост/],
];
const MONTH_GEN = "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря";
const DATE_RE = new RegExp(
  `(?:(?:с|со|до|по)\\s+)?(?:\\d{1,2}(?:\\s*[–—-]\\s*\\d{1,2})?\\s+(?:${MONTH_GEN})(?:\\s+\\d{4}(?:\\s+года)?)?|\\d{2}\\.\\d{2}\\.\\d{4})` +
    `(?:,?\\s+с\\s+\\d{1,2}[:.]\\d{2}\\s+до\\s+\\d{1,2}[:.]\\d{2})?`,
  "giu",
);
const ABBR = "ул|д|г|пр|пр-т|просп|корп|кв|пер|пл|наб|ш|стр|ст|им|тыс|млн|млрд|руб|к|с";
const SENTENCE_END = new RegExp(`(?<!(?:^|[\\s(])(?:${ABBR}))[.!?]+(?=\\s|$)`, "iu");

/** First sentence that says something: greetings such as «Уважаемые жители!» are skipped. */
function firstSentence(text: string) {
  let rest = text;
  let s = "";
  while (rest.trim()) {
    const m = SENTENCE_END.exec(rest);
    s = (m ? rest.slice(0, m.index) : rest).replace(/\s+/g, " ").trim();
    rest = m ? rest.slice(m.index + m[0].length) : "";
    if (s.split(" ").length >= 4 && !/^(уважаем|внимание|объявление)/.test(norm(s))) break;
  }
  return s.length <= 90 ? s : `${s.slice(0, s.lastIndexOf(" ", 86))}…`;
}

const RESOURCES: [RegExp, string][] = [
  [/горяч/, "горячей воды"],
  [/холодн/, "холодной воды"],
  [/отоплен|теплотрасс/, "отопления"],
  [/электр|свет/, "электричества"],
];

const ADVICE: Record<WorkKind, string> = {
  utility_outage: "Подготовьтесь заранее и уточняйте сроки в управляющей компании.",
  road: "Заложите время на объезд и не оставляйте машину на участке работ.",
  cap_repair: "Уточните график работ в управляющей компании.",
  improvement: "На время работ часть территории может быть огорожена.",
  construction: "Рядом со стройкой возможны шум и ограничения движения.",
  other: "Подробности — в исходном тексте объявления.",
};

export function summarizeDocument(text: string): DocSummary {
  const prepared = demoDocument(text);
  if (prepared) return prepared.summary;

  const body = text.replace(/источник:.*$/gimu, "").trim(); // publication dates are not the dates of the works
  const t = norm(body);
  const kind = KIND_RULES.find(([, re]) => re.test(t))?.[0] ?? "other";
  const where = streetRefs(body).map((r) => (r.raw ? `${r.street}, ${r.raw}` : r.street));
  const dates = [...new Set([...body.matchAll(DATE_RE)].map((m) => m[0].replace(/\s+/g, " ").trim()))];
  const when = dates.length ? dates.join(", ").replace(/^./, (c) => c.toLowerCase()) : "сроки в тексте не указаны";
  const title = firstSentence(body);

  const resources = RESOURCES.filter(([re]) => re.test(t)).map(([, r]) => r);
  const what =
    kind === "utility_outage"
      ? `${/авари/.test(t) ? "Аварийное отключение" : "Отключение"} ${resources.length ? resources.join(" и ") : "коммунальных услуг"}`
      : kind === "road"
        ? /перекры|ограничен/.test(t) ? "Ограничение движения" : "Ремонт дороги"
        : kind === "cap_repair"
          ? "Капитальный ремонт дома"
          : kind === "improvement"
            ? "Благоустройство территории"
            : kind === "construction"
              ? "Строительные работы"
              : title;

  const plainSummary = `${what}${where.length ? ` — ${where.join("; ")}` : ""}${dates.length ? `, ${when}` : ""}. ${ADVICE[kind]}`;
  const whoAffected = where.length
    ? `${kind === "utility_outage" ? "Жители домов" : "Жители и водители"}: ${where.join("; ")}`
    : "Жители домов, указанных в объявлении";
  return { title, plainSummary, what, where, when, whoAffected, kind };
}

// ---------------------------------------------------------------- districtDigest

/** Facts a digest may use; null when there is no such district. */
export async function districtFacts(id: string) {
  const district = await getDistrict(id);
  if (!district) return null;
  const startOfToday = new Date(`${vlDay(Date.now())}T00:00:00+10:00`); // Vladivostok has no daylight saving
  const [stats, works] = await Promise.all([
    getDistrictStats(id),
    prisma.cityWork.count({
      where: {
        OR: [{ endDate: null }, { endDate: { gte: startOfToday } }],
        impacts: { some: { building: { microdistrict: { districtId: id } } } },
      },
    }),
  ]);
  return {
    name: `${district.name} район`,
    population: district.population,
    populationYear: district.populationYear,
    complexes: district.complexCount,
    buildings: district.buildingCount,
    openIssues: stats.openIssues,
    resolvedIssues: stats.totalIssues - stats.openIssues,
    topCategories: stats.topCategories.map((c) => ({ category: ISSUE_CATEGORY_LABELS[c.category], count: c.count })),
    activeWorks: works,
  };
}
type DistrictFacts = NonNullable<Awaited<ReturnType<typeof districtFacts>>>;

export function districtDigest(f: DistrictFacts): DigestOutput {
  const prepositional = f.name.replace(/ий район$/, "ом районе");
  const n = (x: number) => x.toLocaleString("ru-RU");
  const top = f.topCategories.slice(0, 2).map((c) => `«${c.category}» (${c.count})`);
  const sentences = [
    `В ${prepositional} живут ${n(f.population)} человек (данные ${f.populationYear} года); на карте — ${f.complexes} ЖК и ${n(f.buildings)} ${plural(f.buildings, ["дом", "дома", "домов"])}.`,
    f.openIssues
      ? `Сейчас открыто ${f.openIssues} ${plural(f.openIssues, ["обращение", "обращения", "обращений"])} жителей, чаще всего — ${top.join(" и ")}.`
      : "Открытых обращений жителей сейчас нет.",
    ...(f.resolvedIssues ? [`Уже решено ${f.resolvedIssues} из ${f.openIssues + f.resolvedIssues}.`] : []),
    f.activeWorks
      ? `Городских работ, которые идут или скоро начнутся и касаются домов района: ${f.activeWorks}.`
      : "Городских работ, которые касаются домов района, сейчас не объявлено.",
  ];
  return { text: sentences.join(" ") };
}
