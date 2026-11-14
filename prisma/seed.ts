// Deterministic seed (§3.3): same inputs + same salt → same rows. Run: `npx prisma db seed`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { booleanPointInPolygon, point } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { prisma } from "@/lib/db";
import { DEMO_BILLS, DEMO_BUILDING_ID } from "@/lib/fixtures/bills";
import { DEMO_DOCUMENTS } from "@/lib/fixtures/documents";
import { norm } from "@/lib/utils";
import { WORK_KINDS, type IssueCategory, type IssueStatus, type Severity, type WorkKind } from "@/lib/types";

const SALT = "myVDKmap-seed-v1";
const NOW = Date.parse("2026-11-12T12:00:00Z"); // fixed "today" so createdAt is reproducible
const DAY = 86_400_000;
const BUILDINGS_PER_MICRODISTRICT = 16;
const HOUSES_PER_WORK = 20;

// --- PRNG: mulberry32 seeded with FNV-1a of the salt ---
function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(fnv1a(SALT));
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

// --- inputs ---
const root = join(__dirname, "..");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), "utf8")) as T;

interface SeedJson {
  districts: {
    id: string;
    name: string;
    population: number;
    population_year: number;
    color: string;
    microdistricts: { id: string; name: string; center: [number, number] }[];
  }[];
  residential_complexes: {
    id: string;
    name: string;
    developer?: string | null;
    street?: string | null;
    status: string;
    floors?: string | null;
    note?: string | null;
    microdistrict: string;
  }[];
  authorities: { id: string; name: string; handles: string[] }[];
}
interface OsmBuilding {
  osmId: number;
  street: string | null;
  housenumber: string | null;
  lat: number;
  lng: number;
  floors: number | null;
  yearBuilt: number | null;
  wallMaterial?: string | null;
  apartments: number | null;
}
type AddressPoint = [osmId: number, street: string, number: string, lat: number, lng: number, floors: number | null];

const seed = readJson<SeedJson>("data/vladivostok_seed.json");
const districtShapes = readJson<FeatureCollection<Polygon | MultiPolygon, { id: string }>>("public/geo/districts.geojson").features;
const complexGeo = readJson<Record<string, { lat: number; lng: number; source: string; polygons?: unknown }>>("public/geo/complexes.json");
const complexOsm = readJson<{ complexes: Record<string, OsmBuilding[]> }>("data/osm-complex-buildings.json").complexes;
const osmBuildings = readJson<{ buildings: OsmBuilding[] }>("data/osm-buildings.json").buildings;
const addressPoints = readJson<{ points: AddressPoint[] }>("data/osm-address-points.json").points;

const districtOf = (lat: number, lng: number) =>
  districtShapes.find((f: Feature<Polygon | MultiPolygon, { id: string }>) => booleanPointInPolygon(point([lng, lat]), f))
    ?.properties.id ?? null;

type BuildingRow = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  floors: number | null;
  yearBuilt: number | null;
  wallMaterial: string | null;
  apartments: number | null;
  complexId: string | null;
  microdistrictId: string;
  managementCompanyId: string | null;
};

// --- districts and microdistricts ---
const microdistricts = seed.districts.flatMap((d) =>
  d.microdistricts.flatMap((m) => {
    const districtId = districtOf(m.center[0], m.center[1]);
    return districtId ? [{ id: m.id, name: m.name, districtId, center: m.center }] : [];
  }),
);
const microById = new Map(microdistricts.map((m) => [m.id, m]));
const nearestMicro = (lat: number, lng: number, districtId: string) =>
  microdistricts
    .filter((m) => m.districtId === districtId)
    .sort((a, b) => (a.center[0] - lat) ** 2 + (a.center[1] - lng) ** 2 - ((b.center[0] - lat) ** 2 + (b.center[1] - lng) ** 2))[0];

// --- complexes and their buildings ---
const singleFloors = (f: string | null | undefined) => (f && /^\d+$/.test(f) ? Number(f) : null);
const hasNumber = (street: string | null | undefined) => !!street && /,\s*\d/.test(street);

const complexes: { id: string; name: string; developer: string | null; street: string | null; status: string; floors: string | null; note: string | null; microdistrictId: string; lat: number; lng: number }[] = [];
const buildings: BuildingRow[] = [];
const usedOsm = new Set<number>();

for (const c of seed.residential_complexes) {
  const geo = complexGeo[c.id];
  if (!geo || !microById.has(c.microdistrict)) continue;
  // A complex belongs to the district its point is in; the seed's microdistrict may lie across a real boundary.
  const home = districtOf(geo.lat, geo.lng);
  const microId =
    home && home !== microById.get(c.microdistrict)!.districtId
      ? (nearestMicro(geo.lat, geo.lng, home)?.id ?? c.microdistrict)
      : c.microdistrict;
  const inside = [...(complexOsm[c.id] ?? [])].sort((a, b) => a.osmId - b.osmId);
  const rows: Omit<BuildingRow, "id">[] = [];
  if (geo.polygons && inside.length) {
    for (const b of inside) {
      usedOsm.add(b.osmId);
      rows.push({
        // OSM has no address for some new buildings: name them by complex and the same index as the id.
        address: b.street && b.housenumber ? `${b.street}, ${b.housenumber}` : `ЖК «${c.name}», здание ${rows.length + 1}`,
        lat: b.lat,
        lng: b.lng,
        floors: b.floors ?? singleFloors(c.floors),
        yearBuilt: b.yearBuilt,
        wallMaterial: b.wallMaterial ?? null,
        apartments: b.apartments,
        complexId: c.id,
        microdistrictId: microId,
        managementCompanyId: null,
      });
    }
  } else if (hasNumber(c.street)) {
    const [street, number] = c.street!.split(/,\s*/);
    const p = addressPoints.find((a) => norm(a[1]) === norm(street) && norm(a[2]) === norm(number));
    // No OSM address point → the complex's own geocoded point for that exact address (public/geo/complexes.json).
    rows.push({
      address: `${street}, ${number}`,
      lat: p ? p[3] : geo.lat,
      lng: p ? p[4] : geo.lng,
      floors: p?.[5] ?? singleFloors(c.floors),
      yearBuilt: null,
      wallMaterial: null,
      apartments: null,
      complexId: c.id,
      microdistrictId: microId,
      managementCompanyId: null,
    });
  } else continue;
  complexes.push({
    id: c.id,
    name: c.name,
    developer: c.developer ?? null,
    street: c.street ?? null,
    status: c.status,
    floors: c.floors ?? null,
    note: c.note ?? null,
    microdistrictId: microId,
    lat: geo.lat,
    lng: geo.lng,
  });
  rows.forEach((r, i) => buildings.push({ id: `${c.id}-${i + 1}`, ...r }));
}

// --- ordinary buildings: nearest OSM houses to each microdistrict center, same district ---
const osmDistrict = new Map(osmBuildings.map((b) => [b.osmId, districtOf(b.lat, b.lng)]));
for (const m of microdistricts) {
  const [lat, lng] = m.center;
  const k = Math.cos((lat * Math.PI) / 180);
  const dist = (b: OsmBuilding) => (b.lat - lat) ** 2 + ((b.lng - lng) * k) ** 2;
  const nearest = osmBuildings
    .filter((b) => !usedOsm.has(b.osmId) && osmDistrict.get(b.osmId) === m.districtId && b.street && b.housenumber)
    .sort((a, b) => dist(a) - dist(b) || a.osmId - b.osmId)
    .slice(0, BUILDINGS_PER_MICRODISTRICT);
  for (const b of nearest) {
    usedOsm.add(b.osmId);
    buildings.push({
      id: `osm-${b.osmId}`,
      address: `${b.street}, ${b.housenumber}`,
      lat: b.lat,
      lng: b.lng,
      floors: b.floors,
      yearBuilt: b.yearBuilt,
      wallMaterial: b.wallMaterial ?? null,
      apartments: b.apartments,
      complexId: null,
      microdistrictId: m.id,
      managementCompanyId: null,
    });
  }
}

// --- city works: real houses on the streets named in each work, nearest to the work point ---
const streetOf = (address: string) => norm(address.split(",")[0]);
const wordRe = (w: string) => new RegExp(`(^|[^а-яa-z0-9])${norm(w)}($|[^а-яa-z0-9])`);
const seededIds = new Set(buildings.map((b) => b.id));
const seededAddresses = new Set(buildings.map((b) => norm(b.address)));

const works = DEMO_DOCUMENTS.map((d) => {
  const res = d.match.streets.map(wordRe);
  const inScope = (b: BuildingRow) => !d.match.microdistrictIds || d.match.microdistrictIds.includes(b.microdistrictId);
  const candidates = new Map<string, BuildingRow>();
  for (const b of buildings) if (inScope(b) && res.some((re) => re.test(streetOf(b.address)))) candidates.set(b.id, b);
  for (const re of res) {
    const houses = osmBuildings.filter((b) => b.street && b.housenumber && re.test(norm(b.street)));
    // A street with no OSM building gets its OSM address points instead (fewer facts: floors at most).
    const source: OsmBuilding[] = houses.length
      ? houses
      : addressPoints
          .filter((p) => re.test(norm(p[1])))
          .map(([osmId, street, housenumber, lat, lng, floors]) => ({ osmId, street, housenumber, lat, lng, floors, yearBuilt: null, apartments: null }));
    for (const h of source) {
      const id = `osm-${h.osmId}`;
      const address = `${h.street}, ${h.housenumber}`;
      if (usedOsm.has(h.osmId) || seededIds.has(id) || candidates.has(id) || seededAddresses.has(norm(address))) continue;
      const districtId = districtOf(h.lat, h.lng);
      const m = districtId && nearestMicro(h.lat, h.lng, districtId);
      if (!m) continue;
      const row: BuildingRow = {
        id,
        address,
        lat: h.lat,
        lng: h.lng,
        floors: h.floors,
        yearBuilt: h.yearBuilt,
        wallMaterial: h.wallMaterial ?? null,
        apartments: h.apartments,
        complexId: null,
        microdistrictId: m.id,
        managementCompanyId: null,
      };
      if (inScope(row)) candidates.set(id, row);
    }
  }
  const k = Math.cos((d.lat * Math.PI) / 180);
  const dist = (b: BuildingRow) => (b.lat - d.lat) ** 2 + ((b.lng - d.lng) * k) ** 2;
  const chosen = [...candidates.values()].sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : 1)).slice(0, HOUSES_PER_WORK);
  for (const b of chosen) {
    if (seededIds.has(b.id)) continue;
    seededIds.add(b.id);
    seededAddresses.add(norm(b.address));
    buildings.push(b);
  }
  const ids = new Set([...chosen.map((b) => b.id), ...(d.match.buildingIds ?? []).filter((id) => seededIds.has(id))]);
  const kind = d.summary.kind as WorkKind;
  if (!WORK_KINDS.includes(kind)) throw new Error(`Unknown work kind ${d.summary.kind} in ${d.id}`);
  if (!ids.size) throw new Error(`Work ${d.id} affects no houses`);
  return {
    row: {
      id: d.id,
      title: d.summary.title,
      sourceText: d.sourceText,
      plainSummary: d.summary.plainSummary,
      kind,
      startDate: new Date(`${d.startDate}T12:00:00+10:00`),
      endDate: d.endDate ? new Date(`${d.endDate}T12:00:00+10:00`) : null,
      lat: d.lat,
      lng: d.lng,
    },
    buildingIds: [...ids].sort(),
  };
});

// --- fictional management companies, one per complex, a few per microdistrict otherwise ---
const UK_NAMES = ["Северный квартал", "Берег", "Сопка", "Маяк", "Лазурь", "Перспектива", "Гавань", "Уютный двор"];
const managementCompanies = UK_NAMES.map((n, i) => ({
  id: `uk-demo-${i + 1}`,
  name: `Демо-УК «${n}»`,
  rating: Math.round((2 + rnd() * 3) * 10) / 10,
  avgResponseDays: Math.round((1 + rnd() * 9) * 10) / 10,
  isDemo: true,
}));
const ukByGroup = new Map<string, string>();
for (const b of buildings) {
  const group = b.complexId ?? `${b.microdistrictId}:${int(0, 1)}`;
  if (!ukByGroup.has(group)) ukByGroup.set(group, pick(managementCompanies).id);
  b.managementCompanyId = ukByGroup.get(group)!;
}

// --- microdistrict marker = mean of its seeded buildings ---
const microRows = microdistricts.map((m) => {
  const own = buildings.filter((b) => b.microdistrictId === m.id);
  const mean = (f: (b: BuildingRow) => number) => r6(own.reduce((s, b) => s + f(b), 0) / own.length);
  return {
    id: m.id,
    name: m.name,
    districtId: m.districtId,
    lat: own.length ? mean((b) => b.lat) : m.center[0],
    lng: own.length ? mean((b) => b.lng) : m.center[1],
  };
});

// --- issues ---
type Template = { title: string; description: string; authorityId: string; severity: [Severity, Severity] };
const TEMPLATES: Record<IssueCategory, Template[]> = {
  road: [
    { title: "Яма на дороге у дома", description: "На проезде возле дома глубокая яма, машины объезжают её по тротуару.", authorityId: "city_admin", severity: [2, 3] },
    { title: "Разбит асфальт во дворе", description: "Асфальт на дворовом проезде разрушен, после дождя там лужи и грязь.", authorityId: "city_admin", severity: [1, 2] },
    { title: "Провал асфальта на дороге", description: "На дороге у дома просел асфальт, яма растёт с каждой неделей.", authorityId: "city_admin", severity: [2, 3] },
  ],
  lighting: [
    { title: "Не горят фонари у дома", description: "Уличные фонари вдоль дома не включаются уже несколько вечеров, идти домой темно.", authorityId: "city_admin", severity: [2, 3] },
    { title: "Тёмный участок у остановки", description: "Фонарь у остановки рядом с домом не работает, вечером там ничего не видно.", authorityId: "city_admin", severity: [2, 2] },
    { title: "Не горит свет в подъезде", description: "На лестнице в подъезде перегорели лампы на нескольких этажах.", authorityId: "uk", severity: [1, 2] },
  ],
  entrance: [
    { title: "Грязно в подъезде", description: "В подъезде давно не мыли полы, на лестнице мусор.", authorityId: "uk", severity: [1, 2] },
    { title: "Не закрывается дверь подъезда", description: "Входная дверь подъезда не захлопывается, доводчик сломан.", authorityId: "uk", severity: [1, 2] },
  ],
  flooding: [
    { title: "Двор затапливает после дождя", description: "После каждого сильного дождя во дворе стоит вода по щиколотку, к подъездам не пройти.", authorityId: "city_admin", severity: [2, 3] },
    { title: "Забита ливнёвка", description: "Решётка ливнёвки у дома забита мусором, вода уходит на дорогу и тротуар.", authorityId: "city_admin", severity: [2, 3] },
    { title: "Вода стоит у подъезда", description: "У входа в подъезд после дождя образуется большая лужа, вода заливает ступени.", authorityId: "city_admin", severity: [2, 2] },
  ],
  garbage: [
    { title: "Переполнены мусорные баки", description: "Баки на контейнерной площадке переполнены, мусор лежит рядом на земле.", authorityId: "uk", severity: [2, 2] },
    { title: "Мусор не вывозят несколько дней", description: "Мусор с площадки у дома не вывозят уже несколько дней, появился запах.", authorityId: "uk", severity: [2, 3] },
    { title: "Свалка у контейнерной площадки", description: "Возле площадки сложили старую мебель и строительный мусор, его никто не убирает.", authorityId: "uk", severity: [1, 2] },
  ],
  elevator: [
    { title: "Не работает лифт", description: "Лифт в подъезде стоит уже несколько дней, пожилым соседям трудно подниматься.", authorityId: "uk", severity: [2, 3] },
    { title: "Лифт застревает", description: "Лифт периодически останавливается между этажами.", authorityId: "uk", severity: [2, 3] },
  ],
  roof: [
    { title: "Протекает крыша", description: "Во время дождя на верхнем этаже течёт с потолка.", authorityId: "uk", severity: [2, 3] },
  ],
  yard: [
    { title: "Сломана детская площадка", description: "На детской площадке во дворе сломаны качели, торчат острые края.", authorityId: "uk", severity: [1, 2] },
    { title: "Во дворе не убирают", description: "Двор давно не убирали, вдоль дорожек мусор и листья.", authorityId: "uk", severity: [1, 1] },
  ],
  water: [
    { title: "Ржавая вода из крана", description: "Из крана холодной воды идёт мутная вода с ржавым оттенком.", authorityId: "rpn", severity: [2, 3] },
  ],
  noise: [
    { title: "Шумная стройка по ночам", description: "На соседней стройке работает техника поздно вечером и ночью.", authorityId: "rpn", severity: [1, 2] },
  ],
  other: [
    { title: "Брошенная машина во дворе", description: "Во дворе давно стоит разбитая машина без номеров, занимает место.", authorityId: "pos", severity: [1, 1] },
    { title: "Нужна скамейка у подъезда", description: "У подъезда нет ни одной скамейки, пожилым соседям негде отдохнуть.", authorityId: "pos", severity: [1, 1] },
  ],
};
// Background categories, weighted (hotspot categories are added on top below).
const BACKGROUND: IssueCategory[] = [
  "road", "road", "lighting", "entrance", "entrance", "flooding", "garbage", "garbage", "elevator", "elevator",
  "roof", "yard", "yard", "water", "noise", "other",
];
const HOTSPOTS: { microdistrictId: string; category: IssueCategory; count: number }[] = [
  { microdistrictId: "vtoraya-rechka", category: "flooding", count: 12 },
  { microdistrictId: "neybuta", category: "road", count: 12 },
  { microdistrictId: "churkin", category: "lighting", count: 12 },
  { microdistrictId: "patrokl", category: "garbage", count: 12 },
];
const BACKGROUND_COUNT = 53;
const STATUS_WEIGHTS: IssueStatus[] = ["new", "new", "new", "sent", "sent", "in_progress", "in_progress", "resolved", "resolved", "resolved"];

const authorityName = new Map(seed.authorities.map((a) => [a.id, a.name]));
const appeal = (t: Template, address: string) =>
  `Прошу принять меры по адресу: г. Владивосток, ${address}.\n` +
  `${t.description}\n` +
  `Прошу провести проверку, устранить нарушение и сообщить о принятых мерах и сроках их выполнения.\n` +
  `Обращение направлено в: ${authorityName.get(t.authorityId)}.`;

const byId = new Map(buildings.map((b) => [b.id, b]));
const issueRows: {
  id: string; buildingId: string; lat: number; lng: number; category: IssueCategory; title: string; description: string;
  authorityId: string; appealText: string; status: IssueStatus; severity: Severity; supports: number; createdAt: Date;
}[] = [];
function addIssue(b: BuildingRow, category: IssueCategory, opts: { template?: Template; status?: IssueStatus; daysAgo?: number; hot?: boolean } = {}) {
  const t = opts.template ?? pick(TEMPLATES[category]);
  const status = opts.status ?? pick(STATUS_WEIGHTS);
  const daysAgo = opts.daysAgo ?? rnd() * 120;
  issueRows.push({
    id: `iss-${String(issueRows.length + 1).padStart(3, "0")}`,
    buildingId: b.id,
    lat: r6(b.lat + (rnd() - 0.5) * 0.0003),
    lng: r6(b.lng + (rnd() - 0.5) * 0.0003),
    category,
    title: t.title,
    description: t.description,
    authorityId: t.authorityId,
    appealText: appeal(t, b.address),
    status,
    severity: int(t.severity[0], t.severity[1]) as Severity,
    supports: opts.hot ? int(5, 45) : int(0, 15),
    createdAt: new Date(NOW - Math.round(daysAgo * DAY)),
  });
}

// Demo building: exactly 3 open (one is a road pothole) and 1 resolved.
const demo = byId.get(DEMO_BUILDING_ID);
if (!demo) throw new Error(`Demo building ${DEMO_BUILDING_ID} was not seeded`);
addIssue(demo, "road", { template: TEMPLATES.road[0], status: "in_progress", daysAgo: 9 });
addIssue(demo, "elevator", { template: TEMPLATES.elevator[0], status: "sent", daysAgo: 21 });
addIssue(demo, "garbage", { template: TEMPLATES.garbage[0], status: "new", daysAgo: 3 });
addIssue(demo, "lighting", { template: TEMPLATES.lighting[2], status: "resolved", daysAgo: 64 });

const pool = buildings.filter((b) => b.id !== DEMO_BUILDING_ID);
for (const h of HOTSPOTS) {
  const local = pool.filter((b) => b.microdistrictId === h.microdistrictId);
  if (!local.length) throw new Error(`Hotspot ${h.microdistrictId} has no buildings`);
  // rnd()² skews towards the first few houses, so the hotspot has a visible core.
  for (let i = 0; i < h.count; i++) addIssue(local[Math.floor(rnd() ** 2 * local.length)], h.category, { hot: true });
}
for (let i = 0; i < BACKGROUND_COUNT; i++) addIssue(pick(pool), pick(BACKGROUND));

const workRows = () => [
  prisma.cityWork.createMany({ data: works.map((w) => w.row) }),
  prisma.cityWorkImpact.createMany({ data: works.flatMap((w) => w.buildingIds.map((buildingId) => ({ workId: w.row.id, buildingId }))) }),
];

/** `--works`: replace only city works, adding the houses they need; issues, votes and users stay (safe on a live server). */
async function updateWorks() {
  const needed = new Set(works.flatMap((w) => w.buildingIds));
  const have = new Set((await prisma.building.findMany({ where: { id: { in: [...needed] } }, select: { id: true } })).map((b) => b.id));
  const added = buildings.filter((b) => needed.has(b.id) && !have.has(b.id));
  await prisma.$transaction([
    prisma.building.createMany({ data: added }),
    prisma.cityWorkImpact.deleteMany(),
    prisma.cityWork.deleteMany(),
    ...workRows(),
  ]);
  console.log(`works ${works.length}, new houses ${added.length}`);
}

async function main() {
  await prisma.$transaction([
    prisma.cityWorkImpact.deleteMany(),
    prisma.cityWork.deleteMany(),
    prisma.bill.deleteMany(),
    prisma.issue.deleteMany(),
    prisma.building.deleteMany(),
    prisma.managementCompany.deleteMany(),
    prisma.complex.deleteMany(),
    prisma.microdistrict.deleteMany(),
    prisma.district.deleteMany(),
    prisma.authority.deleteMany(),
  ]);
  await prisma.$transaction([
    prisma.district.createMany({
      data: seed.districts.map((d) => ({ id: d.id, name: d.name, population: d.population, populationYear: d.population_year, color: d.color })),
    }),
    prisma.authority.createMany({
      data: seed.authorities.map((a) => ({ id: a.id, name: a.name, handles: JSON.stringify(a.handles), contact: null })),
    }),
    prisma.microdistrict.createMany({ data: microRows }),
    prisma.complex.createMany({ data: complexes }),
    prisma.managementCompany.createMany({ data: managementCompanies }),
    prisma.building.createMany({ data: buildings }),
    prisma.issue.createMany({ data: issueRows }),
    prisma.bill.createMany({
      data: DEMO_BILLS.map((b) => ({ id: b.id, buildingId: b.buildingId, period: b.period, items: JSON.stringify(b.items), total: b.total })),
    }),
    ...workRows(),
  ]);

  const demoIssues = issueRows.filter((i) => i.buildingId === DEMO_BUILDING_ID);
  console.log(
    [
      `districts ${seed.districts.length}, microdistricts ${microRows.length}, complexes ${complexes.length}`,
      `buildings ${buildings.length}, management companies ${managementCompanies.length}, authorities ${seed.authorities.length}`,
      `issues ${issueRows.length}, bills ${DEMO_BILLS.length}, works ${works.length}`,
      `impacts: ${works.map((w) => `${w.row.id}=${w.buildingIds.length}`).join(", ")}`,
      `${DEMO_BUILDING_ID} (${demo!.address}): ${demoIssues.filter((i) => i.status !== "resolved").length} open, ${demoIssues.filter((i) => i.status === "resolved").length} resolved`,
    ].join("\n"),
  );
}

(process.argv.includes("--works") ? updateWorks() : main())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
