"use client";

// Search field over the map (§5.9): rotating placeholder, debounced `/api/search`, results card below.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, House, Loader2, Map as MapIcon, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SEARCH_INPUT_ID = "map-search";

const EXAMPLES = ["ЖК «Фрегат»", "ул. Нейбута", "Первомайский район", "Босфорский парк"];
const TYPE: Record<SearchResult["type"], { label: string; Icon: typeof MapIcon }> = {
  district: { label: "Район", Icon: MapIcon },
  complex: { label: "ЖК", Icon: Building2 },
  building: { label: "Дом", Icon: House },
};

/** With `onSelect`, only houses are listed and choosing one calls it instead of navigating (address step of /report). */
export function SearchBox({
  className,
  onSelect,
  inputId = SEARCH_INPUT_ID,
}: {
  className?: string;
  onSelect?: (house: SearchResult & { lat: number; lng: number }) => void;
  inputId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const query = q.trim();

  useEffect(() => {
    const t = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (onSelect) return; // the `/` hotkey belongs to the map search only
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const found = res.ok ? ((await res.json()) as SearchResult[]) : [];
        setResults(onSelect ? found.filter((r) => r.lat !== undefined) : found);
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      }
      if (!ctrl.signal.aborted) setLoading(false);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, onSelect]);

  function go(r: SearchResult) {
    if (!onSelect) router.push(r.href);
    else if (r.lat !== undefined && r.lng !== undefined) onSelect({ ...r, lat: r.lat, lng: r.lng });
    setQ("");
    setResults(null);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const n = results?.length ?? 0;
    if (e.key === "Escape") inputRef.current?.blur();
    else if (e.key === "ArrowDown" && n) setActive((i) => (i + 1) % n);
    else if (e.key === "ArrowUp" && n) setActive((i) => (i - 1 + n) % n);
    else if (e.key === "Enter" && results?.[active]) go(results[active]);
    else return;
    e.preventDefault();
  }

  const open = focused && query !== "";
  const showSkeleton = loading;

  return (
    <div className={cn("relative", className)}>
      <motion.div
        animate={{ scale: focused ? 1.015 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "relative flex h-12 items-center gap-2 rounded-2xl bg-card px-3.5 ring-1 ring-border transition-shadow duration-200",
          focused ? "shadow-lg" : "shadow-sm",
        )}
      >
        <motion.span animate={{ rotate: focused ? -12 : 0 }} className="text-muted-foreground">
          <Search className="size-5" />
        </motion.span>
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id={inputId}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setResults(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            aria-label="Поиск: район, ЖК, улица или дом"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${inputId}-results`}
            autoComplete="off"
            className="h-12 w-full bg-transparent text-base outline-none"
          />
          {!q && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-nowrap text-muted-foreground">
              Найти:&nbsp;
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={example}
                  initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -10, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3 }}
                >
                  {EXAMPLES[example]}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ищем" />}
        {q && (
          <button
            type="button"
            aria-label="Очистить"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ("");
              setResults(null);
              inputRef.current?.focus();
            }}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {open && (showSkeleton || results) && (
          <motion.div
            id={`${inputId}-results`}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-card p-1.5 shadow-lg ring-1 ring-border"
          >
            {showSkeleton ? (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : results?.length ? (
              results.map((r, i) => {
                const { label, Icon } = TYPE[r.type];
                return (
                  <motion.button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.15 }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-2 text-left",
                      i === active && "bg-muted",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground ring-1 ring-border">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                      {label}
                    </span>
                  </motion.button>
                );
              })
            ) : (
              <p className="p-3 text-sm text-muted-foreground">
                Ничего не нашлось. Попробуйте улицу, номер дома или название ЖК.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
