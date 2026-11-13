"use client";

// Over the map, top left (§5.1): search; on phones also theme, saved houses and layers.
import { Heart, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBox } from "@/components/search/SearchBox";
import { Button } from "@/components/ui/button";
import { FavoritesPopover } from "./FavoritesPopover";
import { LayersPopover } from "./LayersPopover";

export function MapControls({ mobile }: { mobile: boolean }) {
  if (!mobile)
    return (
      <div className="pointer-events-none flex w-[384px] flex-col gap-2">
        <SearchBox className="pointer-events-auto" />
      </div>
    );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex gap-2 p-3">
      <SearchBox className="pointer-events-auto min-w-0 flex-1 self-start" />
      <div className="pointer-events-auto flex flex-col gap-2">
        <ThemeToggle className="size-12 shadow-sm" />
        <FavoritesPopover side="bottom" align="end">
          <Button variant="outline" size="icon" aria-label="Мои дома" className="size-12 rounded-full shadow-sm [&_svg:not([class*='size-'])]:size-5">
            <Heart />
          </Button>
        </FavoritesPopover>
        <LayersPopover side="bottom" align="end">
          <Button variant="outline" size="icon" aria-label="Слои" className="size-12 rounded-full shadow-sm [&_svg:not([class*='size-'])]:size-5">
            <Layers />
          </Button>
        </LayersPopover>
      </div>
    </div>
  );
}
