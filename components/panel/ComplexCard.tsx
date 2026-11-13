"use client";

// Complex level (§5.3): status, developer, floors and the list of houses.
import { useMapScene } from "@/components/map/MapContext";
import { complexLabel, districtHref } from "@/lib/nav";
import type { ComplexDetailDTO } from "@/lib/types";
import { ComplexStatusBadge } from "./badges";
import { BuildingLink } from "./BuildingLink";
import { CloseButton } from "./CloseButton";

export function ComplexCard({ complex }: { complex: ComplexDetailDTO }) {
  useMapScene({
    level: "complex",
    districtId: complex.district.id,
    complexId: complex.id,
    buildings: complex.buildings.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng })),
  });
  const facts = [
    complex.developer && ["Застройщик", complex.developer],
    complex.floors && ["Этажность", complex.floors],
    ["Микрорайон", complex.microdistrict.name],
  ].filter((x): x is string[] => Boolean(x));

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      <header className="relative flex flex-col items-start gap-1.5 pr-8">
        <CloseButton href={districtHref(complex.district.id)} label="Закрыть ЖК" />
        <ComplexStatusBadge status={complex.status} />
        <h1 className="text-2xl font-semibold tracking-tight">{complexLabel(complex.name)}</h1>
        {complex.street && <p className="text-muted-foreground">{complex.street}</p>}
      </header>
      <dl className="panel-box grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {complex.note && <p className="text-sm text-muted-foreground">{complex.note}</p>}
      <section className="panel-box flex flex-col gap-1 p-1.5">
        <h2 className="px-3 pt-2 pb-1 font-semibold">Дома</h2>
        {complex.buildings.length ? (
          complex.buildings.map((b) => <BuildingLink key={b.id} {...b} />)
        ) : (
          <p className="px-3 pb-2 text-sm text-muted-foreground">Домов этого ЖК в базе пока нет — найдите дом через поиск.</p>
        )}
      </section>
    </div>
  );
}
