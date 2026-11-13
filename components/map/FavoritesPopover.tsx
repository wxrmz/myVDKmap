"use client";

// «Мои дома»: popover with the saved houses, each a link to its passport.
import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useCabinet, useHouseSummaries } from "@/components/cabinet/shared";
import { houseHref } from "@/lib/nav";
import { plural } from "@/lib/health";

export function FavoritesPopover({
  children,
  side,
  align,
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const { houses } = useCabinet();
  const summaries = useHouseSummaries(open ? houses : []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} sideOffset={8} className="w-72 rounded-2xl p-2">
        <p className="px-2 pt-1 pb-2 text-sm font-semibold">Мои дома</p>
        {!houses.length ? (
          <p className="px-2 pb-2 text-sm text-muted-foreground">
            Пока пусто. Откройте дом на карте и нажмите «Сохранить дом» — он появится здесь.
          </p>
        ) : !summaries ? (
          <div className="flex flex-col gap-1">
            {houses.map((id) => (
              <Skeleton key={id} className="h-[52px] rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {summaries.map((h) => (
              <li key={h.id}>
                <Link
                  href={houseHref(h.id)}
                  prefetch
                  onClick={() => setOpen(false)}
                  className="flex flex-col rounded-xl p-2 transition-colors duration-150 hover:bg-muted"
                >
                  <span className="truncate text-sm font-medium">{h.address}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[h.district, h.openIssues ? `${h.openIssues} ${plural(h.openIssues, ["открытая проблема", "открытые проблемы", "открытых проблем"])}` : "Открытых проблем нет"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
