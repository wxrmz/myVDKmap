"use client";

// «Слои» (§5.2): popover «Что показать на карте» with ЖК · Проблемы · Работы.
import { motion } from "framer-motion";
import { Building2, Construction, TriangleAlert, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMap, type MapLayers } from "@/components/map/MapContext";
import { cn } from "@/lib/utils";

// Icons match the rail and the map markers; the tile takes the layer's map colour when it is on.
const ROWS: { key: keyof MapLayers; label: string; hint: string; Icon: LucideIcon; tile: string }[] = [
  { key: "complexes", label: "ЖК", hint: "Жилые комплексы", Icon: Building2, tile: "bg-foreground text-background" },
  { key: "issues", label: "Проблемы", hint: "Жалобы жителей", Icon: TriangleAlert, tile: "bg-coral text-white" },
  { key: "works", label: "Работы", hint: "Ремонты и отключения", Icon: Construction, tile: "bg-work text-foreground dark:text-background" },
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
      <PopoverContent side={side} align={align} sideOffset={8} className="w-72 rounded-2xl p-2">
        <p className="px-2 pt-1 pb-2 text-sm font-semibold">Что показать на карте</p>
        <div className="flex flex-col gap-1">
          {ROWS.map(({ key, label, hint, Icon, tile }) => {
            const on = layers[key];
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-150",
                  on ? "bg-muted/40 dark:bg-accent" : "bg-muted hover:bg-muted/60 dark:hover:bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                    on ? tile : "bg-card text-muted-foreground ring-1 ring-border",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", on && "font-semibold")}>{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                </span>
                <span
                  className={cn(
                    "flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
                    on ? "justify-end bg-foreground" : "justify-start bg-input",
                  )}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 700, damping: 35 }}
                    className="block size-5 rounded-full bg-card shadow-sm"
                  />
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
