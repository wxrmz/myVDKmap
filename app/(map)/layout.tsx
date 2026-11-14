import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MapProvider } from "@/components/map/MapContext";
import { buildShapes, type DistrictGeo, type DistrictPlace } from "@/components/map/shapes";
import { MapShell } from "@/components/map/MapShell";
import { getCityWorks, getDistricts, getIssues, getMapComplexes } from "@/lib/queries";
import type { IssueDTO, MapComplexDTO, MapIssueDTO } from "@/lib/types";

// Every page of the group shares this layout: the map is mounted once and survives navigation (§2).
export const dynamic = "force-dynamic";

/** The map's copy of an issue: its description and appeal are read on the issue's own page. */
const forMap = (i: IssueDTO): MapIssueDTO => {
  const out: Partial<IssueDTO> = { ...i };
  delete out.description;
  delete out.appealText;
  return out as MapIssueDTO;
};

let geoFile: Promise<DistrictGeo> | undefined;
let placesCache: { key: string; places: Record<string, DistrictPlace> } | undefined;

/** Label and camera frame per district, recomputed only when complexes or open issues change. */
function districtPlaces(geo: DistrictGeo, complexes: MapComplexDTO[], issues: MapIssueDTO[]) {
  const key = [...complexes, ...issues].map((p) => `${p.lat},${p.lng}`).join(";");
  if (placesCache?.key !== key) {
    const shapes = buildShapes(geo, complexes, issues);
    placesCache = { key, places: Object.fromEntries(Object.entries(shapes).map(([id, { label, frame }]) => [id, { label, frame }])) };
  }
  return placesCache.places;
}

export default async function MapLayout({ children }: { children: React.ReactNode }) {
  const [districts, complexes, issues, works, geo] = await Promise.all([
    getDistricts(),
    getMapComplexes(),
    getIssues(),
    getCityWorks(),
    (geoFile ??= readFile(join(process.cwd(), "public/geo/districts.geojson"), "utf8").then((s) => JSON.parse(s) as DistrictGeo)),
  ]);
  const open = issues.filter((i) => i.status !== "resolved").map(forMap);
  return (
    <MapProvider data={{ districts, complexes, issues: open, works, places: districtPlaces(geo, complexes, open) }}>
      <MapShell>{children}</MapShell>
    </MapProvider>
  );
}
