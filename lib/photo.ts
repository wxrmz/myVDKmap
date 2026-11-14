// Server check of an uploaded photo: the format is taken from the file's first bytes, never from the browser's word.

const SIGNATURES: [string, (b: Buffer) => boolean][] = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/gif", (b) => b.subarray(0, 4).toString("latin1") === "GIF8"],
  ["image/webp", (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"],
  ["image/heic", (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(b.subarray(8, 12).toString("latin1"))],
  ["image/avif", (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^avi[fs]$/.test(b.subarray(8, 12).toString("latin1"))],
];

/** A raster photo as a data URL with its real type, or null (SVG, not an image, broken base64). */
export function safePhoto(dataUrl: string): string | null {
  const m = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const head = Buffer.from(m[1].slice(0, 24), "base64");
  const type = SIGNATURES.find(([, test]) => test(head))?.[0];
  return type ? `data:${type};base64,${m[1]}` : null;
}
