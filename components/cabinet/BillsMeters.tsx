"use client";

// Cabinet sections «Квитанции» (saved bills, neighbours, capital repair) and «Счётчики» (§5.8).
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckList, Insights, Share } from "@/components/flows/BillParts";
import { billChecks, billInsights, isPart, lineDeltas } from "@/lib/bills";
import { DEFAULT_SETTINGS, METER_KINDS, updateCabinet, type Cabinet, type MeterKind } from "@/lib/cabinet";
import { BILL_KIND_LABELS, BILL_KINDS } from "@/lib/types";
import { cn, norm } from "@/lib/utils";
import { dayLabel, monthLabel, rub } from "@/lib/utils";
import { CabinetSection, Empty, useHouseSummaries, useCabinet } from "./shared";

const isCapRepair = (name: string) => /капремонт|капитальн/.test(norm(name));

export function BillsSection() {
  const { bills, houses } = useCabinet();
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...bills].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
  const groups = BILL_KINDS.map((k) => ({ kind: k, bills: sorted.filter((b) => (b.kind ?? "housing") === k) })).filter((g) => g.bills.length);
  // Neighbours' bills in the DB are combined housing receipts: compare only with those.
  const latest = groups.find((g) => g.kind === "housing")?.bills[0];
  const summaries = useHouseSummaries(latest ? [latest.buildingId ?? houses[0]].filter(Boolean) : []);
  const neighbours = summaries?.[0];
  const sameMonth = neighbours?.bills.filter((b) => b.period === latest?.period) ?? [];
  const average = sameMonth.length ? sameMonth.reduce((s, b) => s + b.total, 0) / sameMonth.length : null;
  const capRepair = sorted.flatMap((b) => b.items.filter((i) => isCapRepair(i.name) || isCapRepair(i.plainName)).map((i) => ({ period: b.period, amount: i.amount })));

  return (
    <>
      <CabinetSection title="Мои квитанции">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.kind} className="flex flex-col">
              <h3 className="pt-1 text-sm font-medium text-muted-foreground">{BILL_KIND_LABELS[g.kind]}</h3>
              <ul className="flex flex-col divide-y divide-border">
                {g.bills.map((b, n) => (
                  <li key={b.id} className="flex flex-col">
                    <div className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      aria-expanded={open === b.id}
                      onClick={() => setOpen(open === b.id ? null : b.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open === b.id && "rotate-180")} />
                      <span className="flex-1 font-medium">{b.period ? monthLabel(b.period) : "Без периода"}</span>
                      <span className="font-medium tabular-nums">{rub(b.total)}</span>
                    </button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Удалить квитанцию"
                      onClick={() => updateCabinet((c) => ({ ...c, bills: c.bills.filter((x) => x.id !== b.id) }))}
                      className="rounded-full"
                    >
                      <Trash2 />
                    </Button>
                    </div>
                    {open === b.id && <BillDetail bill={b} earlier={g.bills.slice(n + 1)} />}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <Empty>
            Сохранённых квитанций нет.{" "}
            <Link href="/bill" prefetch className="font-medium text-foreground underline underline-offset-4">
              Разобрать квитанцию
            </Link>
          </Empty>
        )}
      </CabinetSection>

      {latest?.period && (
        <CabinetSection title="Сравнение с соседями">
          {average !== null && neighbours ? (
            <p className="text-sm">
              Квитанции соседей по дому {neighbours.address} за {monthLabel(latest.period).toLowerCase()} — в среднем{" "}
              <span className="font-medium">{rub(average)}</span>. У вас — <span className="font-medium">{rub(latest.total)}</span>
              {Math.abs(latest.total - average) < 0.01
                ? ", столько же."
                : `, на ${Math.abs(Math.round(((latest.total - average) / average) * 100))} % ${latest.total > average ? "больше" : "меньше"}.`}
            </p>
          ) : (
            <Empty>Сравнить пока не с чем: по вашему дому нет квитанций соседей за этот месяц.</Empty>
          )}
        </CabinetSection>
      )}

      {sorted.length > 0 && (
        <CabinetSection title="Взносы на капремонт">
          {capRepair.length ? (
            <>
              <p className="text-sm">
                Всего в сохранённых квитанциях: <span className="font-medium">{rub(capRepair.reduce((s, x) => s + x.amount, 0))}</span>
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {capRepair.map((x, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{x.period ? monthLabel(x.period) : "Без периода"}</span>
                    <span className="tabular-nums">{rub(x.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty>В сохранённых квитанциях взносов на капремонт нет.</Empty>
          )}
        </CabinetSection>
      )}
    </>
  );
}

type SavedBill = Cabinet["bills"][number];

/** A saved receipt opened in the cabinet: the lines with their share and change, checks, numbers against earlier ones. */
function BillDetail({ bill, earlier }: { bill: SavedBill; earlier: SavedBill[] }) {
  const prev = earlier.find((b) => b.period && bill.period && b.period < bill.period);
  const history = [...earlier, bill].filter((b) => b.period).map((b) => ({ period: b.period!, total: b.total })).sort((a, b) => (a.period < b.period ? -1 : 1));
  const insights = billInsights(bill.items, bill.total, history, bill.period);
  const checks = billChecks(bill.items, bill.total);
  return (
    <div className="flex flex-col gap-3 pb-3 pl-7 animate-in fade-in duration-200">
      <Insights items={insights} />
      <ul className="flex flex-col divide-y divide-border">
        {lineDeltas(bill.items, prev?.items).map((i, n) => (
          <li key={n} className="flex gap-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{i.plainName}</span>
              {i.explanation && <span className="text-xs text-muted-foreground">{i.explanation}</span>}
              {i.plainName !== i.name && <span className="text-xs text-muted-foreground">В квитанции: {i.name}</span>}
              {!isPart(i) && bill.total > 0 && <Share part={i.amount} of={bill.total} />}
            </div>
            <span className="flex shrink-0 flex-col items-end text-sm">
              <span className="font-medium tabular-nums">{rub(i.amount)}</span>
              {i.delta !== undefined && i.delta !== 0 && (
                <span className={cn("text-xs tabular-nums", i.delta > 0 ? "text-coral" : "text-turquoise")}>
                  {i.delta > 0 ? "+" : "−"}
                  {Math.abs(i.delta)} % к прошлой
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <CheckList checks={checks} />
    </div>
  );
}

const METER: Record<MeterKind, { label: string; unit: string }> = {
  cold: { label: "Холодная вода", unit: "м³" },
  hot: { label: "Горячая вода", unit: "м³" },
  power: { label: "Электричество", unit: "кВт·ч" },
};
const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export function MetersSection() {
  const { meters, settings } = useCabinet();
  const [kind, setKind] = useState<MeterKind>("cold");
  const [value, setValue] = useState("");
  const history = meters.filter((m) => m.kind === kind).sort((a, b) => b.date.localeCompare(a.date));

  function add(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(value.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return toast.error("Введите показание числом, например 123,45");
    if (history[0] && v < history[0].value) return toast.error(`Показание меньше прошлого (${fmt(history[0].value)} ${METER[kind].unit})`);
    const entry = { id: `meter-${kind}-${Date.now()}`, kind, value: v, date: new Date().toISOString() };
    updateCabinet((c) => ({ ...c, meters: [...c.meters, entry] }));
    setValue("");
    toast.success("Показание сохранено");
  }

  return (
    <CabinetSection title="Счётчики">
      <p className="text-sm text-muted-foreground">Подавайте показания до {(settings ?? DEFAULT_SETTINGS).meterDay}-го числа каждого месяца.</p>
      <div role="radiogroup" aria-label="Счётчик" className="flex flex-wrap gap-2">
        {METER_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors",
              kind === k ? "bg-foreground text-background ring-foreground" : "bg-card ring-border hover:bg-muted",
            )}
          >
            {METER[k].label}
          </button>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Показание, {METER[kind].unit}</span>
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Новое показание" className="h-11 pr-14" />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{METER[kind].unit}</span>
        </label>
        <Button type="submit" className="h-11 rounded-xl" disabled={!value.trim()}>
          Внести
        </Button>
      </form>
      {history.length ? (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {history.map((m, i) => {
            const prev = history[i + 1];
            return (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span className="text-muted-foreground">{dayLabel(m.date)}</span>
                <span className="tabular-nums">
                  {fmt(m.value)} {METER[kind].unit}
                  {prev && <span className="text-muted-foreground"> · +{fmt(m.value - prev.value)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Показаний пока нет.</Empty>
      )}
    </CabinetSection>
  );
}
