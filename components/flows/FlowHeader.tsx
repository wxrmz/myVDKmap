import Link from "next/link";
import { X } from "lucide-react";

/** Title row of a flow page with a close button back to the map (or to the house it came from). */
export function FlowHeader({ title, description, backHref = "/" }: { title: string; description?: string; backHref?: string }) {
  return (
    <header className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Link
        href={backHref}
        prefetch
        aria-label="Закрыть"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-muted"
      >
        <X className="size-5" />
      </Link>
    </header>
  );
}
