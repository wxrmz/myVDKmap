"use client";

// Over the map, top left (§5.1): search and the «Мой дом» chip.
import Link from "next/link";
import { Heart, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBox } from "@/components/search/SearchBox";
import { Button } from "@/components/ui/button";
import { useMap } from "@/components/map/MapContext";
import { houseHref } from "@/lib/nav";
import { LayersPopover } from "./LayersPopover";
import { useCabinet } from "@/components/cabinet/shared";

const chip =
  "pointer-events-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-sm shadow-sm ring-1 ring-border transition-colors hover:bg-muted";

function Chips() {
  const { scene } = useMap();
  const { houses } = useCabinet();
  const home =
    houses.length > 1 ? "/me" : houses.length === 1 && houses[0] !== scene.buildingId ? houseHref(houses[0]) : null;
  if (!home) return null;
  return (
    <div className="flex flex-wrap gap-2 animate-in fade-in duration-200">
      <Link href={home} prefetch className={chip}>
        <Heart className="size-3.5 fill-coral text-coral" />
        Мой дом
      </Link>
    </div>
  );
}

export function MapControls({ mobile }: { mobile: boolean }) {
  if (!mobile)
    return (
      <div className="pointer-events-none flex w-[384px] flex-col gap-2">
        <SearchBox className="pointer-events-auto" />
        <Chips />
      </div>
    );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex gap-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SearchBox className="pointer-events-auto" />
        <Chips />
      </div>
      <div className="pointer-events-auto flex flex-col gap-2">
        <ThemeToggle className="size-12 shadow-sm" />
        <LayersPopover side="bottom" align="end">
          <Button variant="outline" size="icon" aria-label="Слои" className="size-12 rounded-full shadow-sm [&_svg:not([class*='size-'])]:size-5">
            <Layers />
          </Button>
        </LayersPopover>
      </div>
    </div>
  );
}
