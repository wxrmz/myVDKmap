// Self-check for §6.5: npx tsx lib/health.test.ts
import assert from "node:assert/strict";
import { computeHealth } from "@/lib/health";

const now = new Date("2026-11-12T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const issue = (severity: number, days: number, status = "new") => ({ severity, status, createdAt: daysAgo(days) });
const many = (n: number) => Array.from({ length: n }, () => issue(1, 0));

// no issues, unknown year → perfect
assert.deepEqual(computeHealth({ issues: [] }, now), { score: 100, level: "good", label: "Всё хорошо", parts: [] });

// weights 6 / 10 / 15, plus the same weight × days/90 (capped at 1)
assert.equal(computeHealth({ issues: [issue(1, 0)] }, now).score, 94);
assert.equal(computeHealth({ issues: [issue(2, 0)] }, now).score, 90);
assert.equal(computeHealth({ issues: [issue(3, 0)] }, now).score, 85);
assert.equal(computeHealth({ issues: [issue(2, 45)] }, now).score, 85); // 10 + 10 × 0.5
assert.equal(computeHealth({ issues: [issue(3, 400)] }, now).score, 70); // 15 + 15 × 1
assert.equal(computeHealth({ issues: [issue(3, 400, "resolved")] }, now).score, 100);

// age: 5 free years, then 0.4 a year, at most 20
assert.equal(computeHealth({ issues: [], yearBuilt: 2021 }, now).score, 100);
assert.equal(computeHealth({ issues: [], yearBuilt: 1978 }, now).score, 83); // 48 − 5 = 43 × 0.4 = 17.2
assert.equal(computeHealth({ issues: [], yearBuilt: 1900 }, now).score, 80);
assert.equal(computeHealth({ issues: [], yearBuilt: null }, now).score, 100);

// levels
assert.equal(computeHealth({ issues: [issue(3, 400), issue(3, 400)] }, now).level, "bad"); // 40
assert.equal(computeHealth({ issues: [issue(3, 400), issue(3, 400)] }, now).label, "Нужно внимание");
assert.equal(computeHealth({ issues: [issue(3, 400)] }, now).label, "Есть проблемы"); // 70
assert.equal(computeHealth({ issues: many(7) }, now).score, 58);
assert.equal(computeHealth({ issues: many(9) }, now).score, 46);
assert.equal(computeHealth({ issues: many(30) }, now).score, 0); // clamped

// parts and plurals
const parts = (n: number) => computeHealth({ issues: many(n) }, now).parts[0];
assert.equal(parts(1), "1 открытая жалоба");
assert.equal(parts(2), "2 открытые жалобы");
assert.equal(parts(5), "5 открытых жалоб");
assert.equal(parts(11), "11 открытых жалоб");
assert.equal(parts(21), "21 открытая жалоба");
assert.equal(parts(22), "22 открытые жалобы");
assert.deepEqual(computeHealth({ issues: [issue(2, 45)], yearBuilt: 1978 }, now).parts, [
  "1 открытая жалоба",
  "Жалобы долго не решают",
  "Дому 48 лет",
]);
assert.deepEqual(computeHealth({ issues: [issue(2, 10)] }, now).parts, ["1 открытая жалоба"]);
const ageLabel = (year: number) => computeHealth({ issues: [], yearBuilt: year }, now).parts[0];
assert.equal(ageLabel(2005), "Дому 21 год");
assert.equal(ageLabel(2004), "Дому 22 года");
assert.equal(ageLabel(2015), "Дому 11 лет");
assert.equal(ageLabel(2023), undefined); // under 5 years: no penalty, no part

console.log("health: ok");
