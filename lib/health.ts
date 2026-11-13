// House health 0–100 (§6.5).
import type { HealthDTO } from "@/lib/types";

const DAY = 86_400_000;
const SEVERITY_WEIGHT: Record<number, number> = { 1: 6, 2: 10, 3: 15 };
const STALE_DAYS = 30;

/** Russian plural: plural(5, ["жалоба", "жалобы", "жалоб"]) → "жалоб". */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

export function computeHealth(
  house: { issues: { severity: number; status: string; createdAt: string | Date }[]; yearBuilt?: number | null },
  now = new Date(),
): HealthDTO {
  const open = house.issues.filter((i) => i.status !== "resolved");
  const ages = open.map((i) => Math.max(0, (now.getTime() - new Date(i.createdAt).getTime()) / DAY));
  let penalty = open.reduce((sum, i, n) => {
    const w = SEVERITY_WEIGHT[i.severity] ?? SEVERITY_WEIGHT[2];
    return sum + w + w * Math.min(1, ages[n] / 90);
  }, 0);

  const age = house.yearBuilt ? now.getFullYear() - house.yearBuilt : null;
  if (age !== null) penalty += Math.min(20, Math.max(0, age - 5) * 0.4);

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const parts: string[] = [];
  if (open.length) parts.push(`${open.length} ${plural(open.length, ["открытая жалоба", "открытые жалобы", "открытых жалоб"])}`);
  if (ages.some((d) => d > STALE_DAYS)) parts.push("Жалобы долго не решают");
  if (age !== null && age > 5) parts.push(`Дому ${age} ${plural(age, ["год", "года", "лет"])}`);

  if (score >= 80) return { score, level: "good", label: "Всё хорошо", parts };
  if (score >= 50) return { score, level: "warn", label: "Есть проблемы", parts };
  return { score, level: "bad", label: "Нужно внимание", parts };
}
