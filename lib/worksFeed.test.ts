// Self-check: npx tsx lib/worksFeed.test.ts
import assert from "node:assert/strict";
import { isWorkNews, parseFeed, periodLabel, workDates, workPoint } from "./worksFeed";

const xml = `<rss><channel><title>Новости</title>
<item><title>Проезд по улице Крыгина частично перекрыли на 14 и 15 ноября </title>
<link>https://www.newsvl.ru/shallnotpass/2026/11/14/241495/</link>
<description><![CDATA[В эти выходные, 14 и 15 ноября, проезд по улице Крыгина будет частично ограничен &amp; без отключений.

Читать полностью: https://www.newsvl.ru/shallnotpass/2026/11/14/241495/]]></description>
<pubDate>Sat, 14 Nov 2026 07:00:49 +1000</pubDate></item>
<item><title>Без ссылки на статью</title><link>https://www.newsvl.ru/</link><description>x</description><pubDate>Sat, 14 Nov 2026 07:00:49 +1000</pubDate></item>
</channel></rss>`;

const items = parseFeed(xml);
assert.equal(items.length, 1, "an item without an article id is dropped");
assert.equal(items[0].id, "news-241495");
assert.equal(items[0].title, "Проезд по улице Крыгина частично перекрыли на 14 и 15 ноября");
assert.equal(items[0].text, "В эти выходные, 14 и 15 ноября, проезд по улице Крыгина будет частично ограничен & без отключений.");
assert.ok(isWorkNews(items[0]));
assert.ok(!isWorkNews({ title: "Сегодня во Владивостоке без осадков и до +8 °C" }));
assert.ok(!isWorkNews({ title: "На АЗС снова подорожало топливо" }));
assert.ok(!isWorkNews({ title: "Дети разбили унитаз и затопили туалет в школе на Постышева" }), "«перекрыли воду» in the text does not count");
assert.ok(isWorkNews({ title: "Почти 150 адресов остались без света" }));
assert.ok(isWorkNews({ title: "Ремонт перекрестка в Снеговой Пади перевели в круглосуточный режим" }));

const pub = new Date("2026-11-14T07:00:00+10:00");
const day = (d: Date | null) => d?.toLocaleDateString("en-CA", { timeZone: "Asia/Vladivostok" }) ?? null;
const span = (text: string, published = pub) => {
  const { start, end } = workDates(text, published);
  return [day(start), day(end)];
};
assert.deepEqual(span(items[0].text), ["2026-11-14", "2026-11-15"]);
assert.deepEqual(span("Проезд закрыт до 1 декабря."), ["2026-11-14", "2026-12-01"], "«до» alone starts on the publication day");
assert.deepEqual(span("С 10 ноября по 5 декабря меняют трубы."), ["2026-11-10", "2026-12-05"]);
assert.deepEqual(span("Работы 20–25 ноября."), ["2026-11-20", "2026-11-25"]);
assert.deepEqual(span("Отключение 03.12.2026 с 9:00 до 17:00."), ["2026-12-03", "2026-12-03"]);
assert.deepEqual(span("Ремонт продлится до 15 января."), ["2026-11-14", "2027-01-15"], "January after November is next year");
assert.deepEqual(span("Почти 150 адресов остались без света."), ["2026-11-14", null], "no dates: the publication day, no end");
assert.deepEqual(span("Проезд закроют 2 ноября", new Date("2026-11-05T10:00:00+10:00")), ["2026-11-02", "2026-11-02"], "a recent past day stays this year");

const at = (d: string) => new Date(`${d}T12:00:00+10:00`);
assert.equal(periodLabel(at("2026-11-14"), at("2026-11-15")), "14–15 ноября");
assert.equal(periodLabel(at("2026-11-14"), at("2026-12-01")), "14 ноября — 1 декабря");
assert.equal(periodLabel(at("2026-11-13"), at("2026-11-13")), "13 ноября");
assert.equal(periodLabel(at("2026-11-13"), null), "с 13 ноября");

// Places: ~0.0009° of latitude is 100 m.
const along = (lat: number, lng: number, n: number, dLat: number, dLng: number) =>
  Array.from({ length: n }, (_, i): [number, number] => [lat + i * dLat, lng + i * dLng]);
const ns = along(43.1, 131.9, 11, 0.0009, 0); // 1 km north–south
const ew = along(43.1045, 131.895, 11, 0, 0.00124); // 1 km west–east, crossing it in the middle
const crossing = workPoint([ns, ew])!;
assert.ok(Math.abs(crossing.at[0] - 43.1045) < 0.0005 && Math.abs(crossing.at[1] - 131.9) < 0.0007, "two streets meet at their crossing");
assert.ok(crossing.gap < 60);
assert.equal(workPoint([ns, along(43.2, 132.0, 5, 0.0009, 0)]), null, "streets far apart pin no place");
const parallel = along(43.1, 131.91, 11, 0.0009, 0); // 800 m east of «ns»: «от … до …»
const between = workPoint([ns, parallel])!;
assert.ok(Math.abs(between.at[1] - 131.905) < 0.0001, "two streets 800 m apart: the place between them");
assert.ok(Math.abs(between.gap - 405) < 10, "houses are searched half the gap wider");
assert.deepEqual(workPoint([[], ns.slice(0, 5)]), { at: ns[2], gap: 0 }, "a street without points is skipped; a short one gives its middle house");
assert.equal(workPoint([along(43.1, 131.9, 30, 0.0009, 0)]), null, "a 2.6 km street pins no place");
assert.equal(workPoint([]), null);

console.log("worksFeed: ok");
