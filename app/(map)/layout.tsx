import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MapProvider } from "@/components/map/MapContext";
import type { DistrictGeo } from "@/components/map/shapes";
import { MapShell } from "@/components/map/MapShell";
import { getCityWorks, getDistricts, getIssues, getMapComplexes } from "@/lib/queries";

// Every page of the group shares this layout: the map is mounted once and survives navigation (§2).
export const dynamic = "force-dynamic";

export default async function MapLayout({ children }: { children: React.ReactNode }) {
  const [districts, complexes, issues, works, geo] = await Promise.all([
    getDistricts(),
    getMapComplexes(),
    getIssues(),
    getCityWorks(),
    readFile(join(process.cwd(), "public/geo/districts.geojson"), "utf8").then((s) => JSON.parse(s) as DistrictGeo),
  ]);
  return (
    <MapProvider data={{ districts, complexes, issues: issues.filter((i) => i.status !== "resolved"), works, geo }}>
      <MapShell>{children}</MapShell>
    </MapProvider>
  );
}
