"use client";

// Cabinet /me (§5.8): login when signed out; profile and sections (list on the right, chips on phones) when signed in.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Heart, LogOut, ReceiptRussianRuble, Settings, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FlowHeader } from "@/components/flows/FlowHeader";
import type { PublicUser } from "@/lib/auth";
import { clearSession, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Auth } from "./Auth";
import { BillsSection, MetersSection } from "./BillsMeters";
import { CommunitySection, SettingsSection } from "./CommunitySettings";
import { HousesSection, IssuesSection } from "./HousesIssues";
import { useCabinet } from "./shared";

type Tab = "houses" | "issues" | "bills" | "meters" | "community" | "settings";

export function CabinetPage() {
  const session = useSession();
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <FlowHeader title="Личный кабинет" />
      {session.status === "loading" ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : session.status === "guest" ? (
        <Auth />
      ) : (
        <SignedIn user={session.user} />
      )}
    </div>
  );
}

function SignedIn({ user }: { user: PublicUser }) {
  const c = useCabinet();
  const [tab, setTab] = useState<Tab>("houses");
  const sections: { id: Tab; label: string; Icon: typeof Heart; count?: number }[] = [
    { id: "houses", label: "Мои дома", Icon: Heart, count: c.houses.length },
    { id: "issues", label: "Обращения", Icon: TriangleAlert, count: c.issues.length + (c.draft ? 1 : 0) },
    { id: "bills", label: "Квитанции", Icon: ReceiptRussianRuble, count: c.bills.length },
    { id: "meters", label: "Счётчики", Icon: Gauge, count: c.meters.length },
    { id: "community", label: "Соседи", Icon: Users, count: c.posts.length },
    { id: "settings", label: "Настройки", Icon: Settings },
  ];

  return (
    <>
      <Profile user={user} />

      {/* phones: chips */}
      <nav aria-label="Разделы кабинета" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden">
        {sections.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "true" : undefined}
            onClick={() => setTab(id)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors",
              tab === id ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
            )}
          >
            {label}
            {count ? <span className="ml-1.5 opacity-70">{count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_13rem] md:items-start">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex min-w-0 flex-col gap-4"
          >
            {tab === "houses" && <HousesSection />}
            {tab === "issues" && <IssuesSection />}
            {tab === "bills" && <BillsSection />}
            {tab === "meters" && <MetersSection />}
            {tab === "community" && <CommunitySection />}
            {tab === "settings" && <SettingsSection user={user} />}
          </motion.div>
        </AnimatePresence>

        <aside className="panel-box sticky top-0 hidden flex-col gap-1 p-2 md:flex">
          <h2 className="px-2 pt-1 pb-2 text-sm font-semibold text-muted-foreground">Разделы</h2>
          {sections.map(({ id, label, Icon, count }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setTab(id)}
                // Active: no focus ring (Safari draws one on the clicked tab); others keep a visible keyboard focus.
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left text-sm font-medium outline-none transition-colors",
                  active ? "text-background" : "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="cabinet-tab"
                    className="absolute inset-0 rounded-xl bg-foreground"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground ring-1 ring-border">
                  <Icon className="size-4" />
                </span>
                <span className="relative flex-1">{label}</span>
                {count ? <span className="relative px-1 text-xs tabular-nums opacity-70">{count}</span> : null}
              </button>
            );
          })}
        </aside>
      </div>
    </>
  );
}

function Profile({ user }: { user: PublicUser }) {
  const [busy, setBusy] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); // the cookie expires anyway; this device forgets the session
    clearSession();
  }

  return (
    <section className="panel-box flex items-center gap-4 animate-in fade-in duration-200">
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">{initials || "?"}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-lg font-semibold">{user.name}</span>
        <span
          className={cn(
            "self-start rounded-full px-2.5 py-0.5 text-xs font-medium",
            user.verified ? "bg-turquoise/15 text-turquoise" : "bg-muted text-muted-foreground",
          )}
        >
          {user.verified ? "Подтверждён через Госуслуги" : "Не подтверждён"}
        </span>
        {user.email && <span className="truncate text-sm text-muted-foreground">{user.email}</span>}
      </div>
      <Button variant="outline" className="h-10 rounded-xl" onClick={logout} disabled={busy}>
        <LogOut /> <span className="max-sm:sr-only">Выйти</span>
      </Button>
    </section>
  );
}
