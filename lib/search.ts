// Everything about addresses (§4, §6.2–6.4). Server only: reads prepared files from disk.
// queries.ts imports from here, never the reverse.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bbox, booleanPointInPolygon, point } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { prisma } from "@/lib/db";
import { complexHref, complexLabel, districtHref, houseHref } from "@/lib/nav";
import type { SearchResult } from "@/lib/types";
import { norm } from "@/lib/utils";

type AddressPoint = [osmId: number, street: string, number: string, lat: number, lng: number, floors: number | null];
type DistrictFeature = Feature<Polygon | MultiPolygon, { id: string; name: string }>;

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const ruCollator = new Intl.Collator("ru");
const numCollator = new Intl.Collator("ru", { numeric: true });
const splitAddress = (address: string) => {
  const i = address.indexOf(",");
  return i < 0 ? [address, ""] : [address.slice(0, i), address.slice(i + 1).trim()];
};
const byAddress = (a: string, b: string) => {
  const [sa, na] = splitAddress(a);
  const [sb, nb] = splitAddress(b);
  return ruCollator.compare(sa, sb) || numCollator.compare(na, nb);
};

// --- address points: loaded once, sorted and deduplicated by normalised address ---
interface IndexedPoint {
  point: AddressPoint;
  address: string;
  key: string;
}
let pointIndex: { byId: Map<number, AddressPoint>; sorted: IndexedPoint[] } | null = null;
function addressPoints() {
  if (pointIndex) return pointIndex;
  const { points } = readJson<{ points: AddressPoint[] }>("data/osm-address-points.json");
  const seen = new Set<string>();
  const sorted: IndexedPoint[] = [];
  for (const p of points) {
    const address = `${p[1]}, ${p[2]}`;
    const key = norm(address);
    if (seen.has(key)) continue;
    seen.add(key);
    sorted.push({ point: p, address, key });
  }
  sorted.sort((a, b) => byAddress(a.address, b.address));
  pointIndex = { byId: new Map(points.map((p) => [p[0], p])), sorted };
  return pointIndex;
}

// --- districts: point in polygon with a per-point cache ---
let districtFeatures: DistrictFeature[] | null = null;
const districtCache = new Map<string, string | null>();
function districts() {
  districtFeatures ??= readJson<FeatureCollection<Polygon | MultiPolygon, { id: string; name: string }>>(
    "public/geo/districts.geojson",
  ).features.map((f) => ({ ...f, bbox: bbox(f) })); // booleanPointInPolygon skips the polygon walk when bbox misses
  return districtFeatures;
}

export function districtAt(lat: number, lng: number): string | null {
  const key = `${lat},${lng}`;
  let id = districtCache.get(key);
  if (id === undefined) {
    const p = point([lng, lat]);
    id = districts().find((f) => booleanPointInPolygon(p, f))?.properties.id ?? null;
    districtCache.set(key, id);
  }
  return id;
}

// --- search (§6.2) ---
export async function searchAll(q: string, limit = 400): Promise<SearchResult[]> {
  const terms = words(q);
  if (!terms.length) return [];
  const matches = (haystack: string) => terms.every((t) => haystack.includes(t));

  const [districtRows, complexes, buildings] = await Promise.all([
    prisma.district.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.complex.findMany({
      select: { id: true, name: true, street: true, microdistrict: { select: { districtId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.building.findMany({
      select: { id: true, address: true, complex: { select: { name: true } }, microdistrict: { select: { districtId: true } } },
    }),
  ]);
  const districtName = new Map(districtRows.map((d) => [d.id, `${d.name} район`]));
  const out: SearchResult[] = [];

  for (const d of districtRows) {
    const title = districtName.get(d.id)!;
    if (matches(norm(title))) out.push({ type: "district", id: d.id, title, subtitle: "Владивосток", href: districtHref(d.id), districtId: d.id });
  }
  for (const c of complexes) {
    const title = complexLabel(c.name);
    const districtId = c.microdistrict.districtId;
    if (!matches(norm(`${title} ${c.street ?? ""}`))) continue;
    out.push({
      type: "complex",
      id: c.id,
      title,
      subtitle: [c.street, districtName.get(districtId)].filter(Boolean).join(" · "),
      href: complexHref(districtId, c.id),
      districtId,
    });
  }
  const found = buildings
    .filter((b) => matches(norm(`${b.address} ${b.complex ? complexLabel(b.complex.name) : ""}`)))
    .sort((a, b) => byAddress(a.address, b.address));
  for (const b of found) {
    const districtId = b.microdistrict.districtId;
    out.push({
      type: "building",
      id: b.id,
      title: b.address,
      subtitle: [b.complex && complexLabel(b.complex.name), districtName.get(districtId)].filter(Boolean).join(" · "),
      href: houseHref(b.id),
      districtId,
    });
  }

  // shortcut: capped at 400 so a one-letter query does not ship the whole city; one street is far below it. Raise or paginate if the UI ever lists more.
  if (out.length >= limit) return out.slice(0, limit);
  const dbIds = new Set(buildings.map((b) => b.id));
  const dbAddresses = new Set(buildings.map((b) => norm(b.address)));
  for (const { point: p, address, key } of addressPoints().sorted) {
    if (!matches(key)) continue;
    const id = `osm-${p[0]}`;
    if (dbIds.has(id) || dbAddresses.has(key)) continue;
    const districtId = districtAt(p[3], p[4]);
    out.push({
      type: "building",
      id,
      title: address,
      subtitle: (districtId && districtName.get(districtId)) || "Владивосток",
      href: houseHref(id),
      ...(districtId && { districtId }),
    });
    if (out.length >= limit) break;
  }
  return out;
}

// --- lazy passport for an OSM address point (§6.3) ---
export async function ensureOsmBuilding(osmId: number): Promise<string | null> {
  const id = `osm-${osmId}`;
  if (await prisma.building.findUnique({ where: { id }, select: { id: true } })) return id;
  const p = addressPoints().byId.get(osmId);
  if (!p) return null;
  const [, street, number, lat, lng, floors] = p;
  const address = `${street}, ${number}`;
  const key = norm(address);
  const existing = (await prisma.building.findMany({ select: { id: true, address: true } })).find((b) => norm(b.address) === key);
  if (existing) return existing.id;

  const districtId = districtAt(lat, lng);
  if (!districtId) return null;
  const k = Math.cos((lat * Math.PI) / 180);
  const micro = (await prisma.microdistrict.findMany({ where: { districtId } })).sort(
    (a, b) => (a.lat - lat) ** 2 + ((a.lng - lng) * k) ** 2 - ((b.lat - lat) ** 2 + ((b.lng - lng) * k) ** 2),
  )[0];
  if (!micro) return null;
  await prisma.building.upsert({
    where: { id },
    create: { id, address, lat, lng, floors, microdistrictId: micro.id, isDemo: false },
    update: {},
  });
  return id;
}

// --- streets of city works (§6.4) ---
const STOP_WORDS = new Set([
  "адмирала", "генерала", "маршала", "капитана", "академика", "лейтенанта", "героя",
  "владивостока", "летия", "первая", "вторая", "третья", "новая", "старая",
]);

/** Regex for a street's main word with Russian case endings; null when the main word is shorter than 4 letters. */
export function streetPattern(street: string): RegExp | null {
  const main = words(street.replace(/\([^)]*\)/g, " "))
    .filter((w) => !STOP_WORDS.has(w))
    .reduce((best, w) => (w.length > best.length ? w : best), "");
  if (main.length < 4) return null;
  const body = main.endsWith("ая")
    ? `${main.slice(0, -2)}(?:ая|ой|ую)`
    : /(?:ий|ый|ой)$/.test(main)
      ? `${main.slice(0, -2)}(?:ий|ый|ой|ого|ому|ом)`
      : main;
  // \b is ASCII-only, so word edges are spelled out for Cyrillic.
  return new RegExp(`(?<![\\p{L}\\d])${body}(?![\\p{L}\\d])`, "u");
}

let streetPatterns: { street: string; re: RegExp }[] | null = null;

/** For each work id: the city streets (from osm-addresses) named in its title, summary, source text or affected addresses. */
export function getWorkStreets(
  works: { id: string; title: string; plainSummary: string; sourceText: string; buildings: { address: string }[] }[],
): Record<string, string[]> {
  streetPatterns ??= Object.keys(readJson<{ streets: Record<string, string[]> }>("data/osm-addresses.json").streets).flatMap((street) => {
    const re = streetPattern(street);
    return re ? [{ street, re }] : [];
  });
  return Object.fromEntries(
    works.map((w) => {
      const text = norm([w.title, w.plainSummary, w.sourceText, ...w.buildings.map((b) => b.address)].join("\n"));
      return [w.id, streetPatterns!.filter(({ re }) => re.test(text)).map(({ street }) => street)];
    }),
  );
}
