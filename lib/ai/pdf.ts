// Text of a PDF receipt, line by line (§5.6): receipts are tables, so items with the same baseline make one line.
import { getDocumentProxy } from "unpdf";

type Item = { str: string; transform: number[] };

/** Empty when the PDF has no text layer (a scan). */
export async function pdfText(dataUrl: string): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64")));
  const lines: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const items = ((await (await pdf.getPage(n)).getTextContent()).items as Item[]).filter((i) => i.str?.trim());
    // shortcut: rows are grouped by a 2-point baseline tolerance; rotated or skewed scans-with-OCR may need a looser grouping.
    const rows = new Map<number, Item[]>();
    for (const i of items) {
      const y = [...rows.keys()].find((k) => Math.abs(k - i.transform[5]) < 2) ?? i.transform[5];
      rows.set(y, [...(rows.get(y) ?? []), i]);
    }
    for (const [, row] of [...rows].sort(([a], [b]) => b - a)) {
      lines.push(row.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str.trim()).join(" "));
    }
  }
  return lines.join("\n").trim();
}
