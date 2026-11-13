"use client";

// Street search over the works feed (§5.7): field with a magnifier and clear button, street chips, count.
import { Search, X } from "lucide-react";

export function WorksSearch({
  query,
  onQuery,
  suggestions,
  found,
}: {
  query: string;
  onQuery: (q: string) => void;
  suggestions: string[];
  found: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-12 items-center gap-2 rounded-2xl bg-card px-3.5 shadow-sm ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Улица, например Посьетская"
          aria-label="Поиск работ по улице"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => onQuery("")}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in duration-150">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onQuery(s)}
              className="h-8 rounded-full bg-card px-3 text-sm ring-1 ring-border transition-colors hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {query.trim() && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {found ? `Найдено работ: ${found}` : "На этой улице работ не объявлено."}
        </p>
      )}
    </div>
  );
}
