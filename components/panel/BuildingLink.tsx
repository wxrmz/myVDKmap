import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { plural } from "@/lib/health";
import { houseHref } from "@/lib/nav";

export function BuildingLink({ id, address, floors, openIssues }: { id: string; address: string; floors: number | null; openIssues: number }) {
  return (
    <Link href={houseHref(id)} prefetch className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{address}</span>
        {floors !== null && (
          <span className="text-sm text-muted-foreground">
            {floors} {plural(floors, ["этаж", "этажа", "этажей"])}
          </span>
        )}
      </span>
      {openIssues > 0 && (
        <span className="text-sm text-coral">
          {openIssues} {plural(openIssues, ["проблема", "проблемы", "проблем"])}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
