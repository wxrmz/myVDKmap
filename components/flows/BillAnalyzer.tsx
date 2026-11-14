"use client";

// «Разобрать квитанцию» (§5.6): PDF, text or the demo → lines in plain words, chart by month, what changed.
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FileUp, Loader2, Save, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCabinet } from "@/components/cabinet/shared";
import { monthLabel, rub } from "@/lib/utils";
import type { BillOutput } from "@/lib/ai/schemas";
import { isPart } from "@/lib/bills";
import { updateCabinet } from "@/lib/cabinet";
import { houseHref } from "@/lib/nav";
import { BILL_KIND_LABELS, BILL_KINDS, type BillKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api, readAsDataUrl } from "./api";
import { CheckList, Insights, Share } from "./BillParts";
import { FlowHeader } from "./FlowHeader";

const BillChart = dynamic(() => import("./BillChart"), { ssr: false });

// Base64 grows the file by a third; the API takes up to 8 MB.
const MAX_FILE = 5 * 1024 * 1024;

const billId = (kind: BillKind, b: BillOutput) => `bill-${kind}-${b.period ?? "unknown"}-${b.total}`;

export function BillAnalyzer({ house }: { house: { id: string; address: string } | null }) {
  // One section per receipt: each keeps its own text and result, so a capital repair receipt never mixes with the ЖКУ one.
  const [kind, setKind] = useState<BillKind>("housing");
  const [texts, setTexts] = useState<Partial<Record<BillKind, string>>>({});
  const [bills, setBills] = useState<Partial<Record<BillKind, BillOutput>>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const text = texts[kind] ?? "";
  const bill = bills[kind] ?? null;
  const cabinet = useCabinet().bills;
  const analysed = BILL_KINDS.flatMap((k) => (bills[k] ? [[k, bills[k]] as const] : []));
  const unsaved = analysed.filter(([k, b]) => !cabinet.some((c) => c.id === billId(k, b)));
  const saved = !!bill && !unsaved.some(([k]) => k === kind);

  async function analyze(input: { demo?: true; text?: string; pdf?: string }) {
    const k = kind;
    setBusy(true);
    // The resident's own saved receipts of this kind: the analysis compares with them.
    const previous = cabinet
      .filter((b) => (b.kind ?? "housing") === k && b.period)
      .map(({ period, total, items }) => ({ period: period!, total, items: items.map(({ name, amount, unit, volume, tariff }) => ({ name, amount, unit, volume, tariff })) }));
    const res = await api<BillOutput>("/api/ai/bill", { body: { ...input, kind: k, buildingId: house?.id, previous } });
    if (res) setBills((b) => ({ ...b, [k]: res }));
    setBusy(false);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Нужна квитанция в PDF. Фото не читаем — вставьте текст квитанции в поле ниже");
    if (file.size > MAX_FILE) return toast.error("Файл больше 5 МБ. Выберите поменьше");
    await analyze({ pdf: await readAsDataUrl(file) });
  }

  /** Every analysed receipt not yet in the cabinet, from all tabs at once. */
  function save() {
    const savedAt = new Date().toISOString();
    const entries = unsaved.map(([k, b]) => ({
      id: billId(k, b),
      kind: k,
      period: b.period,
      total: b.total,
      buildingId: house?.id,
      items: b.items.map(({ name, plainName, amount, explanation, unit, volume, tariff }) => ({ name, plainName, amount, explanation, unit, volume, tariff })),
      savedAt,
    }));
    const ids = new Set(entries.map((e) => e.id));
    updateCabinet((c) => ({ ...c, bills: [...c.bills.filter((b) => !ids.has(b.id)), ...entries] }));
    toast.success(entries.length > 1 ? `Квитанции сохранены в кабинете: ${entries.length}` : "Квитанция сохранена в кабинете");
  }

  const chart = bill?.history.map((h) => ({ month: monthLabel(h.period).split(" ")[0].slice(0, 3), label: monthLabel(h.period), total: h.total }));

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <FlowHeader
        title="Разобрать квитанцию"
        description={
          house ? `Квитанция дома ${house.address}: объясним каждую строку и что изменилось.` : "Объясним каждую строку квитанции простыми словами и что изменилось."
        }
        backHref={house ? houseHref(house.id) : "/"}
      />

      <div role="tablist" aria-label="Какая квитанция" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4">
        {BILL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            disabled={busy}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
              kind === k ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BILL_KIND_LABELS[k]}
            {bills[k] && <span className="size-1.5 rounded-full bg-turquoise" aria-label="разобрана" />}
          </button>
        ))}
      </div>

      <section className="panel-box flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {kind === "housing" && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => analyze({ demo: true })} disabled={busy}>
              <Sparkles /> Пример квитанции
            </Button>
          )}
          <Button className="h-11 rounded-xl" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileUp /> PDF квитанции
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <Textarea
          value={text}
          onChange={(e) => setTexts((t) => ({ ...t, [kind]: e.target.value }))}
          maxLength={20000}
          rows={4}
          placeholder="Или вставьте текст квитанции: «Холодная вода … 320,64»"
          aria-label="Текст квитанции"
          className="text-base"
        />
        <Button variant="outline" className="h-11 self-start rounded-xl" disabled={busy || !text.trim()} onClick={() => analyze({ text })}>
          Разобрать текст
        </Button>
      </section>

      {busy && (
        <div className="panel-box flex items-center gap-3 text-muted-foreground animate-in fade-in duration-200">
          <Loader2 className="size-5 animate-spin" /> Читаем квитанцию…
        </div>
      )}

      {bill && !busy && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <section className="panel-box flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {BILL_KIND_LABELS[kind]}
                {bill.period && <span className="font-normal text-muted-foreground"> · {monthLabel(bill.period).toLowerCase()}</span>}
              </h2>
              <span className="text-lg font-semibold tabular-nums">{rub(bill.total)}</span>
            </div>
            <Insights items={bill.insights} />
            <ul className="flex flex-col divide-y divide-border">
              {/* Index keys: a receipt can list the same service twice, and a repeated key left rows behind between tabs. */}
              {bill.items.map((i, n) => (
                <li key={n} className="flex gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium">{i.plainName}</span>
                    <span className="text-sm text-muted-foreground">{i.explanation}</span>
                    {i.plainName !== i.name && <span className="text-xs text-muted-foreground">В квитанции: {i.name}</span>}
                    {!isPart(i) && bill.total > 0 && <Share part={i.amount} of={bill.total} />}
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{rub(i.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel-box flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Проверка квитанции</h2>
            <CheckList checks={bill.checks} />
          </section>

          {chart && chart.length > 1 && (
            <section className="panel-box flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Сумма по месяцам</h2>
              <div className="h-52" role="img" aria-label={chart.map((c) => `${c.label}: ${rub(c.total)}`).join(", ")}>
                <BillChart data={chart} />
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Что изменилось и что делать</h2>
            {bill.changes.length ? (
              bill.changes.map((c, n) => {
                const Icon = c.deltaPercent >= 0 ? TrendingUp : TrendingDown;
                return (
                  <article key={n} className="panel-box flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={c.deltaPercent >= 0 ? "size-5 text-coral" : "size-5 text-turquoise"} />
                      <span className="flex-1 font-medium">{c.item}</span>
                      <span className={c.deltaPercent >= 0 ? "font-semibold text-coral" : "font-semibold text-turquoise"}>
                        {c.deltaPercent > 0 ? "+" : ""}
                        {c.deltaPercent} %
                      </span>
                    </div>
                    <p className="text-sm">{c.likelyReason}</p>
                    <p className="text-sm text-muted-foreground">{c.action}</p>
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">По сравнению с прошлыми месяцами заметных изменений нет.</p>
            )}
          </section>

          <Button variant={unsaved.length ? "default" : "outline"} className="h-11 self-start rounded-xl" onClick={save} disabled={!unsaved.length}>
            <Save />{" "}
            {!unsaved.length
              ? "Сохранено в кабинете"
              : unsaved.length > 1
                ? `Сохранить в кабинет все разобранные (${unsaved.length})`
                : saved
                  ? `Сохранить в кабинет: ${BILL_KIND_LABELS[unsaved[0][0]].toLowerCase()}`
                  : "Сохранить в кабинет"}
          </Button>
        </div>
      )}
    </div>
  );
}

