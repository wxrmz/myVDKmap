// Self-check: npx tsx components/map/shapes.test.ts
import assert from "node:assert/strict";
import { buildShapes, clusterByDistance, insideDistrict, type DistrictGeo } from "./shapes";

const square = (x: number, y: number, size: number) => [
  [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ],
];

const geo: DistrictGeo = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "multi", name: "Мульти", color: "#000000" },
      // a big empty part and a small one with all the points
      geometry: { type: "MultiPolygon", coordinates: [square(131, 43, 0.5), square(132, 43, 0.1)] },
    },
    {
      type: "Feature",
      properties: { id: "empty", name: "Пусто", color: "#ffffff" },
      geometry: { type: "MultiPolygon", coordinates: [square(130, 42, 0.1), square(130.5, 42, 0.3)] },
    },
  ],
};

const shapes = buildShapes(geo, [{ lat: 43.05, lng: 132.05 }], [{ lat: 43.02, lng: 132.02 }]);
assert.deepEqual(shapes.multi.frame, { southWest: [132, 43], northEast: [132.1, 43.1] });
// grid search: the label lands in the middle of the square within a fraction of its size
assert.ok(Math.abs(shapes.multi.label[0] - 132.05) < 2e-3 && Math.abs(shapes.multi.label[1] - 43.05) < 2e-3);
// a bent (L) shape: the label stays inside an arm, not at the mass center out in the notch
const bent = buildShapes(
  {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: "l", name: "L", color: "#000000" },
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 0.2], [0.2, 0.2], [0.2, 1], [0, 1], [0, 0]]] },
      },
    ],
  },
  [],
  [],
);
const [lx, ly] = bent.l.label;
assert.ok(lx < 0.2 || ly < 0.2, `L label ${lx},${ly}`);
assert.equal(shapes.multi.parts.length, 2);
// no points anywhere: the largest part wins
assert.deepEqual(shapes.empty.frame, { southWest: [130.5, 42], northEast: [130.8, 42.3] });
assert.ok(insideDistrict(shapes.multi, { lat: 43.2, lng: 131.2 }));
assert.ok(!insideDistrict(shapes.multi, { lat: 42.5, lng: 131.2 }));

const clusters = clusterByDistance([0, 10, 47, 100, 147, 148], (x) => [x, 0], 48);
assert.deepEqual(clusters, [[0, 10, 47], [100, 147], [148]]);

console.log("shapes: ok");
