"use client";

// «Вход в кабинет» (§5.8): demo Госуслуги button, then email login / registration.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/components/flows/api";
import type { PublicUser } from "@/lib/auth";
import { setSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
const MODES: { id: Mode; label: string }[] = [
  { id: "login", label: "Вход" },
  { id: "register", label: "Регистрация" },
];

export function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState<"form" | "esia" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("form");
    const res = await api<{ user: PublicUser }>(`/api/auth/${mode}`, {
      body: mode === "register" ? { name, email, password } : { email, password },
    });
    setBusy(null);
    if (res) setSessionUser(res.user);
  }

  async function esia() {
    setBusy("esia");
    const res = await api<{ user: PublicUser }>("/api/auth/esia/demo", { method: "POST" });
    setBusy(null);
    if (res) setSessionUser(res.user);
  }

  return (
    <section className="panel-box mx-auto flex w-full max-w-md flex-col gap-4 p-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Вход в кабинет</h2>
        <p className="text-sm text-muted-foreground">Сохранённые дома, обращения, квитанции и счётчики — на всех ваших устройствах.</p>
      </div>

      <Button variant="outline" className="h-12 rounded-xl text-base" onClick={esia} disabled={busy !== null}>
        {busy === "esia" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Войти через Госуслуги
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">демо</span>
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        или по почте
        <span className="h-px flex-1 bg-border" />
      </div>

      <div role="tablist" aria-label="Вход или регистрация" className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "relative h-9 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === m.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === m.id && (
              <motion.span
                layoutId="auth-mode"
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{m.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {mode === "register" && (
            <motion.label
              key="name"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1.5 overflow-hidden text-sm font-medium"
            >
              Имя
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" className="h-11" />
            </motion.label>
          )}
        </AnimatePresence>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Почта
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-11" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Пароль
          <span className="relative">
            <Input
              type={shown ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="h-11 pr-11"
            />
            <button
              type="button"
              aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
              onClick={() => setShown(!shown)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground"
            >
              {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
          {mode === "register" && <span className="text-xs font-normal text-muted-foreground">Не короче 8 символов</span>}
        </label>
        <Button type="submit" className="h-11 rounded-xl" disabled={busy !== null}>
          {busy === "form" && <Loader2 className="animate-spin" />}
          {mode === "register" ? "Зарегистрироваться" : "Войти"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Храним только имя и почту, а пароль — в виде необратимого хэша. Данные кабинета лежат на этом устройстве, а после входа — ещё и у нас, чтобы
        открыть их с другого телефона или компьютера.
      </p>
    </section>
  );
}
