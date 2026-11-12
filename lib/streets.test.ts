// Self-check for §6.4: npx tsx lib/streets.test.ts
import assert from "node:assert/strict";
import { getWorkStreets, streetPattern } from "@/lib/search";
import { norm } from "@/lib/utils";

const finds = (street: string, text: string) => {
  const re = streetPattern(street);
  return !!re && re.test(norm(text));
};

// finds
assert.ok(finds("ул. Посьетская", "Ремонт тротуара на Посьетской"));
assert.ok(finds("пр. Океанский", "Перекроют движение по Океанскому проспекту"));
assert.ok(finds("ул. Руднева", "Отключение воды: ул. Руднева, 5"));

// does not find
assert.ok(!finds("ул. Приморская", "Работы ведёт Приморский водоканал"));
assert.ok(!finds("ул. Невская", "Ремонт на ул. Рудневского"));
assert.ok(!finds("ул. Русская", "Отключение на Белорусской улице"));
assert.ok(!finds("ул. Адмирала Фокина", "Ремонт на ул. Адмирала Невельского"));
assert.ok(!finds("ул. Первая", "Подтопление в районе Первой Речки"));
assert.ok(!finds("ул. Первая Речка", "Подтопление в районе Первой Речки"));

// no pattern for short main words
assert.equal(streetPattern("ул. 5-й"), null);

// the word-start guard is what keeps «Русская» out of «Белорусской»
const re = streetPattern("ул. Русская")!;
const unguarded = new RegExp(re.source.replace("(?<![\\p{L}\\d])", ""), re.flags);
assert.notEqual(unguarded.source, re.source, "streetPattern must guard the start of the word");
assert.ok(unguarded.test(norm("на Белорусской улице")));
assert.ok(!re.test(norm("на Белорусской улице")));

// getWorkStreets: streets from the text and from affected addresses
const streets = getWorkStreets([
  { id: "w1", title: "Ремонт дороги", plainSummary: "Ремонт на Посьетской", sourceText: "", buildings: [{ address: "ул. Нейбута, 4" }] },
  { id: "w2", title: "Работы ведёт Приморский водоканал", plainSummary: "", sourceText: "", buildings: [] },
]);
assert.ok(streets.w1.includes("ул. Посьетская"));
assert.ok(streets.w1.includes("ул. Нейбута"));
assert.ok(!streets.w2.includes("ул. Приморская"));

console.log("streets: ok");
