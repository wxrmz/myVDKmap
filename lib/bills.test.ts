// Self-check for receipt analytics: npx tsx lib/bills.test.ts
import assert from "node:assert/strict";
import { billChecks, billInsights, lineDeltas } from "./bills";

const good = [
  { name: "Горячее водоснабжение", amount: 538.9, unit: "м³", volume: 2, tariff: 269.45 },
  { name: "Холодное водоснабжение", amount: 160.32, unit: "м³", volume: 3, tariff: 53.44 },
  { name: "Водоотведение", amount: 208.4, unit: "м³", volume: 5, tariff: 41.68 },
  { name: "в т. ч. Холодная вода", amount: 10 },
];
const ok = billChecks(good, 907.62);
assert.ok(ok.every((c) => c.ok), JSON.stringify(ok));
assert.equal(ok.length, 3); // sum, volume × tariff, sewerage

const bad = billChecks(
  [
    { name: "Горячее водоснабжение", amount: 600, volume: 2, tariff: 269.45 },
    { name: "Холодное водоснабжение", amount: 160.32, volume: 3, tariff: 53.44 },
    { name: "Водоотведение", amount: 250.08, volume: 6, tariff: 41.68 },
    { name: "Домофон", amount: 60 },
    { name: "Домофон", amount: 60 },
  ],
  1200,
);
assert.equal(bad.filter((c) => !c.ok).length, 4, JSON.stringify(bad)); // sum, hot water, sewerage, repeated line
assert.match(bad[0].text, /разница 69,60/);

const deltas = lineDeltas([{ name: "Отопление", amount: 1100 }, { name: "Домофон", amount: 60 }], [{ name: "отопление", amount: 1000 }]);
assert.deepEqual(deltas.map((d) => d.delta), [10, undefined]);

const insights = billInsights(good, 907.62, [
  { period: "2026-08", total: 800 },
  { period: "2026-09", total: 1000 },
  { period: "2026-10", total: 907.62 },
], "2026-10");
assert.equal(insights.length, 3, insights.join("\n"));
assert.match(insights[0], /Горячее водоснабжение.*59 %/);
assert.match(insights[1], /сентябрь 2026\): −92,38 ₽ \(−9 %\)/);
assert.match(insights[2], /2 прошлых месяца — 900,00 ₽, этот месяц на 1 % дороже/);
assert.deepEqual(billInsights([], 0, []), []);

console.log("bills: ok");
