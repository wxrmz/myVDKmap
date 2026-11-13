// District geometry for the map (§5.2): label point and camera frame per district, plus screen-space clustering.
import { area, bbox, booleanPointInPolygon, centerOfMass, polygon } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export type DistrictFeature = Feature<Polygon | MultiPolygon, { id: string; name: string; color: string }>;
export type DistrictGeo = FeatureCollection<Polygon | MultiPolygon, { id: string; name: string; color: string }>;

export interface DistrictShape {
  feature: DistrictFeature;
  /** Polygon parts, each `[outer, ...holes]` as 2GIS `Polygon` coordinates. */
  parts: Position[][][];
  /** `[lng, lat]` of the chosen part's center: the district label. */
  label: [number, number];
  /** Bounds of the chosen part for `fitBounds`. */
  frame: { southWest: [number, number]; northEast: [number, number] };
}

type LatLng = { lat: number; lng: number };

/** Per district: the part with the most complexes + issues (else the largest) gives the label and the camera frame. */
export function buildShapes(geo: DistrictGeo, complexes: LatLng[], issues: LatLng[]): Record<string, DistrictShape> {
  const points = [...complexes, ...issues].map((p) => [p.lng, p.lat]);
  const shapes: Record<string, DistrictShape> = {};
  for (const feature of geo.features) {
    const g = feature.geometry;
    const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    const ranked = parts
      .map((coords) => {
        const part = polygon(coords);
        return { part, hits: points.filter((p) => booleanPointInPolygon(p, part)).length, size: area(part) };
      })
      .sort((a, b) => b.hits - a.hits || b.size - a.size);
    const best = ranked[0].part;
    const [w, s, e, n] = bbox(best);
    shapes[feature.properties.id] = {
      feature,
      parts,
      label: centerOfMass(best).geometry.coordinates as [number, number],
      frame: { southWest: [w, s], northEast: [e, n] },
    };
  }
  return shapes;
}

export const insideDistrict = (shape: DistrictShape, p: LatLng) => booleanPointInPolygon([p.lng, p.lat], shape.feature);

/** Greedy clustering in screen pixels: an item joins the first cluster whose seed is closer than `radius`. */
export function clusterByDistance<T>(items: T[], screen: (item: T) => number[], radius: number): T[][] {
  const clusters: { seed: number[]; items: T[] }[] = [];
  for (const item of items) {
    const [x, y] = screen(item);
    const hit = clusters.find((c) => Math.hypot(c.seed[0] - x, c.seed[1] - y) < radius);
    if (hit) hit.items.push(item);
    else clusters.push({ seed: [x, y], items: [item] });
  }
  return clusters.map((c) => c.items);
}
