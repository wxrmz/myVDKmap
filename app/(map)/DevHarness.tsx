"use client";

// TEMPORARY (task 5): sets the city scene; in dev also shows a control to try scenes, layers and the theme.
// Delete in task 6/7 together with the harness page.
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMap, useMapScene, type MapLayers, type MapScene } from "@/components/map/MapContext";

interface Demo {
  districtId: string;
  complexId: string;
  buildings: { id: string; lat: number; lng: number }[];
}

export function DevHarness({ demo }: { demo: Demo | null }) {
  const [scene, setScene] = useState<MapScene>({ level: "city" });
  useMapScene(scene);
  const { districts, layers, setLayers } = useMap();
  if (!demo) return null;
  const complex = { districtId: demo.districtId, complexId: demo.complexId, buildings: demo.buildings };
  const btn = "rounded-md border border-input bg-card px-2 py-1 hover:bg-accent";
  return (
    <div className="panel-box fixed right-4 bottom-4 z-30 flex w-64 flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Dev: карта (задача 5)</span>
        <ThemeToggle />
      </div>
      <div className="flex flex-wrap gap-1">
        <button className={btn} onClick={() => setScene({ level: "city" })}>
          Город
        </button>
        {districts.map((d) => (
          <button key={d.id} className={btn} onClick={() => setScene({ level: "district", districtId: d.id })}>
            {d.name}
          </button>
        ))}
        <button className={btn} onClick={() => setScene({ level: "complex", ...complex })}>
          ЖК
        </button>
        <button
          className={btn}
          onClick={() => setScene({ level: "house", ...complex, buildingId: demo.buildings[0]?.id })}
        >
          Дом
        </button>
      </div>
      <div className="flex gap-3">
        {(Object.keys(layers) as (keyof MapLayers)[]).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
            {k}
          </label>
        ))}
      </div>
    </div>
  );
}
