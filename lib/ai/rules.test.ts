// Self-check for the rules layer (§6.1): npx tsx lib/ai/rules.test.ts (needs the seeded DB).
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { DEMO_BILL_TEXTS, DEMO_BILLS } from "@/lib/fixtures/bills";
import { DEMO_DOCUMENTS } from "@/lib/fixtures/documents";
import { norm } from "@/lib/utils";
import { bindBuildings, classifyIssue, districtDigest, districtFacts, houseNumbers, parseBill, summarizeDocument } from "./rules";
import { BillOutputSchema, ClassifyOutputSchema, DocSummarySchema } from "./schemas";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

async function main() {
  // --- classifyIssue ---
  const pothole = await classifyIssue({ text: "Огромная яма на дороге у дома, машины бьют колёса", address: "ул. Нейбута, 17" });
  assert.equal(pothole.category, "road");
  assert.equal(pothole.authorityId, "city_admin");
  ClassifyOutputSchema.parse(pothole);
  assert.ok(!/(?<![\p{L}])ст\./u.test(pothole.appealText), "no «ст.»");
  assert.ok(!/стать/i.test(pothole.appealText), "no «статья»");
  assert.ok(!/№\s*\d+-ФЗ/i.test(pothole.appealText), "no law numbers");
  assert.ok(pothole.appealText.includes("Администрация г. Владивостока") && pothole.appealText.includes("ул. Нейбута, 17"));

  const photoOnly = await classifyIssue({ text: "", address: "ул. Нейбута, 17", photo: "/demo/pothole.svg" });
  assert.equal(photoOnly.category, "road");
  assert.equal(photoOnly.authorityId, "city_admin");
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg id="pothole"/>').toString("base64")}`;
  assert.equal((await classifyIssue({ text: "", address: "x", photo: svg })).category, "road");

  const cases: [string, string, string][] = [
    ["Не горят фонари, вечером темно", "lighting", "city_admin"],
    ["Не горит свет в подъезде", "lighting", "uk"],
    ["Двор затапливает, вода стоит неделю", "flooding", "city_admin"],
    ["Лифт не работает третий день", "elevator", "uk"],
    ["Из крана течёт ржавая вода", "water", "rpn"],
    ["Соседи включают громкую музыку ночью", "noise", "rpn"],
    ["Сломалась входная дверь", "other", "pos"],
  ];
  for (const [text, category, authorityId] of cases) {
    const r = await classifyIssue({ text, address: "ул. Нейбута, 17" });
    assert.deepEqual([r.category, r.authorityId], [category, authorityId], text);
  }
  assert.equal((await classifyIssue({ text: "Опасная яма, ребёнок упал", address: "x" })).severity, 3);

  // --- parseBill ---
  const demo = BillOutputSchema.parse(await parseBill({ demo: true }));
  assert.equal(demo.period, DEMO_BILLS.at(-1)!.period);
  const delta = (word: string) => demo.changes.find((c) => norm(c.item).includes(word));
  assert.equal(delta("холодн")?.deltaPercent, 14);
  assert.equal(delta("водоотвед")?.deltaPercent, 17);
  assert.match(delta("отоплен")?.likelyReason ?? "", /с октября/);
  assert.ok(demo.items.every((i) => i.plainName && i.explanation));
  assert.ok(demo.history.length >= 3 && demo.history.at(-1)!.period === demo.period);

  const fromText = (await parseBill({ text: DEMO_BILL_TEXTS["2026-11"] }))!;
  assert.equal(fromText.period, "2026-11");
  assert.equal(fromText.items.length, DEMO_BILLS.at(-1)!.items.length);
  assert.equal(fromText.total, DEMO_BILLS.at(-1)!.total);
  assert.deepEqual(fromText.changes, demo.changes);
  const loose = (await parseBill({ text: "Холодная вода ........ 320,64 руб.\nДомофон — 60,00\nИтого: 380,64" }))!;
  assert.deepEqual(loose.items.map((i) => [i.name, i.amount]), [["Холодная вода", 320.64], ["Домофон", 60]]);
  assert.equal(loose.total, 380.64);
  // No text, no receipt (never the demo); a capital repair receipt shows only its own line, with no ЖКУ history.
  assert.equal(await parseBill({}), null);
  const capital = (await parseBill({ kind: "capital", text: "Период: ноябрь 2026\nВзнос на капитальный ремонт 54,30 м² × 12,00 651,60\nИтого к оплате: 651,60" }))!;
  assert.deepEqual(capital.items.map((i) => [i.name, i.amount]), [["Взнос на капитальный ремонт", 651.6]]);
  assert.deepEqual([capital.changes, capital.history], [[], [{ period: "2026-11", total: 651.6 }]]);

  // --- houseNumbers ---
  assert.deepEqual(houseNumbers(", д. 5"), ["5"]);
  assert.deepEqual(houseNumbers(" дома 3–11"), range(3, 11));
  assert.deepEqual(houseNumbers(" 5, 7, 9"), ["5", "7", "9"]);
  assert.deepEqual(houseNumbers(", дома с 1 по 15"), range(1, 15));
  assert.deepEqual(houseNumbers(", д. 12–20 отключат"), range(12, 20));
  assert.deepEqual(houseNumbers(", 13ж, корп. 1"), ["13ж"]);
  assert.deepEqual(houseNumbers(", д. 5 и 7"), ["5", "7"]);
  assert.deepEqual(houseNumbers(" без отопления"), []);
  assert.deepEqual(houseNumbers(", 20 ноября"), []);

  // --- summarizeDocument ---
  for (const d of DEMO_DOCUMENTS) {
    assert.equal(summarizeDocument(d.sourceText).title, d.summary.title);
    assert.ok((await bindBuildings(d.sourceText)).length >= 1, d.id);
  }
  const custom = "С 20 ноября на ул. Посьетской, д. 12–20 отключат горячую воду";
  const s = DocSummarySchema.parse(summarizeDocument(custom));
  assert.equal(s.kind, "utility_outage");
  assert.ok(s.where.some((w) => w.includes("Посьетская")), s.where.join());
  assert.match(s.when, /20 ноября/);
  const onStreet = (await prisma.building.findMany({ select: { address: true } })).filter((b) => {
    const [street, number = ""] = b.address.split(", ");
    return /посьетск/.test(norm(street)) && range(12, 20).includes(/^\d+/.exec(number)?.[0] ?? "");
  });
  assert.equal((await bindBuildings(custom)).length, onStreet.length);
  const neybuta = await prisma.building.findFirst({ where: { address: { startsWith: "ул. Нейбута, " } } });
  if (neybuta) {
    const bound = await bindBuildings(`Отключат холодную воду: ${neybuta.address}.`);
    assert.ok(bound.some((b) => b.id === neybuta.id));
  }

  // --- districtDigest ---
  const facts = await districtFacts("leninsky");
  assert.ok(facts);
  const sentences = districtDigest(facts).text.match(/[.!?](?=\s|$)/g) ?? [];
  assert.ok(sentences.length >= 3 && sentences.length <= 4, districtDigest(facts).text);
  assert.equal(await districtFacts("nowhere"), null);

  console.log("rules: ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
