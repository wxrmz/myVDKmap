"use client";

// Cabinet sections «Соседи» (house board and poll) and «Настройки» (§5.8).
import { useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/components/flows/api";
import type { PublicUser } from "@/lib/auth";
import { DEFAULT_SETTINGS, FONT_SCALES, updateCabinet, type CabinetSettings } from "@/lib/cabinet";
import { clearSession, setSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CabinetSection, dayLabel, Empty, useHouseSummaries, useCabinet } from "./shared";

const pill = (on: boolean) =>
  cn("h-9 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors", on ? "bg-foreground text-background ring-foreground" : "bg-card ring-border hover:bg-muted");

const POLL = { id: "barrier", question: "Ставим шлагбаум на въезде во двор?" };
const CHOICES = [
  { id: "yes", label: "За" },
  { id: "no", label: "Против" },
  { id: "neutral", label: "Всё равно" },
] as const;

export function CommunitySection() {
  const { houses, posts, votes } = useCabinet();
  const summaries = useHouseSummaries(houses);
  const [picked, setPicked] = useState<string>();
  const [text, setText] = useState("");
  const houseId = picked && houses.includes(picked) ? picked : houses[0];

  if (!houseId)
    return (
      <CabinetSection title="Соседи">
        <Empty>
          Сначала сохраните свой дом: откройте его на{" "}
          <Link href="/" prefetch className="font-medium text-foreground underline underline-offset-4">
            карте
          </Link>{" "}
          и нажмите «Сохранить дом».
        </Empty>
      </CabinetSection>
    );

  const address = (id: string) => summaries?.find((h) => h.id === id)?.address ?? "Дом";
  const housePosts = posts.filter((p) => p.houseId === houseId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const vote = votes.find((v) => v.id === `${houseId}:${POLL.id}`);

  function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const post = { id: `post-${Date.now()}`, houseId: houseId!, text: text.trim(), createdAt: new Date().toISOString() };
    updateCabinet((c) => ({ ...c, posts: [...c.posts, post] }));
    setText("");
  }

  return (
    <>
      {houses.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Дом">
          {houses.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={h === houseId} onClick={() => setPicked(h)} className={pill(h === houseId)}>
              {address(h)}
            </button>
          ))}
        </div>
      )}
      <CabinetSection title="Доска дома">
        <form onSubmit={publish} className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Например: в субботу в 11:00 убираем двор, присоединяйтесь"
            aria-label="Текст объявления"
            className="text-base"
          />
          <Button type="submit" className="h-10 self-start rounded-xl" disabled={!text.trim()}>
            Опубликовать
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">Демо: объявления пока видны только вам.</p>
        {housePosts.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {housePosts.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm whitespace-pre-wrap">{p.text}</p>
                  <span className="text-xs text-muted-foreground">{dayLabel(p.createdAt)}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Удалить объявление"
                  onClick={() => updateCabinet((c) => ({ ...c, posts: c.posts.filter((x) => x.id !== p.id) }))}
                  className="rounded-full"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Объявлений пока нет.</Empty>
        )}
      </CabinetSection>
      <CabinetSection title="Опрос дома">
        <p className="font-medium">{POLL.question}</p>
        <div role="radiogroup" aria-label={POLL.question} className="flex flex-wrap gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={vote?.choice === c.id}
              onClick={() =>
                updateCabinet((cab) => ({
                  ...cab,
                  votes: [
                    ...cab.votes.filter((v) => v.id !== `${houseId}:${POLL.id}`),
                    { id: `${houseId}:${POLL.id}`, houseId: houseId!, choice: c.id, at: new Date().toISOString() },
                  ],
                }))
              }
              className={pill(vote?.choice === c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{vote ? "Голос учтён, его можно поменять." : "Выберите вариант — голос можно поменять."}</p>
      </CabinetSection>
    </>
  );
}

const SCALE_LABELS = ["Обычный", "Крупнее", "Самый крупный"];
const NOTIFY: { key: keyof CabinetSettings["notify"]; label: string }[] = [
  { key: "email", label: "На почту" },
  { key: "telegram", label: "В Telegram" },
  { key: "works", label: "О работах у моих домов" },
  { key: "issues", label: "О моих обращениях" },
];

const setSettings = (patch: Partial<Omit<CabinetSettings, "updatedAt">>) =>
  updateCabinet((c) => ({ ...c, settings: { ...(c.settings ?? DEFAULT_SETTINGS), ...patch, updatedAt: Date.now() } }));

export function SettingsSection({ user }: { user: PublicUser }) {
  const settings = useCabinet().settings ?? DEFAULT_SETTINGS;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(what: string, body: object, done: string) {
    setBusy(what);
    const res = await api<{ user: PublicUser }>("/api/auth/me", { method: "PATCH", body });
    setBusy(null);
    if (!res) return false;
    setSessionUser(res.user);
    toast.success(done);
    return true;
  }

  async function esia(method: "POST" | "DELETE") {
    setBusy("esia");
    const res = await api<{ user: PublicUser }>("/api/auth/esia/demo", { method });
    setBusy(null);
    if (res) setSessionUser(res.user);
  }

  async function remove() {
    setBusy("delete");
    const res = await api<{ ok: true }>("/api/auth/me", { method: "DELETE" });
    setBusy(null);
    if (!res) return;
    clearSession();
    toast.success("Аккаунт удалён");
  }

  const spinner = (what: string) => busy === what && <Loader2 className="animate-spin" />;

  return (
    <>
      <CabinetSection title="Внешний вид">
        <p className="text-sm text-muted-foreground">Размер шрифта</p>
        <div role="radiogroup" aria-label="Размер шрифта" className="flex flex-wrap gap-2">
          {FONT_SCALES.map((s, i) => (
            <button key={s} type="button" role="radio" aria-checked={settings.fontScale === s} onClick={() => setSettings({ fontScale: s })} className={pill(settings.fontScale === s)}>
              {SCALE_LABELS[i]}
            </button>
          ))}
        </div>
      </CabinetSection>

      <CabinetSection title="Уведомления">
        <div className="flex flex-col gap-2.5">
          {NOTIFY.map((n) => (
            <label key={n.key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.notify[n.key]}
                onChange={(e) => setSettings({ notify: { ...settings.notify, [n.key]: e.target.checked } })}
                className="size-4 accent-foreground"
              />
              {n.label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm">
          Напоминать о показаниях до
          <Input
            type="number"
            min={1}
            max={28}
            value={settings.meterDay}
            onChange={(e) => {
              const d = Math.round(Number(e.target.value));
              if (d >= 1 && d <= 28) setSettings({ meterDay: d });
            }}
            className="h-9 w-20"
          />
          числа
        </label>
      </CabinetSection>

      <CabinetSection title="Профиль">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            patch("profile", { name, phone }, "Профиль сохранён");
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Имя
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Телефон
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+7" className="h-11" />
          </label>
          <Button type="submit" variant="outline" className="h-10 self-start rounded-xl" disabled={busy !== null}>
            {spinner("profile")} Сохранить
          </Button>
        </form>
      </CabinetSection>

      <CabinetSection title="Госуслуги">
        <p className="text-sm text-muted-foreground">
          {user.esia ? "Аккаунт привязан к Госуслугам (демо)." : "Привяжите Госуслуги, чтобы подтвердить, что вы житель (демо)."}
        </p>
        <Button variant="outline" className="h-10 self-start rounded-xl" disabled={busy !== null} onClick={() => esia(user.esia ? "DELETE" : "POST")}>
          {spinner("esia")} {user.esia ? "Отвязать" : "Привязать"}
        </Button>
      </CabinetSection>

      <CabinetSection title="Пароль">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await patch("password", { password: { current: user.hasPassword ? current : undefined, next } }, "Пароль изменён")) {
              setCurrent("");
              setNext("");
            }
          }}
          className="flex flex-col gap-3"
        >
          {user.hasPassword && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Текущий пароль
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" className="h-11" />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Новый пароль
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" className="h-11" />
            <span className="text-xs font-normal text-muted-foreground">Не короче 8 символов</span>
          </label>
          <Button type="submit" variant="outline" className="h-10 self-start rounded-xl" disabled={busy !== null}>
            {spinner("password")} {user.hasPassword ? "Сменить пароль" : "Задать пароль"}
          </Button>
        </form>
      </CabinetSection>

      <CabinetSection title="Удалить аккаунт">
        <p className="text-sm text-muted-foreground">Удалим профиль и данные кабинета с сервера. Вернуть их будет нельзя.</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-10 self-start rounded-xl text-destructive">
              Удалить аккаунт
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Удалить аккаунт?</DialogTitle>
            <DialogDescription>Профиль, сохранённые дома, обращения, квитанции и показания удалятся насовсем.</DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  Отмена
                </Button>
              </DialogClose>
              <Button variant="destructive" className="h-10 rounded-xl" onClick={remove} disabled={busy !== null}>
                {spinner("delete")} Удалить насовсем
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CabinetSection>
    </>
  );
}
