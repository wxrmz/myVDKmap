// Receipt analytics shared by the analysis (lib/ai/rules.ts) and the cabinet: arithmetic checks, line deltas, totals.
import { plural } from "@/lib/health";
import type { BillItem } from "@/lib/types";
import { monthLabel, norm, rub } from "@/lib/utils";

export type BillCheck = { ok: boolean; text: string };
type Line = BillItem & { plainName?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const label = (i: Line) => `«${i.plainName ?? i.name}»`;
/** «в т. ч. …» lines are parts of the line above, already inside its sum: receipts saved before such lines were left out. */
export const isPart = (i: { name: string }) => i.name.startsWith("в т. ч. ");
const ownLines = <T extends Line>(items: T[]) => items.filter((i) => !isPart(i));
const pct = (now: number, before: number) => Math.round(((now - before) / before) * 100);

/** What can be checked from the receipt alone: the lines add up, volume × tariff, sewerage = hot + cold water, repeats. */
export function billChecks(items: Line[], total: number): BillCheck[] {
  const checks: BillCheck[] = [];
  const sum = r2(ownLines(items).reduce((s, i) => s + i.amount, 0));
  const diff = r2(total - sum);
  checks.push(
    Math.abs(diff) < 1
      ? { ok: true, text: `Строки складываются в итог ${rub(total)}.` }
      : {
          ok: false,
          text: `Строки дают ${rub(sum)}, а итог — ${rub(total)}: разница ${rub(Math.abs(diff))}. Так бывает из-за перерасчёта, долга или пеней — спросите в управляющей компании, откуда она.`,
        },
  );

  const metered = items.filter((i): i is Line & { volume: number; tariff: number } => i.volume !== undefined && i.tariff !== undefined);
  const wrong = metered.filter((i) => Math.abs(i.volume * i.tariff - i.amount) > Math.max(1, i.amount * 0.01));
  for (const i of wrong) {
    checks.push({
      ok: false,
      text: `${label(i)}: ${num(i.volume)} ${i.unit ?? ""} × ${rub(i.tariff)} = ${rub(r2(i.volume * i.tariff))}, а начислено ${rub(i.amount)}. Попросите управляющую компанию объяснить разницу.`.replace("  ×", " ×"),
    });
  }
  if (metered.length && !wrong.length) {
    checks.push({ ok: true, text: `Объём × тариф сходится с начислением в ${metered.length} ${plural(metered.length, ["строке", "строках", "строках"])}.` });
  }

  const volume = (re: RegExp) => items.find((i) => re.test(norm(i.name)) && i.volume !== undefined)?.volume;
  const [sewer, hot, cold] = [volume(/водоотвед|канализ/), volume(/горяч/), volume(/холодн/)];
  if (sewer !== undefined && hot !== undefined && cold !== undefined) {
    const water = r2(hot + cold);
    checks.push(
      Math.abs(sewer - water) < 0.01
        ? { ok: true, text: `Водоотведение (${num(sewer)} м³) равно горячей и холодной воде вместе.` }
        : { ok: false, text: `Водоотведение — ${num(sewer)} м³, а горячей и холодной воды вместе ${num(water)} м³. Обычно они совпадают: уточните в управляющей компании.` },
    );
  }

  const seen = new Set<string>();
  for (const i of ownLines(items)) {
    const key = `${norm(i.name)}|${i.amount}`;
    if (seen.has(key)) checks.push({ ok: false, text: `${label(i)} встречается дважды с одной суммой — проверьте, не начислили ли её два раза.` });
    seen.add(key);
  }
  return checks;
}

/** Each line with the same line of an earlier receipt and the change in percent. */
export function lineDeltas<T extends Line>(items: T[], before: BillItem[] = []) {
  return items.map((i) => {
    const prev = before.find((b) => norm(b.name) === norm(i.name))?.amount;
    return { ...i, before: prev, delta: prev ? pct(i.amount, prev) : undefined };
  });
}

/** A few sentences with numbers: the biggest line, the change to the previous month, the average of earlier months. */
export function billInsights(items: Line[], total: number, history: { period: string; total: number }[], period?: string): string[] {
  const out: string[] = [];
  const top = [...ownLines(items)].sort((a, b) => b.amount - a.amount)[0];
  if (top && total > 0) out.push(`Больше всего уходит на ${label(top)}: ${rub(top.amount)}, ${Math.round((top.amount / total) * 100)} % суммы.`);
  const earlier = history.filter((h) => period && h.period < period);
  const prev = earlier.at(-1);
  if (prev && prev.total > 0) {
    const d = r2(total - prev.total);
    out.push(
      Math.abs(d) < 0.01
        ? `Столько же, сколько за ${monthLabel(prev.period).toLowerCase()}.`
        : `К прошлому месяцу (${monthLabel(prev.period).toLowerCase()}): ${d > 0 ? "+" : "−"}${rub(Math.abs(d))} (${d > 0 ? "+" : "−"}${Math.abs(pct(total, prev.total))} %).`,
    );
  }
  if (earlier.length >= 2) {
    const avg = r2(earlier.reduce((s, h) => s + h.total, 0) / earlier.length);
    const d = pct(total, avg);
    out.push(
      `В среднем за ${earlier.length} ${plural(earlier.length, ["прошлый месяц", "прошлых месяца", "прошлых месяцев"])} — ${rub(avg)}` +
        (d === 0 ? ", этот месяц на уровне среднего." : `, этот месяц на ${Math.abs(d)} % ${d > 0 ? "дороже" : "дешевле"}.`),
    );
  }
  return out;
}
