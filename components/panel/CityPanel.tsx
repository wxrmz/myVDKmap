"use client";

// City level (§5.3): list of districts with open issues.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMap, useMapScene } from "@/components/map/MapContext";
import { plural } from "@/lib/health";
import { districtHref } from "@/lib/nav";

export function CityPanel() {
  useMapScene({ level: "city" });
  const { districts } = useMap();
  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Владивосток</h1>
        <p className="text-muted-foreground">Выберите район, затем ЖК и дом.</p>
      </header>
      <ul className="panel-box flex flex-col p-1.5">
        {districts.map((d) => (
          <li key={d.id}>
            <Link
              href={districtHref(d.id)}
              prefetch
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted"
            >
              <span className="size-3 shrink-0 rounded-full ring-2 ring-card" style={{ background: d.color }} />
              <span className="flex-1 font-medium">{d.name}</span>
              <span className={d.openIssues ? "text-sm text-coral" : "text-sm text-muted-foreground"}>
                {d.openIssues
                  ? `${d.openIssues} ${plural(d.openIssues, ["проблема", "проблемы", "проблем"])}`
                  : "без проблем"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
