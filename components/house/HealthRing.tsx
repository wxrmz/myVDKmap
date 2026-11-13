import type { HealthDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOR: Record<HealthDTO["level"], string> = { good: "text-turquoise", warn: "text-work", bad: "text-coral" };
const R = 34;
const C = 2 * Math.PI * R;

/** House health 0–100 (§6.5) as a ring with its breakdown. */
export function HealthRing({ health }: { health: HealthDTO }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-20 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - health.score / 100)}
            className={cn(COLOR[health.level], "transition-[stroke-dashoffset] duration-700 ease-out")}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-semibold">{health.score}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{health.label}</span>
        {health.parts.length ? (
          <ul className="flex flex-col text-sm text-muted-foreground">
            {health.parts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">Открытых жалоб нет</span>
        )}
      </div>
    </div>
  );
}
