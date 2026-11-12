#!/usr/bin/env node
// Downloads every OSM building inside the residential complex outlines (public/geo/complexes.json) into
// data/osm-complex-buildings.json. New-build houses in OSM often lack an address or a floor count, so they are
// missing from data/osm-buildings.json; the seed uses these for complexes that would otherwise have no houses.
// The file is committed; rerun this script to refresh it.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "osm-complex-buildings.json");
const URLS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
// Not a home: sheds, garages, kiosks and the like.
const SKIP = new Set(["garage", "garages", "shed", "ruins", "roof", "hut", "kiosk", "service", "carport", "parking", "transformer_tower", "toilets"]);
const MIN_AREA_M2 = 300; // smaller footprints are sales offices, substations, site cabins
/** "Алеутская улица" / "улица Нейбута" → "ул. Алеутская" / "ул. Нейбута" (same as fetch-buildings.mjs). */
function shortStreet(s) {
  const kinds = [["улица", "ул."], ["проспект", "пр."], ["переулок", "пер."], ["бульвар", "б-р"], ["проезд", "пр-д"], ["шоссе", "ш."], ["набережная", "наб."]];
  for (const [full, short] of kinds) {
    const re = new RegExp(`(^|\\s)${full}(\\s|$)`, "i");
    if (re.test(s)) return `${short} ${s.replace(re, " ").trim()}`;
  }
  return s;
}
const int = (v) => (v && /^\d+/.test(v) ? parseInt(v, 10) : null);

async function overpass(query) {
  let lastErr;
  for (const url of URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": "vdk-passport-hackathon/0.1", "Content-Type": "application/x-www-form-urlencoded" },
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
  throw lastErr;
}

const geo = JSON.parse(await readFile(path.join(ROOT, "public/geo/complexes.json"), "utf8"));
const outlines = Object.entries(geo)
  .filter(([, g]) => g.polygons?.length)
  .map(([id, g]) => ({ id, shape: turf.multiPolygon(g.polygons.map((r) => [r])), rings: g.polygons }));

// Bounding boxes are much cheaper for Overpass than polygon filters; the outlines are checked below.
const boxes = outlines.map((o) => {
  const [w, so, e, n] = turf.bbox(o.shape);
  return `way["building"](${so},${w},${n},${e});`;
});
const data = await overpass(`[out:json][timeout:120];(${boxes.join("")});out tags geom;`);

const complexes = {};
for (const e of data.elements) {
  const t = e.tags ?? {};
  if (SKIP.has(t.building) || !e.geometry || e.geometry.length < 4) continue;
  const ring = e.geometry.map((p) => [p.lon, p.lat]);
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push(ring[0]);
  const footprint = turf.polygon([ring]);
  const area = Math.round(turf.area(footprint));
  if (area < MIN_AREA_M2) continue;
  const [lng, lat] = turf.centroid(footprint).geometry.coordinates;
  const owner = outlines.find((o) => turf.booleanPointInPolygon([lng, lat], o.shape));
  if (!owner) continue;
  const year = int((t["start_date"] ?? "").match(/\d{4}/)?.[0]);
  (complexes[owner.id] ??= []).push({
    osmId: e.id,
    street: t["addr:street"] ? shortStreet(t["addr:street"]) : null,
    housenumber: t["addr:housenumber"] ?? null,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    floors: int(t["building:levels"]),
    yearBuilt: year && year > 1850 && year <= 2035 ? year : null,
    apartments: int(t["building:flats"]),
    building: t.building,
    area,
  });
}
for (const list of Object.values(complexes)) list.sort((a, b) => b.area - a.area || a.osmId - b.osmId);

await writeFile(OUT, JSON.stringify({ source: "© OpenStreetMap contributors, ODbL", fetchedAt: new Date().toISOString().slice(0, 10), complexes }, null, 1) + "\n");
for (const o of outlines) console.log(`${o.id}: ${complexes[o.id]?.length ?? 0} buildings`);
