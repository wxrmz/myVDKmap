"use client";

// Map state shared by the map, the shell and the pages (§4): data, scene, layers, camera insets.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CityWorkDTO, DistrictWithCountsDTO, IssueDTO, MapComplexDTO } from "@/lib/types";
import { buildShapes, type DistrictGeo, type DistrictShape } from "./shapes";

/** Server-fetched once by `app/(map)/layout.tsx`. `issues` are open ones only. */
export interface MapData {
  districts: DistrictWithCountsDTO[];
  complexes: MapComplexDTO[];
  issues: IssueDTO[];
  works: CityWorkDTO[];
  geo: DistrictGeo;
}

export type MapLevel = "city" | "district" | "complex" | "house";

/** What the camera shows. Pages set it with `useMapScene`. */
export interface MapScene {
  level: MapLevel;
  districtId?: string;
  complexId?: string;
  /** Active house (larger dot, 2GIS building selection). */
  buildingId?: string;
  /** Houses drawn as dots on this scene. */
  buildings?: { id: string; lat: number; lng: number }[];
  /** Camera target for complex/house levels; defaults to the complex point or the active house. */
  focus?: { lat: number; lng: number };
}

export interface MapLayers {
  complexes: boolean;
  issues: boolean;
  works: boolean;
}

/** Camera padding in px: the part of the map covered by the rail, panel or sheet. */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface MapContextValue {
  districts: DistrictWithCountsDTO[];
  complexes: MapComplexDTO[];
  works: CityWorkDTO[];
  /** Open issues; refetched from `/api/issues` on the window event `issues:changed`. */
  issues: IssueDTO[];
  shapes: Record<string, DistrictShape>;
  scene: MapScene;
  setScene: (scene: MapScene) => void;
  layers: MapLayers;
  setLayers: React.Dispatch<React.SetStateAction<MapLayers>>;
  /** Effective insets: viewport defaults overridden by `setInsets`. */
  insets: MapInsets;
  /** Replaces the override; sides left out fall back to the viewport defaults. */
  setInsets: (override: Partial<MapInsets>) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

const RAIL = 88;
const PANEL = 420;
const DESKTOP = 768;

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewportSnapshot = () => `${innerWidth}x${innerHeight}`;

function defaultInsets(viewport: string): MapInsets {
  if (!viewport) return { top: 0, right: 0, bottom: 0, left: 0 };
  const [w, h] = viewport.split("x").map(Number);
  return w >= DESKTOP
    ? { top: 0, right: 0, bottom: 40, left: RAIL + PANEL + 16 }
    : { top: 0, right: 0, bottom: Math.round(h / 2), left: 0 };
}

const isOpen = (i: IssueDTO) => i.status !== "resolved";

export function MapProvider({ data, children }: { data: MapData; children: React.ReactNode }) {
  const [issues, setIssues] = useState(data.issues);
  const [scene, setScene] = useState<MapScene>({ level: "city" });
  const [layers, setLayers] = useState<MapLayers>({ complexes: true, issues: true, works: true });
  const [override, setInsets] = useState<Partial<MapInsets>>({});
  const viewport = useSyncExternalStore(subscribeResize, viewportSnapshot, () => "");

  useEffect(() => {
    const refetch = async () => {
      const res = await fetch("/api/issues");
      if (res.ok) setIssues(((await res.json()) as IssueDTO[]).filter(isOpen));
    };
    window.addEventListener("issues:changed", refetch);
    return () => window.removeEventListener("issues:changed", refetch);
  }, []);

  const shapes = useMemo(() => buildShapes(data.geo, data.complexes, issues), [data.geo, data.complexes, issues]);
  const insets = useMemo(() => ({ ...defaultInsets(viewport), ...override }), [viewport, override]);

  const value = useMemo<MapContextValue>(
    () => ({
      districts: data.districts,
      complexes: data.complexes,
      works: data.works,
      issues,
      shapes,
      scene,
      setScene,
      layers,
      setLayers,
      insets,
      setInsets,
    }),
    [data.districts, data.complexes, data.works, issues, shapes, scene, layers, insets],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap() outside <MapProvider>");
  return ctx;
}

/** Sets the camera scene while the calling page is shown; equal scenes (by value) do not re-trigger flights. */
export function useMapScene(scene: MapScene) {
  const { setScene } = useMap();
  const key = JSON.stringify(scene);
  useEffect(() => setScene(JSON.parse(key) as MapScene), [key, setScene]);
}
