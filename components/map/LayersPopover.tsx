"use client";

// «Слои» (§5.2): popover «Что показать на карте» with ЖК · Проблемы · Работы.
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMap, type MapLayers } from "@/components/map/MapContext";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof MapLayers; label: string }[] = [
  { key: "complexes", label: "ЖК" },
  { key: "issues", label: "Проблемы" },
  { key: "works", label: "Работы" },
];

export function LayersPopover({
  children,
  side,
  align,
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  align?: "start" | "end";
}) {
  const { layers, setLayers } = useMap();
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} sideOffset={8} className="w-64 rounded-2xl p-2">
        <p className="px-2 pt-1 pb-2 text-sm font-semibold">Что показать на карте</p>
        <div className="flex flex-col gap-1">
          {ROWS.map(({ key, label }) => {
            const on = layers[key];
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors duration-150",
                  on
                    ? "bg-muted/30 font-semibold dark:bg-accent"
                    : "bg-muted hover:bg-muted/60 dark:hover:bg-accent/60",
                )}
              >
                {label}
                {on && <Check className="size-4 animate-in zoom-in-50 fade-in duration-200" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
