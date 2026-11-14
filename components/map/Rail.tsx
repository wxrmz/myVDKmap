"use client";

// Navigation (§5.1): desktop rail 88 px and the phone tab bar. Links are fully prefetched.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser, Construction, Heart, Layers, Map as MapIcon, ReceiptRussianRuble, Search, TriangleAlert } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SEARCH_INPUT_ID } from "@/components/search/SearchBox";
import { cn } from "@/lib/utils";
import { FavoritesPopover } from "./FavoritesPopover";
import { LayersPopover } from "./LayersPopover";

const MAP = { href: "/", label: "Карта", Icon: MapIcon };
const FLOWS = [
  { href: "/report", label: "Проблема", Icon: TriangleAlert },
  { href: "/bill", label: "Квитанция", Icon: ReceiptRussianRuble },
  { href: "/changes", label: "Работы", Icon: Construction },
];
const CABINET = { href: "/me", label: "Кабинет", Icon: CircleUser };

export const isMapPath = (p: string) => p === "/" || p.startsWith("/d/") || p.startsWith("/house/") || p.startsWith("/issue/");
const isActive = (href: string, p: string) => (href === "/" ? isMapPath(p) : p === href || p.startsWith(`${href}/`));

const itemClass = (active: boolean) =>
  cn(
    "flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors duration-150",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

function RailLink({ href, label, Icon }: typeof MAP) {
  const active = isActive(href, usePathname());
  return (
    <Link href={href} prefetch className={itemClass(active)} aria-current={active ? "page" : undefined}>
      <Icon className="size-6" />
      {label}
    </Link>
  );
}

export function Rail() {
  const router = useRouter();
  const focusSearch = () => {
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input) input.focus();
    else router.push("/");
  };
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-y-0 left-0 z-30 hidden w-[88px] flex-col items-center gap-1 border-r border-border bg-card px-2 py-3 md:flex"
    >
      <RailLink {...MAP} />
      <button type="button" onClick={focusSearch} className={itemClass(false)}>
        <Search className="size-6" />
        Поиск
      </button>
      <LayersPopover side="right" align="start">
        <button type="button" className={itemClass(false)}>
          <Layers className="size-6" />
          Слои
        </button>
      </LayersPopover>
      <div className="my-2 h-px w-10 bg-border" />
      {FLOWS.map((f) => (
        <RailLink key={f.href} {...f} />
      ))}
      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <FavoritesPopover side="right" align="end">
          <button type="button" className={itemClass(false)}>
            <Heart className="size-6" />
            Мои дома
          </button>
        </FavoritesPopover>
        <RailLink {...CABINET} />
        <span className="h-2" />
        <ThemeToggle />
      </div>
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {[MAP, ...FLOWS, CABINET].map(({ href, label, Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-6" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
