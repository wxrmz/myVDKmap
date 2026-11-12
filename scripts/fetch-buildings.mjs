#!/usr/bin/env node
// Downloads real buildings of Vladivostok from OpenStreetMap (Overpass):
// - data/osm-buildings.json: residential buildings with floors, for the houses on the map (`npm run seed`);
// - data/osm-addresses.json: every building address by street, for finding the houses a city document is about;
// - data/osm-address-points.json: the same addresses with coordinates, for search and passports made on first visit.
// `--addresses` refreshes only the last two.
// The files are committed, so everything works offline; rerun this script to refresh them.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "osm-buildings.json");
const OUT_ADDR = path.join(ROOT, "data", "osm-addresses.json");
const OUT_POINTS = path.join(ROOT, "data", "osm-address-points.json");
const URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const QUERY = `[out:json][timeout:160][bbox:42.95,131.80,43.30,132.20];
way["building"~"^(apartments|residential|dormitory)$"]["addr:street"]["addr:housenumber"]["building:levels"];
out center tags;`;
const QUERY_ADDR = `[out:json][timeout:160][bbox:42.95,131.80,43.30,132.20];
way["building"]["addr:street"]["addr:housenumber"];
out center tags;`;
// Not homes or workplaces anyone is told about in a notice.
const SKIP = new Set([
  "garage",
  "garages",
  "shed",
  "ruins",
  "construction",
  "roof",
  "hut",
  "kiosk",
  "service",
  "carport",
]);

const MATERIAL = {
  brick: "кирпич",
  concrete: "бетон",
  reinforced_concrete: "железобетон",
  panels: "панель",
  panel: "панель",
  block: "блоки",
  wood: "дерево",
  stone: "камень",
};
const int = (v) => (v && /^\d+/.test(v) ? parseInt(v, 10) : null);

/** "Алеутская улица" / "улица Нейбута" → "ул. Алеутская" / "ул. Нейбута". */
export function shortStreet(s) {
  const kinds = [
    ["улица", "ул."],
    ["проспект", "пр."],
    ["переулок", "пер."],
    ["бульвар", "б-р"],
    ["проезд", "пр-д"],
    ["шоссе", "ш."],
    ["набережная", "наб."],
  ];
  for (const [full, short] of kinds) {
    const re = new RegExp(`(^|\\s)${full}(\\s|$)`, "i");
    if (re.test(s)) return `${short} ${s.replace(re, " ").trim()}`;
  }
  return s;
}

async function overpass(query) {
  let lastErr;
  // Public Overpass servers are often busy: three rounds over all mirrors, 20 s apart.
  for (let round = 0; round < 3; round++) {
    if (round) await new Promise((r) => setTimeout(r, 20000));
    for (const url of URLS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "User-Agent": "vdk-passport-hackathon/0.1",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn(`${url}: ${e.message}`);
      }
    }
  }
  throw lastErr;
}

if (!process.argv.includes("--addresses")) {
  const data = await overpass(QUERY);
  const rows = data.elements
    .filter((e) => e.center && int(e.tags["building:levels"]))
    .map((e) => {
      const t = e.tags;
      const year = int(
        (t["start_date"] ?? t["building:year"] ?? "").match(/\d{4}/)?.[0],
      );
      return {
        osmId: e.id,
        street: shortStreet(t["addr:street"]),
        housenumber: t["addr:housenumber"],
        lat: Math.round(e.center.lat * 1e6) / 1e6,
        lng: Math.round(e.center.lon * 1e6) / 1e6,
        floors: int(t["building:levels"]),
        yearBuilt: year && year > 1850 && year <= 2030 ? year : null,
        wallMaterial: MATERIAL[t["building:material"]] ?? null,
        apartments: int(t["building:flats"]),
      };
    })
    .sort((a, b) => a.osmId - b.osmId);

  await writeFile(
    OUT,
    JSON.stringify({
      source: "© OpenStreetMap contributors, ODbL",
      fetchedAt: new Date().toISOString().slice(0, 10),
      buildings: rows,
    }) + "\n",
  );
  console.log(`Saved ${rows.length} buildings to ${path.relative(ROOT, OUT)}`);
}

const addr = await overpass(QUERY_ADDR);
const streets = {};
const points = [];
for (const e of addr.elements) {
  if (SKIP.has(e.tags.building)) continue;
  const street = shortStreet(e.tags["addr:street"]);
  const number = e.tags["addr:housenumber"].trim();
  (streets[street] ??= new Set()).add(number);
  if (e.center)
    points.push([
      e.id,
      street,
      number,
      Math.round(e.center.lat * 1e6) / 1e6,
      Math.round(e.center.lon * 1e6) / 1e6,
      int(e.tags["building:levels"]),
    ]);
}
points.sort((a, b) => a[0] - b[0]);
await writeFile(
  OUT_POINTS,
  JSON.stringify({
    source: "© OpenStreetMap contributors, ODbL",
    fetchedAt: new Date().toISOString().slice(0, 10),
    columns: ["osmId", "street", "number", "lat", "lng", "floors"],
    points,
  }) + "\n",
);
console.log(
  `Saved ${points.length} address points to ${path.relative(ROOT, OUT_POINTS)}`,
);
const byStreet = Object.fromEntries(
  Object.keys(streets)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((st) => [
      st,
      [...streets[st]].sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b, "ru"),
      ),
    ]),
);
await writeFile(
  OUT_ADDR,
  JSON.stringify({
    source: "© OpenStreetMap contributors, ODbL",
    fetchedAt: new Date().toISOString().slice(0, 10),
    streets: byStreet,
  }) + "\n",
);
console.log(
  `Saved ${Object.values(byStreet).flat().length} addresses on ${Object.keys(byStreet).length} streets to ${path.relative(ROOT, OUT_ADDR)}`,
);
