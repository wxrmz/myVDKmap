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

/**
 * The point inside the polygon farthest from its edges (a coarse-to-fine grid search for the pole of inaccessibility):
 * unlike the mass center it stays in the visual middle of long or bent shapes.
 */
function visualCenter(rings: Position[][], [w, s, e, n]: number[]): [number, number] {
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180); // degrees of longitude are shorter
  const segments = rings.flatMap((ring) => ring.slice(1).map((b, i) => [ring[i], b] as const));
  const edgeDistance = (x: number, y: number) => {
    let best = Infinity;
    for (const [[ax, ay], [bx, by]] of segments) {
      const dx = (bx - ax) * k, dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * k * dx + (y - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot((x - ax) * k - t * dx, y - ay - t * dy));
    }
    return best;
  };
  const shape = polygon(rings);
  let center: [number, number] = [(w + e) / 2, (s + n) / 2];
  let score = -Infinity;
  let [cw, cs, ce, cn] = [w, s, e, n];
  for (let pass = 0; pass < 3; pass++) {
    const stepX = (ce - cw) / 24, stepY = (cn - cs) / 24;
    for (let x = cw; x <= ce; x += stepX)
      for (let y = cs; y <= cn; y += stepY) {
        if (!booleanPointInPolygon([x, y], shape)) continue;
        // A pull to the middle of the bounds keeps the label in the body of long shapes, not in a thick far lobe.
        const d = edgeDistance(x, y) - 0.2 * Math.hypot((x - (w + e) / 2) * k, y - (s + n) / 2);
        if (d > score) [score, center] = [d, [x, y]];
      }
    [cw, cs, ce, cn] = [center[0] - 2 * stepX, center[1] - 2 * stepY, center[0] + 2 * stepX, center[1] + 2 * stepY];
  }
  return score === -Infinity ? (centerOfMass(shape).geometry.coordinates as [number, number]) : center;
}

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
      label: visualCenter(best.geometry.coordinates, [w, s, e, n]),
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
