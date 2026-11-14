"use client";

// Navigation (§5.1): desktop rail 88 px and the phone tab bar. Links are fully prefetched.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser, Construction, Heart, Layers, Map as MapIcon, ReceiptRussianRuble, Search, TriangleAlert } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { focusSearchOnMount, SEARCH_INPUT_ID } from "@/components/search/SearchBox";
import { cn } from "@/lib/utils";
import { FavoritesPopover } from "./FavoritesPopover";
import { LayersPopover } from "./LayersPopover";
import { closeTo, crossFadeTo, isPhone } from "./navMotion";
import { useIdlePrefetch } from "./useIdlePrefetch";

const MAP = { href: "/", label: "Карта", Icon: MapIcon };
const FLOWS = [
  { href: "/report", label: "Проблема", Icon: TriangleAlert },
  { href: "/bill", label: "Квитанция", Icon: ReceiptRussianRuble },
  { href: "/changes", label: "Работы", Icon: Construction },
];
const CABINET = { href: "/me", label: "Кабинет", Icon: CircleUser };

/**
 * Click handler for a rail / tab bar link. Desktop: old and new sections cross-fade in a View Transition.
 * Phone: a flow card slides up over the map (MapShell) and slides back down to the map; a morph between the low
 * sheet and the full-screen card covered the whole screen and the tab bar.
 */
function useCrossFade(href: string) {
  const router = useRouter();
  return (e: React.MouseEvent) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!plain || location.pathname === href) return;
    if (isPhone()) {
      if (isMapPath(location.pathname) || !isMapPath(href)) return;
      e.preventDefault();
      return closeTo(href, router.push);
    }
    e.preventDefault();
    crossFadeTo(href, router.push);
  };
}

export const isMapPath = (p: string) => p === "/" || p.startsWith("/d/") || p.startsWith("/house/") || p.startsWith("/issue/");
const isActive = (href: string, p: string) => (href === "/" ? isMapPath(p) : p === href || p.startsWith(`${href}/`));

const itemClass = (active: boolean) =>
  cn(
    "flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors duration-150",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

function RailLink({ href, label, Icon }: typeof MAP) {
  const active = isActive(href, usePathname());
  const onClick = useCrossFade(href);
  return (
    <Link href={href} prefetch={false} onClick={onClick} className={itemClass(active)} aria-current={active ? "page" : undefined}>
      <Icon className="size-6" />
      {label}
    </Link>
  );
}

export function Rail() {
  const router = useRouter();
  const focusSearch = () => {
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input) return input.focus();
    focusSearchOnMount();
    router.push("/");
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

function TabLink({ href, label, Icon, active }: typeof MAP & { active: boolean }) {
  const onClick = useCrossFade(href);
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-end gap-0.5 pb-1 text-[11px] leading-tight font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-6" />
      {label}
    </Link>
  );
}

const SECTIONS = [MAP, ...FLOWS, CABINET].map((i) => i.href);

/** Mounted at every width (hidden by CSS on desktop), so it also prefetches the sections for the desktop rail. */
export function TabBar() {
  const pathname = usePathname();
  useIdlePrefetch(SECTIONS);
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-30 grid h-12 grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {[MAP, ...FLOWS, CABINET].map((item) => (
        <TabLink key={item.href} {...item} active={isActive(item.href, pathname)} />
      ))}
    </nav>
  );
}
