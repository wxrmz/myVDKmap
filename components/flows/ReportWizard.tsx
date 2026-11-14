"use client";

// «Сообщить о проблеме» (§5.5): Фото → Описание → Адрес → Результат; the draft lives in the cabinet.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, House, ImagePlus, Loader2, MapPin, MousePointerClick, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMapScene } from "@/components/map/MapContext";
import type { MapClickDetail } from "@/components/map/MapView";
import { SearchBox } from "@/components/search/SearchBox";
import type { ClassifyOutput } from "@/lib/ai/schemas";
import { getCabinet, updateCabinet } from "@/lib/cabinet";
import { houseHref, issueHref } from "@/lib/nav";
import { ISSUE_CATEGORY_LABELS, ISSUE_KIND_LABELS, ISSUE_KINDS, type IssueDTO, type IssueKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api, readPhoto } from "./api";
import { FlowHeader } from "./FlowHeader";

const STEPS = ["Фото", "Описание", "Адрес", "Результат"];
const DEMO_PHOTO = "/demo/pothole.svg";
const MAX_PHOTO = 6 * 1024 * 1024;
// shortcut: bigger photos are not kept in the draft (localStorage quota); move drafts to IndexedDB if that matters.
const MAX_DRAFT_PHOTO = 600_000;
const POS_URL = "https://pos.gosuslugi.ru/";
const SEVERITY = { 1: "Не срочно", 2: "Важно", 3: "Опасно" } as const;
const KIND_HINTS: Record<IssueKind, string> = {
  accident: "Прорыв трубы, нет света, опасно",
  appeal: "Нужно исправить, но не срочно",
  other: "Предложение или вопрос",
};

interface Address {
  label: string;
  buildingId?: string;
  lat: number;
  lng: number;
}

type House = { id: string; address: string; lat: number; lng: number };

export function ReportWizard({ house, authorities }: { house: House | null; authorities: { id: string; name: string }[] }) {
  const fromHouse: Address | undefined = house ? { label: house.address, buildingId: house.id, lat: house.lat, lng: house.lng } : undefined;
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string>();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<IssueKind>("appeal");
  // Never preset from the passport: the resident confirms the house or picks another place on the address step.
  const [address, setAddress] = useState<Address | undefined>();
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState<ClassifyOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<IssueDTO | null>(null);
  const restored = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useMapScene(
    address
      ? {
          level: "house",
          focus: { lat: address.lat, lng: address.lng },
          buildingId: address.buildingId,
          buildings: address.buildingId ? [{ id: address.buildingId, lat: address.lat, lng: address.lng }] : [],
        }
      : { level: "city" },
  );

  // Restore the draft once after hydration.
  useEffect(() => {
    restored.current = true;
    const d = getCabinet().draft;
    if (!d) return;
    setPhoto(d.photo);
    setText(d.text);
    if (d.kind) setKind(d.kind);
    if (d.address && d.lat !== undefined && d.lng !== undefined)
      setAddress({ label: d.address, buildingId: d.buildingId, lat: d.lat, lng: d.lng });
    setStep(Math.min(d.step, 2));
  }, []);

  useEffect(() => {
    if (!restored.current || saved || (!photo && !text.trim())) return;
    updateCabinet((c) => ({
      ...c,
      draft: {
        updatedAt: Date.now(),
        step,
        photo: photo && photo.length <= MAX_DRAFT_PHOTO ? photo : undefined,
        text,
        kind,
        address: address?.label,
        buildingId: address?.buildingId,
        lat: address?.lat,
        lng: address?.lng,
      },
    }));
  }, [step, photo, text, kind, address, saved]);

  // Point on the map: the sheet steps aside on phones, a bar explains what to do.
  useEffect(() => {
    if (!picking) return;
    const root = document.documentElement;
    root.dataset.mapPick = "";
    const onClick = (e: Event) => {
      const { lat, lng } = (e as CustomEvent<MapClickDetail>).detail;
      setAddress({ label: `Точка на карте (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng });
      setPicking(false);
    };
    window.addEventListener("map:click", onClick);
    return () => {
      delete root.dataset.mapPick;
      window.removeEventListener("map:click", onClick);
    };
  }, [picking]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return toast.error("Нужна фотография: JPG, PNG, WebP или HEIC");
    if (file.size > MAX_PHOTO) return toast.error("Фото больше 6 МБ. Выберите поменьше");
    setPhoto(await readPhoto(file));
  }

  async function classify() {
    if (!address) return;
    setStep(3);
    setResult(null);
    setBusy(true);
    setResult(await api<ClassifyOutput>("/api/ai/classify", { body: { text: text.trim(), address: address.label, photo } }));
    setBusy(false);
  }

  async function save() {
    if (!result || !address) return;
    setBusy(true);
    const issue = await api<IssueDTO>("/api/issues", {
      body: {
        buildingId: address.buildingId,
        lat: address.lat,
        lng: address.lng,
        kind,
        category: result.category,
        title: result.title,
        description: text.trim() || result.title,
        photoUrl: photo,
        authorityId: result.authorityId,
        appealText: result.appealText,
        severity: result.severity,
      },
    });
    setBusy(false);
    if (!issue) return;
    window.dispatchEvent(new Event("issues:changed"));
    updateCabinet((c) => ({
      ...c,
      draft: null,
      issues: [
        ...c.issues,
        {
          id: issue.id,
          title: issue.title,
          category: issue.category,
          address: issue.address ?? address.label,
          buildingId: issue.buildingId,
          createdAt: issue.createdAt,
        },
      ],
    }));
    setSaved(issue);
    toast.success("Проблема на карте. Ответственному она сама не уходит — отправьте обращение");
  }

  function restart() {
    setSaved(null);
    setResult(null);
    setPhoto(undefined);
    setText("");
    setKind("appeal");
    setAddress(undefined);
    setStep(0);
  }

  const authority = result && (authorities.find((a) => a.id === result.authorityId)?.name ?? result.authorityId);
  const canNext = step === 0 ? true : step === 1 ? Boolean(photo || text.trim()) : Boolean(address);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <FlowHeader
        title="Сообщить о проблеме"
        description="Сфотографируйте, опишите, укажите адрес — подскажем, кто отвечает, и составим обращение."
        backHref={house ? houseHref(house.id) : "/"}
      />

      <nav aria-label="Шаги" className="flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-foreground"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </div>
        <ol className="grid grid-cols-4 gap-1 text-xs sm:text-sm">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={cn("transition-colors", i <= step ? "font-medium text-foreground" : "text-muted-foreground")}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={saved ? "saved" : step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-4"
        >
          {saved ? (
            <div className="panel-box flex flex-col items-start gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-turquoise/15 text-turquoise">
                <Check className="size-5" />
              </span>
              <h2 className="text-lg font-semibold">Проблема на карте</h2>
              <p className="text-muted-foreground">«{saved.title}» сохранена и появилась в кабинете, в разделе «Обращения».</p>
              <p className="text-sm">
                Ответственному она сама не уходит: чтобы её решили, отправьте текст обращения через «Решаем вместе» или в управляющую компанию.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-11 rounded-xl">
                  <Link href={issueHref(saved.id)} prefetch>
                    <MapPin /> Показать на карте
                  </Link>
                </Button>
                <Button variant="outline" className="h-11 rounded-xl" onClick={restart}>
                  Сообщить ещё
                </Button>
              </div>
            </div>
          ) : step === 0 ? (
            <>
              <h2 className="text-lg font-semibold">Сфотографируйте проблему</h2>
              {photo ? (
                <div className="relative overflow-hidden rounded-2xl ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URLs and a local SVG, nothing to optimise */}
                  <img src={photo} alt="Фото проблемы" className="max-h-72 w-full bg-muted object-contain" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Убрать фото"
                    onClick={() => setPhoto(undefined)}
                    className="absolute top-2 right-2 rounded-full"
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ImagePlus className="size-8" />
                  <span className="font-medium">Загрузить фото</span>
                  <span className="text-sm">JPG, PNG или HEIC, до 6 МБ</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setPhoto(DEMO_PHOTO)}>
                  <Sparkles /> Пример фото
                </Button>
                {photo && (
                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => fileRef.current?.click()}>
                    <ImagePlus /> Другое фото
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Можно и без фото — тогда опишите проблему словами на следующем шаге.</p>
              <p className="text-sm text-muted-foreground">
                Фото и описание будут видны всем на карте. Не снимайте лица, номера машин и документы.
              </p>
            </>
          ) : step === 1 ? (
            <>
              <h2 className="text-lg font-semibold">Что случилось?</h2>
              <div role="radiogroup" aria-label="Тип" className="grid grid-cols-3 gap-2">
                {ISSUE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-xl p-3 text-left ring-1 transition-colors",
                      kind === k ? "bg-foreground text-background ring-foreground" : "bg-card ring-border hover:bg-muted",
                    )}
                  >
                    <span className="font-medium">{ISSUE_KIND_LABELS[k]}</span>
                    <span className={cn("text-xs", kind === k ? "text-background/70" : "text-muted-foreground")}>{KIND_HINTS[k]}</span>
                  </button>
                ))}
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="Например: огромная яма на въезде во двор, машины бьют колёса"
                aria-label="Описание проблемы"
                className="text-base"
              />
              {!photo && !text.trim() && <p className="text-sm text-muted-foreground">Без фото нужно хотя бы пару слов.</p>}
            </>
          ) : step === 2 ? (
            <>
              <h2 className="text-lg font-semibold">Где это?</h2>
              <p className="text-sm text-muted-foreground">Найдите дом по адресу или нажмите на карту — проблема встанет ровно туда.</p>
              {address && (
                <div className="panel-box flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-border">
                    {address.buildingId ? <House className="size-4" /> : <MapPin className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{address.label}</span>
                  <Check className="size-5 text-turquoise" aria-label="Выбрано" />
                </div>
              )}
              {fromHouse && address?.buildingId !== fromHouse.buildingId && (
                <Button variant="outline" className="h-11 justify-start rounded-xl" onClick={() => setAddress(fromHouse)}>
                  <House /> Этот дом: {fromHouse.label}
                </Button>
              )}
              <SearchBox inputId="report-address" onSelect={(r) => setAddress({ label: r.title, buildingId: r.id, lat: r.lat, lng: r.lng })} />
              <Button variant="outline" className="h-11 justify-start rounded-xl" onClick={() => setPicking(true)}>
                <MousePointerClick /> Указать точку на карте
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Кто отвечает и что написать</h2>
              {busy && !result ? (
                <div className="panel-box flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" /> Разбираем описание…
                </div>
              ) : result ? (
                <>
                  <div className="panel-box flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-coral/15 px-2.5 py-0.5 font-medium text-coral">{ISSUE_CATEGORY_LABELS[result.category]}</span>
                      <span className="rounded-full px-2.5 py-0.5 ring-1 ring-border">{SEVERITY[result.severity]}</span>
                    </div>
                    <p className="text-lg font-semibold">{result.title}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Тип</dt>
                      <dd className="font-medium">{ISSUE_KIND_LABELS[kind]}</dd>
                      <dt className="text-muted-foreground">Кто отвечает</dt>
                      <dd className="font-medium">{authority}</dd>
                      <dt className="text-muted-foreground">Адрес</dt>
                      <dd className="font-medium">{address?.label}</dd>
                    </dl>
                    <p className="text-sm text-muted-foreground">{result.reasoning}</p>
                  </div>
                  <div className="panel-box flex flex-col gap-2">
                    <h3 className="font-semibold">Текст обращения</h3>
                    <p className="text-sm whitespace-pre-wrap">{result.appealText}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() =>
                        navigator.clipboard.writeText(result.appealText).then(
                          () => toast.success("Текст обращения скопирован"),
                          () => toast.error("Не получилось скопировать. Выделите текст и скопируйте вручную"),
                        )
                      }
                    >
                      <Copy /> Скопировать
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-xl">
                      <a href={POS_URL} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Открыть Госуслуги «Решаем вместе»
                      </a>
                    </Button>
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      «Сохранить на карте» показывает проблему жителям. Ответственному обращение уходит, только когда вы его отправите.
                    </p>
                    <Button className="h-11 rounded-xl sm:col-span-2" onClick={save} disabled={busy}>
                      {busy ? <Loader2 className="animate-spin" /> : <MapPin />} Сохранить на карте
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" className="h-11 self-start rounded-xl" onClick={classify}>
                  Попробовать ещё раз
                </Button>
              )}
            </>
          )}
        </motion.section>
      </AnimatePresence>

      {!saved && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setStep(step - 1)} disabled={busy}>
              Назад
            </Button>
          )}
          {step < 3 && (
            <Button className="ml-auto h-11 rounded-xl" disabled={!canNext} onClick={() => (step === 2 ? classify() : setStep(step + 1))}>
              {step === 2 ? "Получить результат" : "Дальше"}
            </Button>
          )}
        </div>
      )}

      {picking &&
        createPortal(
          <div className="fixed inset-x-3 top-3 z-40 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-lg ring-1 ring-border animate-in fade-in slide-in-from-top-2 duration-200 md:right-auto md:left-[calc(88px+min(680px,100vw-120px)+48px)]">
            <MousePointerClick className="size-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">Нажмите на карту там, где проблема</span>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setPicking(false)}>
              Отмена
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
