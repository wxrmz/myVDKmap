// Pieces of a receipt shown both after the analysis and in the cabinet.
import { CircleAlert, CircleCheck } from "lucide-react";
import type { BillCheck } from "@/lib/bills";

/** A line's share of the receipt as a thin bar. */
export function Share({ part, of }: { part: number; of: number }) {
  const p = Math.max(0, Math.min(100, Math.round((part / of) * 100)));
  return (
    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-foreground/60" style={{ width: `${p}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{p} %</span>
    </span>
  );
}

export function Insights({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-muted p-3 text-sm">
      {items.map((t, n) => (
        <li key={n}>{t}</li>
      ))}
    </ul>
  );
}

export function CheckList({ checks }: { checks: BillCheck[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {checks.map((c, n) => (
        <li key={n} className="flex gap-2">
          {c.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-turquoise" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-coral" />}
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
