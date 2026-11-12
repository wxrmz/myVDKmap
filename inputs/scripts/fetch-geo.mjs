#!/usr/bin/env node
// Builds public/geo/districts.geojson and public/geo/complexes.json.
// Network sources: 2GIS Catalog API (district boundaries, needs NEXT_PUBLIC_2GIS_KEY in .env), else Overpass;
// Overpass and Nominatim for complexes.
// Any network failure falls back to geometry computed from the seed, so the app works offline.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEO_DIR = path.join(ROOT, "public", "geo");
const DISTRICTS_FILE = path.join(GEO_DIR, "districts.geojson");
const COMPLEXES_FILE = path.join(GEO_DIR, "complexes.json");
const USER_AGENT = "vdk-passport-hackathon/0.1";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const OFFLINE = process.argv.includes("--offline") || process.env.GEO_OFFLINE === "1";

const seed = JSON.parse(await readFile(path.join(ROOT, "data", "vladivostok_seed.json"), "utf8"));
const microById = new Map(seed.districts.flatMap((d) => d.microdistricts.map((m) => [m.id, { ...m, districtId: d.id }])));

// Deterministic [0,1) from a string.
function hash01(s, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------- districts ----------

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* no .env */
}
const DGIS_KEY = process.env.NEXT_PUBLIC_2GIS_KEY;

/** "MULTIPOLYGON(((x y,…),(…)),((…)))" / "POLYGON((x y,…))" → GeoJSON geometry. */
function parseWkt(wkt) {
  const ring = (r) => r.replace(/[()]/g, "").split(",").map((p) => p.trim().split(/\s+/).map(Number));
  const poly = (p) => p.split(/\)\s*,\s*\(/).map(ring);
  const body = wkt.slice(wkt.indexOf("(")).trim().slice(1, -1);
  return wkt.startsWith("MULTIPOLYGON")
    ? { type: "MultiPolygon", coordinates: body.split(/\)\)\s*,\s*\(\(/).map(poly) }
    : { type: "Polygon", coordinates: poly(body) };
}

/**
 * Official city districts as 2GIS draws them. Islands (Русский, Попова, Рейнеке…) are separate settlements
 * there, not part of any district, so they stay uncoloured rather than guessed.
 */
// Drops parts across the Amur Bay (Frunzensky's Peschany peninsula, near Beregovoe): not needed on this map, ever.
const WEST_SHORE_LNG = 131.8;
function mainland(geom) {
  if (geom.type !== "MultiPolygon") return geom;
  const parts = geom.coordinates.filter((p) => Math.max(...p[0].map((c) => c[0])) > WEST_SHORE_LNG);
  return parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { ...geom, coordinates: parts };
}

async function districtsFrom2gis() {
  const features = [];
  for (const d of seed.districts) {
    const name = d.osm_name.replace(/\s*район$/, "");
    const url =
      `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(`${name} район Владивосток`)}` +
      `&location=131.93,43.12&type=adm_div.district&fields=items.geometry.selection&key=${DGIS_KEY}`;
    const j = await fetchJson(url, { headers: { "User-Agent": USER_AGENT } }, 30000);
    const item = j.result?.items?.find((i) => i.full_name === `Владивосток, ${name}`);
    if (!item?.geometry?.selection) throw new Error(`2GIS has no boundary for ${d.osm_name}`);
    features.push({ type: "Feature", properties: { id: d.id, name: d.name, color: d.color }, geometry: parseWkt(item.geometry.selection) });
  }
  return features;
}

const samePt = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Joins way segments into closed rings by matching endpoints. */
function assembleRings(segments) {
  const rest = segments.filter((s) => s.length >= 2).map((s) => [...s]);
  const rings = [];
  while (rest.length) {
    const ring = rest.shift();
    let extended = true;
    while (!samePt(ring[0], ring[ring.length - 1]) && extended) {
      extended = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < rest.length; i++) {
        const s = rest[i];
        if (samePt(s[0], end)) ring.push(...s.slice(1));
        else if (samePt(s[s.length - 1], end)) ring.push(...s.slice(0, -1).reverse());
        else continue;
        rest.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (!samePt(ring[0], ring[ring.length - 1])) ring.push(ring[0]);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

async function districtsFromOsm() {
  const names = seed.districts.map((d) => d.osm_name).join("|");
  const query = `[out:json][timeout:60];
area["name"="Владивосток"]->.city;
rel(area.city)["boundary"="administrative"]["name"~"^(${names})$"];
out geom;`;
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const data = await fetchJson(
        url,
        { method: "POST", headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(query) },
        40000,
      );
      const features = [];
      for (const d of seed.districts) {
        const rel = data.elements.find((e) => e.type === "relation" && e.tags?.name === d.osm_name);
        if (!rel) throw new Error(`relation not found: ${d.osm_name}`);
        const outers = rel.members.filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && m.geometry);
        const rings = assembleRings(outers.map((m) => m.geometry.map((p) => [p.lon, p.lat])));
        if (!rings.length) throw new Error(`no rings: ${d.osm_name}`);
        const geometry = rings.length === 1 ? { type: "Polygon", coordinates: [rings[0]] } : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
        const simplified = turf.simplify(turf.feature(geometry), { tolerance: 0.0005, highQuality: false });
        features.push(turf.feature(simplified.geometry, { id: d.id, name: d.name, color: d.color }));
      }
      return features;
    } catch (e) {
      lastErr = e;
      console.warn(`  overpass ${url} failed: ${e.message}`);
    }
  }
  throw lastErr;
}

function districtsFallback() {
  return seed.districts.map((d) => {
    const pts = turf.featureCollection(d.microdistricts.map((m) => turf.point([m.center[1], m.center[0]])));
    let poly;
    if (pts.features.length >= 3) {
      poly = turf.buffer(turf.convex(pts), 0.6, { units: "kilometers" });
    } else {
      // Too few points for a hull: hull of buffered points.
      const buffered = turf.buffer(pts, 1.2, { units: "kilometers" });
      poly = turf.convex(turf.explode(buffered));
    }
    return turf.feature(poly.geometry, { id: d.id, name: d.name, color: d.color });
  });
}

// ---------- complexes ----------

let networkOk = !OFFLINE;

function fallbackPoint(c) {
  const m = microById.get(c.microdistrict) ?? { center: [43.12, 131.93] };
  const angle = hash01(c.id, 1) * 2 * Math.PI;
  const r = 0.0015 + hash01(c.id, 2) * 0.002;
  return { lat: +(m.center[0] + Math.sin(angle) * r).toFixed(6), lng: +(m.center[1] + Math.cos(angle) * r * 1.35).toFixed(6) };
}

async function geocode(street) {
  const q = `Владивосток, ${street}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&accept-language=ru&q=${encodeURIComponent(q)}`;
  const data = await fetchJson(url, { headers: { "User-Agent": USER_AGENT } }, 10000);
  return data[0] ? { lat: +(+data[0].lat).toFixed(6), lng: +(+data[0].lon).toFixed(6) } : null;
}

const normName = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/жилой комплекс|жк|[«»"'“”]/g, " ").replace(/\s+/g, " ").trim();

/** Complex outlines from OSM by exact name: residential/construction areas or the complex's own buildings. */
async function complexOutlinesFromOsm() {
  const names = seed.residential_complexes.map((c) => c.name).join("|");
  const query = `[out:json][timeout:90][bbox:42.95,131.80,43.30,132.20];
(way["name"~"${names}",i]["highway"!~"."]["amenity"!~"."]["shop"!~"."];relation["name"~"${names}",i]["highway"!~"."];);
out geom;`;
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const data = await fetchJson(
        url,
        { method: "POST", headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(query) },
        100000,
      );
      const out = {};
      for (const e of data.elements) {
        const t = e.tags ?? {};
        const isArea = ["residential", "construction"].includes(t.landuse) || t.place === "neighbourhood" || (t.building && !["commercial", "retail", "parking", "garages"].includes(t.building));
        const c = seed.residential_complexes.find((x) => normName(x.name) === normName(t.name ?? ""));
        if (!c || !isArea) continue;
        const segments = e.type === "way" ? [e.geometry] : e.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry);
        const rings = assembleRings(segments.map((g) => g.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)])));
        (out[c.id] ??= []).push(...rings);
      }
      return out;
    } catch (e) {
      lastErr = e;
      console.warn(`  overpass ${url} failed: ${e.message}`);
    }
  }
  throw lastErr;
}

async function buildComplexes() {
  let cache = {};
  try {
    cache = JSON.parse(await readFile(COMPLEXES_FILE, "utf8"));
  } catch {
    /* no cache yet */
  }
  let outlines = null;
  if (networkOk) {
    try {
      outlines = await complexOutlinesFromOsm();
    } catch (e) {
      console.warn(`  complex outlines unavailable (${e.message}), using cached ones`);
    }
  }
  const out = {};
  for (const c of seed.residential_complexes) {
    const m = microById.get(c.microdistrict) ?? { center: [43.12, 131.93] };
    const cached = cache[c.id];
    const rings = outlines ? outlines[c.id] : cached?.source === "osm" ? cached.polygons : null;
    if (rings?.length) {
      const [lng, lat] = turf.centroid(turf.multiPolygon(rings.map((r) => [r]))).geometry.coordinates;
      out[c.id] = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), source: "osm", query: c.name, polygons: rings };
      continue;
    }
    // Without an OSM outline only an exact address ("ул. Русская, 73б") is precise enough; a bare street is not.
    if (!c.street || !/,\s*\d/.test(c.street)) {
      out[c.id] = { ...fallbackPoint(c), source: "unknown", query: c.street ?? null };
      continue;
    }
    if (cached?.source === "nominatim" && cached.query === c.street) {
      out[c.id] = cached;
      continue;
    }
    let pt = null;
    if (c.street && networkOk) {
      try {
        await new Promise((r) => setTimeout(r, 1100)); // Nominatim policy: max 1 req/s
        pt = await geocode(c.street);
        // Reject hits far away from the microdistrict (wrong street with the same name, etc.).
        if (pt && turf.distance([pt.lng, pt.lat], [m.center[1], m.center[0]]) > 4) pt = null;
      } catch (e) {
        console.warn(`  nominatim failed (${e.message}), switching to offline fallback`);
        networkOk = false;
        pt = null;
      }
    }
    out[c.id] = pt ? { ...pt, source: "nominatim", query: c.street } : { ...fallbackPoint(c), source: "fallback", query: c.street ?? null };
  }
  // Complexes on the same street get the same geocode: spread them apart.
  const seen = new Map();
  for (const [id, p] of Object.entries(out)) {
    if (p.source === "osm") continue;
    const key = `${p.lat},${p.lng}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n > 0) {
      const angle = hash01(id, 3) * 2 * Math.PI;
      p.lat = +(p.lat + Math.sin(angle) * 0.0025 * n).toFixed(6);
      p.lng = +(p.lng + Math.cos(angle) * 0.0035 * n).toFixed(6);
    }
  }
  return out;
}

// ---------- main ----------

await mkdir(GEO_DIR, { recursive: true });

let features;
let source = "osm";
// Committed boundaries are reused (offline-safe); pass --refresh to download them again.
let cachedOsm = null;
let cachedSource = "osm";
try {
  const fc = JSON.parse(await readFile(DISTRICTS_FILE, "utf8"));
  if (["2gis", "osm"].includes(fc.source) && fc.features?.length === seed.districts.length) {
    cachedOsm = fc.features;
    cachedSource = fc.source;
  }
} catch {
  /* no file yet */
}
if (cachedOsm && !process.argv.includes("--refresh")) {
  features = cachedOsm;
  source = cachedSource;
  console.log(`Using cached ${cachedSource} boundaries (run with --refresh to re-download).`);
} else if (OFFLINE) {
  features = cachedOsm ?? districtsFallback();
  source = cachedOsm ? cachedSource : "fallback";
} else if (DGIS_KEY) {
  console.log("Fetching district boundaries from 2GIS…");
  features = await districtsFrom2gis();
  source = "2gis";
} else {
  try {
    console.log("Fetching district boundaries from Overpass…");
    features = await districtsFromOsm();
  } catch (e) {
    console.warn(`Overpass unavailable (${e.message}); using ${cachedOsm ? "cached OSM boundaries" : "convex-hull fallback"}.`);
    features = cachedOsm ?? districtsFallback();
    source = cachedOsm ? "osm" : "fallback";
  }
}
// Whatever the source (2GIS, OSM, cache, fallback), the city map never shows parts across the Amur Bay.
features = features.map((f) => ({ ...f, geometry: mainland(f.geometry) }));
await writeFile(DISTRICTS_FILE, JSON.stringify({ type: "FeatureCollection", source, features }));
console.log(`districts.geojson: ${features.length} features (${source})`);

for (const f of features) {
  const d = seed.districts.find((x) => x.id === f.properties.id);
  const inside = d.microdistricts.filter((m) => turf.booleanPointInPolygon([m.center[1], m.center[0]], f)).length;
  console.log(`  ${f.properties.id}: ${inside}/${d.microdistricts.length} microdistrict centers inside`);
}

console.log("Geocoding complexes…");
const complexes = await buildComplexes();
await writeFile(COMPLEXES_FILE, JSON.stringify(complexes, null, 2) + "\n");
const stats = Object.values(complexes).reduce((a, p) => ((a[p.source] = (a[p.source] ?? 0) + 1), a), {});
console.log(`complexes.json: ${JSON.stringify(stats)}`);
