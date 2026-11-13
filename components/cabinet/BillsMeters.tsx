"use client";

// Cabinet sections «Квитанции» (saved bills, neighbours, capital repair) and «Счётчики» (§5.8).
import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SETTINGS, METER_KINDS, updateCabinet, type MeterKind } from "@/lib/cabinet";
import { cn, norm } from "@/lib/utils";
import { CabinetSection, dayLabel, Empty, monthLabel, rub, useHouseSummaries, useCabinet } from "./shared";

const isCapRepair = (name: string) => /капремонт|капитальн/.test(norm(name));

export function BillsSection() {
  const { bills, houses } = useCabinet();
  const sorted = [...bills].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
  const latest = sorted[0];
  const summaries = useHouseSummaries(latest ? [latest.buildingId ?? houses[0]].filter(Boolean) : []);
  const neighbours = summaries?.[0];
  const sameMonth = neighbours?.bills.filter((b) => b.period === latest?.period) ?? [];
  const average = sameMonth.length ? sameMonth.reduce((s, b) => s + b.total, 0) / sameMonth.length : null;
  const capRepair = sorted.flatMap((b) => b.items.filter((i) => isCapRepair(i.name) || isCapRepair(i.plainName)).map((i) => ({ period: b.period, amount: i.amount })));

  return (
    <>
      <CabinetSection title="Мои квитанции">
        {sorted.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {sorted.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 font-medium">{b.period ? monthLabel(b.period) : "Без периода"}</span>
                <span className="font-medium tabular-nums">{rub(b.total)}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Удалить квитанцию"
                  onClick={() => updateCabinet((c) => ({ ...c, bills: c.bills.filter((x) => x.id !== b.id) }))}
                  className="rounded-full"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
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
