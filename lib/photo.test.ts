// Self-check: npx tsx lib/photo.test.ts
import assert from "node:assert/strict";
import { safePhoto } from "./photo";

const url = (type: string, bytes: number[]) => `data:${type};base64,${Buffer.from([...bytes, ...Array(16).fill(0)]).toString("base64")}`;
assert.equal(safePhoto(url("image/jpeg", [0xff, 0xd8, 0xff, 0xe0]))?.startsWith("data:image/jpeg;base64,"), true);
// The type comes from the bytes: a PNG labelled as JPEG is stored as PNG.
assert.equal(safePhoto(url("image/jpeg", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.startsWith("data:image/png;"), true);
const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64")}`;
assert.equal(safePhoto(svg), null);
assert.equal(safePhoto(svg.replace("svg+xml", "jpeg")), null); // SVG with a JPEG label
assert.equal(safePhoto("data:image/jpeg;base64,not base64!"), null);
assert.equal(safePhoto("/demo/pothole.svg"), null);
console.log("photo: ok");
