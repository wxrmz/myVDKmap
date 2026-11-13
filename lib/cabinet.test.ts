// Self-check for mergeCabinets (§5.8): npx tsx lib/cabinet.test.ts
import assert from "node:assert/strict";
import { mergeCabinets, parseCabinet } from "./cabinet";

const issue = (id: string, title = id) => ({ id, title, category: "road" as const, address: "ул. Нейбута, 17", buildingId: null, createdAt: "2026-11-01" });
const settings = (updatedAt: number, fontScale: 1 | 1.125 | 1.25) => ({
  updatedAt,
  fontScale,
  notify: { email: true, telegram: false, works: true, issues: true },
  meterDay: 20,
});

const server = parseCabinet({
  houses: ["a", "b"],
  issues: [issue("i1", "server")],
  meters: [{ id: "m1", kind: "cold", value: 10, date: "2026-10-20" }],
  votes: [{ id: "a:barrier", houseId: "a", choice: "no", at: "2026-10-01T00:00:00.000Z" }],
  draft: { updatedAt: 5, step: 1, text: "server draft" },
  settings: settings(10, 1.25),
});
const local = parseCabinet({
  houses: ["b", "c"],
  supported: ["iss-001"],
  issues: [issue("i1", "local"), issue("i2")],
  meters: [{ id: "m2", kind: "hot", value: 3, date: "2026-11-20" }],
  votes: [{ id: "a:barrier", houseId: "a", choice: "yes", at: "2026-11-01T00:00:00.000Z" }],
  draft: { updatedAt: 9, step: 2, text: "local draft" },
  settings: settings(3, 1.125),
});

const merged = mergeCabinets(server, local);
assert.deepEqual(merged.houses, ["a", "b", "c"], "union without duplicates");
assert.deepEqual(merged.supported, ["iss-001"]);
assert.deepEqual(merged.issues.map((i) => [i.id, i.title]), [["i1", "server"], ["i2", "i2"]], "dedupe by id, server wins ties");
assert.deepEqual(merged.meters.map((m) => m.id), ["m1", "m2"], "lossless");
assert.equal(merged.votes.length, 1);
assert.equal(merged.votes[0].choice, "yes", "newer vote wins");
assert.equal(merged.draft?.text, "local draft", "newest draft");
assert.equal(merged.settings?.fontScale, 1.25, "newest settings");

// lossless: everything from both sides is in the result
for (const side of [server, local])
  for (const key of ["houses", "supported", "subscriptions"] as const) for (const v of side[key]) assert.ok(merged[key].includes(v), `${key} keeps ${v}`);

// idempotent
assert.deepEqual(mergeCabinets(merged, local), merged, "merge(merge(s, l), l) = merge(s, l)");
assert.deepEqual(mergeCabinets(merged, merged), merged, "merge(x, x) = x");
// empty sides
const empty = parseCabinet({});
assert.deepEqual(mergeCabinets(empty, local), mergeCabinets(local, empty));
assert.deepEqual(mergeCabinets(server, empty), server);
// broken input falls back to empty fields instead of throwing
assert.deepEqual(parseCabinet({ houses: "x", draft: 5 }).houses, []);
assert.equal(parseCabinet(null).draft, null);

console.log("cabinet: ok");
