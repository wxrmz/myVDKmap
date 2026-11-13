// Self-check: npx tsx lib/ai/pdf.test.ts — a one-page PDF with two text lines (built by hand, no fixture file).
import assert from "node:assert/strict";
import { pdfText } from "./pdf";

function pdf(lines: string[]) {
  const content = lines.map((l, i) => `BT /F1 12 Tf 72 ${700 - i * 20} Td (${l}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(out, "latin1").toString("base64")}`;
}

async function main() {
  assert.equal(await pdfText(pdf(["Water 320,64", "Total 320,64"])), "Water 320,64\nTotal 320,64");
  assert.equal(await pdfText(pdf([])), "");
  console.log("pdf: ok");
}

main();
