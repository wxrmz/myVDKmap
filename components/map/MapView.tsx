"use client";

// 2GIS map (§5.2): district polygons with hover overlay, React markers in HtmlMarker portals, camera per scene,
// cached styles for an instant theme switch, `map:ready` for the splash.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, Construction } from "lucide-react";
import type * as MapGL from "@2gis/mapgl/types";
import type { ThemeSwitchDetail } from "@/components/ThemeToggle";
import { complexHref, districtHref, houseHref, issueHref, workHref } from "@/lib/nav";
import type { CityWorkDTO, DistrictWithCountsDTO, IssueDTO, MapComplexDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMap, type MapLayers, type MapLevel, type MapScene } from "./MapContext";
import { MapTip, setTip, TIP_WIDTH, type Tip, type TipTarget } from "./MapTip";
import { clusterByDistance, insideDistrict, type DistrictShape } from "./shapes";

const KEY = process.env.NEXT_PUBLIC_2GIS_KEY ?? "";
const STYLES = { light: "c080bb6a-8134-4993-93a1-5b4d8c36a59b", dark: "e05ac437-fcc2-4845-ad74-b1de9ce07555" };
type Theme = keyof typeof STYLES;
const START_CENTER = [131.93, 43.12];
const START_ZOOM = 10;
const PITCH: Record<MapLevel, number> = { city: 0, district: 35, complex: 55, house: 60 };
const ZOOM = { complex: 16, house: 17 };
const FLY_MS = 1400;
const FIT_MS = 1200;
const EASING = "easeInOutCubic" as const;
const FRAME_PAD = { top: 24, right: 24, bottom: 24, left: 24 };
const CLUSTER_PX = 48;
const DAY = 86_400_000;

// --- style cache: setStyleById downloads the style every time; serve repeats from memory (§5.2) ---
const STYLE_PREFIX = "https://styles.api.2gis.com/styles/";
const styleResponses = new Map<string, Promise<Response>>();
let fetchWrapped = false;

function installStyleCache() {
  if (fetchWrapped) return;
  fetchWrapped = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (!url.startsWith(STYLE_PREFIX) || method !== "GET") return original(input, init);
    let hit = styleResponses.get(url);
    if (!hit) {
      hit = original(input, init).then((res) => {
        if (!res.ok) styleResponses.delete(url);
        return res;
      });
      hit.catch(() => styleResponses.delete(url));
      styleResponses.set(url, hit);
    }
    return hit.then((res) => res.clone());
  };
}

/** Warms the cache for the other theme: every style URL seen so far, with the style id swapped. */
function prefetchStyle(from: string, to: string) {
  for (const url of [...styleResponses.keys()]) {
    if (url.includes(from)) window.fetch(url.replaceAll(from, to)).catch(() => {});
  }
}

let readySent = false;
function announceReady() {
  if (readySent) return;
  readySent = true;
  window.dispatchEvent(new Event("map:ready"));
}

// --- 2GIS building id at a point (Catalog API reverse geocode), cached per point ---
const buildingIds = new Map<string, Promise<string | null>>();
function buildingIdAt(lat: number, lng: number) {
  const key = `${lat},${lng}`;
  let hit = buildingIds.get(key);
  if (!hit) {
    const url = `https://catalog.api.2gis.com/3.0/items/geocode?lat=${lat}&lon=${lng}&type=building&fields=items.point&key=${KEY}`;
    hit = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<{ result?: { items?: { id: string }[] } }>) : null))
      .then((j) => j?.result?.items?.[0]?.id.split("_")[0] ?? null)
      .catch(() => null);
    buildingIds.set(key, hit);
  }
  return hit;
}

const rgba = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

function fly(map: MapGL.Map, center: number[], zoom: number, pitch: number) {
  map.setCenter(center, { duration: FLY_MS, easing: EASING });
  map.setZoom(zoom, { duration: FLY_MS, easing: EASING, useHeightForAnimation: true });
  map.setPitch(pitch, { duration: FLY_MS, easing: EASING });
}

interface Latest {
  districts: DistrictWithCountsDTO[];
  complexes: MapComplexDTO[];
  shapes: Record<string, DistrictShape>;
  theme: Theme;
  /** District in focus (district mode), if any. */
  focus?: string;
  push: (href: string) => void;
}

/** Hover, tip and highlight logic outside React: hover never re-renders the map or its markers. */
function createUi(gl: typeof MapGL, map: MapGL.Map, latest: { current: Latest }) {
  let district: { id: string; x: number; y: number } | null = null;
  let onMarker = false;
  let lit: { id: string; polygons: MapGL.Polygon[] } | null = null;
  let frame = 0;

  const place = (x: number, y: number) => {
    const [w] = map.getSize();
    const half = TIP_WIDTH / 2 + 8;
    return { x: w < half * 2 ? w / 2 : Math.min(Math.max(x, half), w - half), y };
  };
  const centerOf = (el: HTMLElement) => {
    const box = map.getContainer().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return place(r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top);
  };
  const districtTip = (): Tip | null => {
    if (!district) return null;
    const { districts, complexes } = latest.current;
    const d = districts.find((x) => x.id === district?.id);
    if (!d) return null;
    const count = complexes.filter((c) => c.districtId === d.id).length;
    return { target: { kind: "district", district: d, complexes: count }, ...place(district.x, district.y) };
  };
  // The highlight is a separate non-interactive polygon, redrawn at most once per frame.
  const relight = () => {
    frame = 0;
    const id = district?.id ?? null;
    if ((lit?.id ?? null) === id) return;
    lit?.polygons.forEach((p) => p.destroy());
    lit = null;
    const { shapes, districts, theme, focus } = latest.current;
    const shape = id ? shapes[id] : undefined;
    const color = districts.find((d) => d.id === id)?.color;
    if (!id || !shape || !color) return;
    const alpha = focus ? 0.3 : theme === "light" ? 0.24 : 0.23;
    lit = {
      id,
      polygons: shape.parts.map(
        (coordinates) => new gl.Polygon(map, { coordinates, color: rgba(color, alpha), strokeWidth: 0, interactive: false, zIndex: 1 }),
      ),
    };
  };
  const hide = () => {
    onMarker = false;
    setTip(null, true);
  };
  map.on("movestart", hide);
  // The report wizard listens for this to take a point on the map (§5.5).
  const point = (lngLat: number[]) =>
    window.dispatchEvent(new CustomEvent<MapClickDetail>("map:click", { detail: { lng: lngLat[0], lat: lngLat[1] } }));
  map.on("click", (e) => {
    hide();
    point(e.lngLat);
  });

  return {
    district(id: string | null, point?: number[]) {
      district = id && point ? { id, x: point[0], y: point[1] } : null;
      map.getContainer().style.cursor = id ? "pointer" : "";
      frame ||= requestAnimationFrame(relight);
      if (!onMarker) setTip(districtTip());
    },
    marker(target: TipTarget | null, el?: HTMLElement) {
      onMarker = target !== null;
      setTip(target && el ? { target, ...centerOf(el) } : districtTip());
    },
    /** Navigates, or pins the tip when there is nowhere to go (an issue without a house). */
    open(href: string | null, target: TipTarget, el: HTMLElement) {
      if (picking()) return;
      if (href) latest.current.push(href);
      else setTip({ target, ...centerOf(el), pinned: true });
    },
    /** District polygons swallow the map click: they forward the point while a point is being picked. */
    point,
    go(href: string) {
      if (picking()) return;
      latest.current.push(href);
    },
    /** Redraws the highlight with the current theme and mode. */
    restyle() {
      lit?.polygons.forEach((p) => p.destroy());
      lit = null;
      frame ||= requestAnimationFrame(relight);
    },
    destroy() {
      cancelAnimationFrame(frame);
      lit?.polygons.forEach((p) => p.destroy());
      hide();
    },
  };
}

/** The report wizard is taking a point (§5.5): map clicks must not navigate away. */
const picking = () => document.documentElement.dataset.mapPick !== undefined;

export interface MapClickDetail {
  lat: number;
  lng: number;
}

type Ui = ReturnType<typeof createUi>;
interface Api {
  gl: typeof MapGL;
  map: MapGL.Map;
  ui: Ui;
}

export function MapView({ className }: { className?: string }) {
  const { districts, complexes, works, issues, shapes, scene, layers, insets } = useMap();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  const focus = scene.level === "city" ? undefined : scene.districtId;
  // Only the district level paints its district at 0.6; deeper levels keep every district dimmed so houses stay visible.
  const current = scene.level === "district" ? focus : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const styleTheme = useRef<Theme | null>(null);
  const insetsRef = useRef(insets);
  const latest = useRef<Latest>({ districts, complexes, shapes, theme, focus, push: router.push });
  const [api, setApi] = useState<Api | null>(null);

  useEffect(() => {
    latest.current = { districts, complexes, shapes, theme, focus, push: router.push };
    insetsRef.current = insets;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let created: Api | undefined;
    installStyleCache();
    import("@2gis/mapgl")
      .then(({ load }) => load())
      .then((gl) => {
        if (cancelled) return;
        const initial: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        styleTheme.current = initial;
        const map = new gl.Map(el, {
          key: KEY,
          center: START_CENTER,
          zoom: START_ZOOM,
          minZoom: 8,
          maxZoom: 18,
          // 2GIS caps pitch at 45° by default; §5.2 needs 55° for complexes and 60° for houses.
          maxPitch: PITCH.house,
          lowZoomMaxPitch: PITCH.house,
          style: STYLES[initial],
          padding: insetsRef.current,
          controlsLayoutPadding: insetsRef.current,
          lang: "ru",
          enableTrackResize: true,
        });
        map.once("idle", () => {
          announceReady();
          prefetchStyle(STYLES[initial], STYLES[initial === "light" ? "dark" : "light"]);
        });
        created = { gl, map, ui: createUi(gl, map, latest) };
        setApi(created);
      })
      .catch(announceReady); // the splash must not wait for a map that will never load
    return () => {
      cancelled = true;
      created?.ui.destroy();
      created?.map.destroy();
    };
  }, []);

  // Theme: follow next-themes; `theme:switch` lets the toggle wait for the new style before its reveal.
  useEffect(() => {
    if (!api || styleTheme.current === theme) return;
    styleTheme.current = theme;
    api.map.setStyleById(STYLES[theme]).catch(() => {});
  }, [api, theme]);

  useEffect(() => {
    if (!api) return;
    const onSwitch = (e: Event) => {
      const { theme: next, waits } = (e as CustomEvent<ThemeSwitchDetail>).detail;
      if (styleTheme.current === next) return;
      styleTheme.current = next;
      const loaded = new Promise<void>((resolve) => api.map.once("styleload", () => resolve()));
      api.map.setStyleById(STYLES[next]).catch(() => {});
      waits.push(Promise.race([loaded, new Promise((r) => setTimeout(r, 1000))]));
    };
    window.addEventListener("theme:switch", onSwitch);
    return () => window.removeEventListener("theme:switch", onSwitch);
  }, [api]);

  // Districts: rebuilt on theme or focus change only; hover draws a separate overlay (createUi).
  useEffect(() => {
    if (!api) return;
    const { gl, map, ui } = api;
    const light = theme === "light";
    const polygons = districts.flatMap((d) => {
      const shape = shapes[d.id];
      if (!shape) return [];
      const dim = focus !== undefined && current !== d.id;
      const fill = focus === undefined ? (light ? 0.34 : 0.2) : dim ? 0.06 : 0.6;
      return shape.parts.map((coordinates) => {
        const p = new gl.Polygon(map, {
          coordinates,
          color: rgba(d.color, fill),
          strokeColor: rgba(d.color, dim ? 0.3 : 1),
          strokeWidth: light ? 2 : 1,
        });
        p.on("mouseover", (e) => ui.district(d.id, e.point));
        p.on("mousemove", (e) => ui.district(d.id, e.point));
        p.on("mouseout", () => ui.district(null));
        p.on("click", (e) => (picking() ? ui.point(e.lngLat) : ui.go(districtHref(d.id))));
        return p;
      });
    });
    ui.restyle();
    return () => polygons.forEach((p) => p.destroy());
  }, [api, districts, shapes, theme, focus, current]);

  useEffect(() => {
    api?.map.setPadding(insets, { duration: 300 });
    // 2GIS zoom and copyright controls stay clear of the panel, search and sheet.
    api?.map.setControlsLayoutPadding(insets);
  }, [api, insets]);

  // Camera per scene. Data is read through `latest` so new issues do not re-fly the camera.
  useEffect(() => {
    if (!api) return;
    const { map } = api;
    const pitch = PITCH[scene.level];
    if (scene.level === "city") return fly(map, START_CENTER, START_ZOOM, pitch);
    if (scene.level === "district") {
      const shape = scene.districtId ? latest.current.shapes[scene.districtId] : undefined;
      if (!shape) return;
      map.fitBounds(shape.frame, { padding: FRAME_PAD, animation: { duration: FIT_MS, easing: EASING } });
      map.setPitch(pitch, { duration: FIT_MS, easing: EASING });
      return;
    }
    const target =
      scene.focus ??
      (scene.level === "complex"
        ? latest.current.complexes.find((c) => c.id === scene.complexId)
        : scene.buildings?.find((b) => b.id === scene.buildingId));
    if (target) fly(map, [target.lng, target.lat], ZOOM[scene.level], pitch);
  }, [api, scene]);

  // Selected house: 2GIS built-in building selection at its point.
  useEffect(() => {
    if (!api || scene.level !== "house") return;
    const house = scene.buildings?.find((b) => b.id === scene.buildingId) ?? scene.focus;
    if (!house) return;
    let live = true;
    buildingIdAt(house.lat, house.lng).then((id) => {
      if (live && id) api.map.setSelectedObjects([id]);
    });
    return () => {
      live = false;
      api.map.setSelectedObjects([]);
    };
  }, [api, scene]);

  return (
    <div className={cn("fixed inset-0 overflow-hidden", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {api && (
        <Markers
          api={api}
          districts={districts}
          complexes={complexes}
          issues={issues}
          works={works}
          shapes={shapes}
          scene={scene}
          layers={layers}
        />
      )}
      <MapTip />
    </div>
  );
}

/** A React node on the map: an HtmlMarker whose element is a portal target. */
function Marker({
  api,
  at,
  z,
  interactive = true,
  maxZoom,
  children,
}: {
  api: Api;
  at: { lat: number; lng: number };
  z: number;
  interactive?: boolean;
  maxZoom?: number;
  children: React.ReactNode;
}) {
  const [el] = useState(() => document.createElement("div"));
  const { lat, lng } = at;
  useEffect(() => {
    const marker = new api.gl.HtmlMarker(api.map, { coordinates: [lng, lat], html: el, zIndex: z, interactive, maxZoom });
    return () => marker.destroy();
  }, [api, el, lat, lng, z, interactive, maxZoom]);
  return createPortal(<div className="-translate-x-1/2 -translate-y-1/2">{children}</div>, el);
}

function Pin({
  api,
  at,
  z,
  label,
  tip,
  onClick,
  className,
  children,
}: {
  api: Api;
  at: { lat: number; lng: number };
  z: number;
  label: string;
  tip?: TipTarget;
  onClick: (el: HTMLElement) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Marker api={api} at={at} z={z}>
      <button
        type="button"
        aria-label={label}
        className={cn("block cursor-pointer animate-in fade-in zoom-in-50", className)}
        onMouseEnter={tip && ((e) => api.ui.marker(tip, e.currentTarget))}
        onMouseLeave={tip && (() => api.ui.marker(null))}
        onClick={(e) => onClick(e.currentTarget)}
      >
        {children}
      </button>
    </Marker>
  );
}

const mean = (items: { lat: number; lng: number }[]) => ({
  lat: items.reduce((s, i) => s + i.lat, 0) / items.length,
  lng: items.reduce((s, i) => s + i.lng, 0) / items.length,
});

const Markers = memo(function Markers({
  api,
  districts,
  complexes,
  issues,
  works,
  shapes,
  scene,
  layers,
}: {
  api: Api;
  districts: DistrictWithCountsDTO[];
  complexes: MapComplexDTO[];
  issues: IssueDTO[];
  works: CityWorkDTO[];
  shapes: Record<string, DistrictShape>;
  scene: MapScene;
  layers: MapLayers;
}) {
  // Complexes, issues and works appear only once a district is chosen, and only inside it.
  const focusShape = scene.level !== "city" && scene.districtId ? shapes[scene.districtId] : undefined;
  const districtComplexes = useMemo(
    () => (focusShape ? complexes.filter((c) => c.districtId === scene.districtId) : []),
    [complexes, focusShape, scene.districtId],
  );
  const districtIssues = useMemo(
    () => (focusShape ? issues.filter((i) => insideDistrict(focusShape, i)) : []),
    [issues, focusShape],
  );

  const [clusters, setClusters] = useState<IssueDTO[][]>([]);
  useEffect(() => {
    const update = () => setClusters(clusterByDistance(districtIssues, (i) => api.map.project([i.lng, i.lat]), CLUSTER_PX));
    update();
    api.map.on("moveend", update);
    return () => {
      api.map.off("moveend", update);
    };
  }, [api, districtIssues]);

  const liveWorks = useMemo(() => {
    if (!focusShape) return [];
    const now = Date.now();
    return works.flatMap((w) =>
      w.lat !== null &&
      w.lng !== null &&
      (!w.endDate || now <= Date.parse(w.endDate) + DAY) &&
      insideDistrict(focusShape, { lat: w.lat, lng: w.lng })
        ? [{ ...w, lat: w.lat, lng: w.lng }]
        : [],
    );
  }, [works, focusShape]);

  return (
    <>
      {districts.map((d) => {
        const shape = shapes[d.id];
        if (!shape) return null;
        return (
          <Marker key={`label-${d.id}`} api={api} at={{ lng: shape.label[0], lat: shape.label[1] }} z={0} interactive={false} maxZoom={14}>
            <span className="block text-sm font-semibold whitespace-nowrap text-foreground [text-shadow:0_0_2px_var(--background),0_0_4px_var(--background),0_0_8px_var(--background)]">
              {d.name}
            </span>
          </Marker>
        );
      })}

      {layers.complexes &&
        districtComplexes.map((c) => (
          <Pin
            key={`complex-${c.id}`}
            api={api}
            at={c}
            z={1}
            label={c.name}
            tip={{ kind: "complex", complex: c }}
            onClick={() => api.ui.go(complexHref(c.districtId, c.id))}
            className="grid size-8 place-items-center rounded-full bg-card text-foreground shadow-md ring-1 ring-border"
          >
            <Building2 className="size-4" />
          </Pin>
        ))}

      {layers.works &&
        liveWorks.map((w) => (
          <Pin
            key={`work-${w.id}`}
            api={api}
            at={w}
            z={4}
            label={w.title}
            tip={{ kind: "work", work: w }}
            onClick={() => api.ui.go(workHref(w.id))}
            className="grid size-7 place-items-center rounded-full bg-work text-foreground shadow-md ring-2 ring-card dark:text-background"
          >
            <Construction className="size-4" />
          </Pin>
        ))}

      {layers.issues &&
        clusters.map((group) => {
          const [first] = group;
          if (group.length === 1) {
            const target: TipTarget = { kind: "issue", issue: first };
            return (
              <Pin
                key={`issue-${first.id}`}
                api={api}
                at={first}
                z={3}
                label={first.title}
                tip={target}
                onClick={(el) => api.ui.open(issueHref(first), target, el)}
                className="p-1.5"
              >
                <span className="block size-3 rounded-full bg-coral shadow ring-2 ring-card" />
              </Pin>
            );
          }
          const center = mean(group);
          return (
            <Pin
              key={`cluster-${first.id}-${group.length}`}
              api={api}
              at={center}
              z={3}
              label={`Проблем: ${group.length}`}
              tip={{ kind: "cluster", issues: group }}
              onClick={() => {
                api.map.setCenter([center.lng, center.lat], { duration: FLY_MS, easing: EASING });
                api.map.setZoom(Math.min(api.map.getZoom() + 2, 18), { duration: FLY_MS, easing: EASING, useHeightForAnimation: true });
              }}
              className="grid h-7 min-w-7 place-items-center rounded-full bg-coral px-1.5 text-xs font-semibold text-white shadow-md ring-2 ring-card"
            >
              {group.length}
            </Pin>
          );
        })}

      {scene.buildings?.map((b) => (
        <Pin
          key={`house-${b.id}`}
          api={api}
          at={b}
          z={5}
          label="Дом"
          onClick={() => api.ui.go(houseHref(b.id))}
          className="p-1"
        >
          <span
            className={cn(
              "block rounded-full bg-foreground ring-2 ring-card transition-[width,height]",
              b.id === scene.buildingId ? "size-4" : "size-2.5",
            )}
          />
        </Pin>
      ))}
    </>
  );
});
