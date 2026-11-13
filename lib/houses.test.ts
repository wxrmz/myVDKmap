// Self-check for the house under a map click (§5.4): npx tsx lib/houses.test.ts (needs the seeded DB).
import assert from "node:assert/strict";
import { houseAt, houseNumberKey, streetKey } from "@/lib/search";

async function main() {
  assert.equal(houseNumberKey("2А корп. 3"), houseNumberKey("2а к3"));
  assert.equal(houseNumberKey("19 стр1"), houseNumberKey("19 с1"));
  assert.notEqual(houseNumberKey("19"), houseNumberKey("19А"));
  assert.equal(streetKey("Алеутская улица"), streetKey("ул. Алеутская"));
  assert.equal(streetKey("Краснознамённый переулок"), streetKey("пер. Краснознаменный"));
  assert.equal(streetKey("проспект 100-летия Владивостока"), streetKey("пр-т 100-летия Владивостока"));

  // 2GIS «Алеутская улица, 19» at its own point → that house; a wrong number, a far point or another street → nothing.
  const id = await houseAt(43.115469, 131.881576, "Алеутская улица", "19");
  assert.ok(id, "Алеутская, 19 found");
  assert.equal(await houseAt(43.115469, 131.881576, "Алеутская улица", "99"), null);
  assert.equal(await houseAt(43.125469, 131.881576, "Алеутская улица", "19"), null);
  assert.equal(await houseAt(43.115469, 131.881576, "Светланская улица", "19"), null);
  console.log("houses: ok");
}

main();
