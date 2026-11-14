// Server-side DB queries (§4). Return DTOs from lib/types.ts: JSON parsed, dates as ISO strings.
import type { Bill, CityWork, Issue, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeHealth } from "@/lib/health";
import { districtAt, ensureOsmBuilding } from "@/lib/search";
import type {
  AuthorityDTO,
  BillDTO,
  BillItem,
  BuildingPassportDTO,
  CityWorkDTO,
  ComplexDetailDTO,
  DistrictDetailDTO,
  DistrictStatsDTO,
  DistrictWithCountsDTO,
  IssueCategory,
  IssueKind,
  IssueDTO,
  IssueStatus,
  MapComplexDTO,
  Severity,
  WorkKind,
} from "@/lib/types";

const NEAR_METERS = 600;
const OPEN: Prisma.IssueWhereInput = { status: { not: "resolved" } };

export const toIssueDTO = (i: Issue, address?: string): IssueDTO => ({
  id: i.id,
  buildingId: i.buildingId,
  lat: i.lat,
  lng: i.lng,
  kind: i.kind as IssueKind,
  category: i.category as IssueCategory,
  title: i.title,
  description: i.description,
  photoUrl: i.photoUrl?.startsWith("data:") ? `/api/issues/${i.id}/photo` : i.photoUrl,
  authorityId: i.authorityId,
  appealText: i.appealText,
  status: i.status as IssueStatus,
  severity: i.severity as Severity,
  supports: i.supports,
  closedByResidents: i.statusBeforeVotes !== null,
  createdAt: i.createdAt.toISOString(),
  ...(address !== undefined && { address }),
});

const toBillDTO = (b: Bill): BillDTO => ({ ...b, items: JSON.parse(b.items) as BillItem[] });

const toWorkDTO = (w: CityWork & { impacts: { building: { id: string; address: string } }[] }): CityWorkDTO => ({
  id: w.id,
  title: w.title,
  sourceText: w.sourceText,
  plainSummary: w.plainSummary,
  kind: w.kind as WorkKind,
  startDate: w.startDate.toISOString(),
  endDate: w.endDate?.toISOString() ?? null,
  lat: w.lat,
  lng: w.lng,
  sourceUrl: w.sourceUrl,
  buildings: w.impacts.map((i) => i.building),
});

const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  111_320 * Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));

/** Issues with their district: the building's, or the point's for issues without a building. */
async function issuesByDistrict(where: Prisma.IssueWhereInput = {}) {
  const rows = await prisma.issue.findMany({
    where,
    select: { status: true, category: true, lat: true, lng: true, building: { select: { microdistrict: { select: { districtId: true } } } } },
  });
  return rows.map((i) => ({ ...i, districtId: i.building?.microdistrict.districtId ?? districtAt(i.lat, i.lng) }));
}

export async function getDistricts(): Promise<DistrictWithCountsDTO[]> {
  const [districts, open] = await Promise.all([prisma.district.findMany({ orderBy: { name: "asc" } }), issuesByDistrict(OPEN)]);
  return districts.map((d) => ({ ...d, openIssues: open.filter((i) => i.districtId === d.id).length }));
}

export async function getDistrict(id: string): Promise<DistrictDetailDTO | null> {
  const [d, open] = await Promise.all([
    prisma.district.findUnique({
      where: { id },
      include: {
        microdistricts: {
          orderBy: { name: "asc" },
          include: { complexes: { orderBy: { name: "asc" } }, _count: { select: { buildings: true } } },
        },
      },
    }),
    issuesByDistrict(OPEN),
  ]);
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    population: d.population,
    populationYear: d.populationYear,
    color: d.color,
    openIssues: open.filter((i) => i.districtId === id).length,
    microdistricts: d.microdistricts.map((m) => ({ id: m.id, name: m.name, districtId: m.districtId, lat: m.lat, lng: m.lng, complexes: m.complexes })),
    complexCount: d.microdistricts.reduce((n, m) => n + m.complexes.length, 0),
    buildingCount: d.microdistricts.reduce((n, m) => n + m._count.buildings, 0),
  };
}

export async function getComplex(id: string): Promise<ComplexDetailDTO | null> {
  const c = await prisma.complex.findUnique({
    where: { id },
    include: {
      microdistrict: { select: { id: true, name: true, district: { select: { id: true, name: true, color: true } } } },
      buildings: { orderBy: { id: "asc" }, include: { _count: { select: { issues: { where: OPEN } } } } },
    },
  });
  if (!c) return null;
  const { microdistrict, buildings, ...complex } = c;
  const withCounts = buildings.map(({ _count, ...b }) => ({ ...b, openIssues: _count.issues }));
  return {
    ...complex,
    district: microdistrict.district,
    microdistrict: { id: microdistrict.id, name: microdistrict.name },
    buildings: withCounts,
    openIssues: withCounts.reduce((n, b) => n + b.openIssues, 0),
  };
}

export async function getMapComplexes(): Promise<MapComplexDTO[]> {
  const rows = await prisma.complex.findMany({
    orderBy: { name: "asc" },
    include: {
      microdistrict: { select: { districtId: true } },
      buildings: { select: { _count: { select: { issues: { where: OPEN } } } } },
    },
  });
  return rows.map(({ microdistrict, buildings, ...c }) => ({
    ...c,
    districtId: microdistrict.districtId,
    houses: buildings.length,
    openIssues: buildings.reduce((n, b) => n + b._count.issues, 0),
  }));
}

/** House passport. `osm-<osmId>` ids not in the DB are created lazily (§6.3); the result may then carry an existing house's id. */
export async function getBuilding(id: string): Promise<BuildingPassportDTO | null> {
  const osmId = id.startsWith("osm-") ? Number(id.slice(4)) : null;
  const resolvedId = osmId === null ? id : Number.isSafeInteger(osmId) ? await ensureOsmBuilding(osmId) : null;
  if (!resolvedId) return null;
  const [b, works] = await Promise.all([
    prisma.building.findUnique({
      where: { id: resolvedId },
      include: {
        complex: { select: { id: true, name: true } },
        microdistrict: { select: { id: true, name: true, district: { select: { id: true, name: true, color: true } } } },
        managementCompany: true,
        issues: { orderBy: { createdAt: "desc" } },
        bills: { orderBy: { period: "asc" } },
      },
    }),
    getCityWorks(),
  ]);
  if (!b) return null;
  const { issues, bills, microdistrict, ...building } = b;
  const dtos = issues.map((i) => toIssueDTO(i, b.address));
  return {
    building: { ...building, microdistrict: { id: microdistrict.id, name: microdistrict.name }, district: microdistrict.district },
    openIssues: dtos.filter((i) => i.status !== "resolved"),
    resolvedIssues: dtos.filter((i) => i.status === "resolved"),
    bills: bills.map(toBillDTO),
    works: works.flatMap((w) => {
      const affectsBuilding = w.buildings.some((x) => x.id === b.id);
      const near = w.lat !== null && w.lng !== null && meters(b, { lat: w.lat, lng: w.lng }) <= NEAR_METERS;
      return affectsBuilding || near ? [{ ...w, affectsBuilding }] : [];
    }),
    health: computeHealth({ issues, yearBuilt: b.yearBuilt }),
  };
}

export async function getIssues(): Promise<IssueDTO[]> {
  const rows = await prisma.issue.findMany({
    include: { building: { select: { address: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ building, ...i }) => toIssueDTO(i, building?.address));
}

/** One issue with its house address, or null. */
export async function getIssue(id: string): Promise<IssueDTO | null> {
  const row = await prisma.issue.findUnique({ where: { id }, include: { building: { select: { address: true } } } });
  if (!row) return null;
  const { building, ...issue } = row;
  return toIssueDTO(issue, building?.address);
}

export async function getCityWorks(): Promise<CityWorkDTO[]> {
  const rows = await prisma.cityWork.findMany({
    orderBy: { startDate: "asc" },
    include: { impacts: { select: { building: { select: { id: true, address: true } } } } },
  });
  return rows.map(toWorkDTO);
}

export async function getAuthorities(): Promise<AuthorityDTO[]> {
  const rows = await prisma.authority.findMany({ orderBy: { id: "asc" } });
  return rows.map((a) => ({ ...a, handles: JSON.parse(a.handles) as string[] }));
}

export async function getDistrictStats(id: string): Promise<DistrictStatsDTO> {
  const issues = (await issuesByDistrict()).filter((i) => i.districtId === id);
  const open = issues.filter((i) => i.status !== "resolved");
  const counts = new Map<IssueCategory, number>();
  for (const i of open) counts.set(i.category as IssueCategory, (counts.get(i.category as IssueCategory) ?? 0) + 1);
  return {
    openIssues: open.length,
    totalIssues: issues.length,
    topCategories: [...counts]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
