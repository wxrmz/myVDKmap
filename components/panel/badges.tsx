import { Badge } from "@/components/ui/badge";
import { ISSUE_STATUS_LABELS, type IssueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ISSUE_STATUS_CLASS: Record<IssueStatus, string> = {
  new: "bg-coral/15 text-coral",
  sent: "bg-muted text-foreground",
  in_progress: "bg-work/20 text-foreground",
  resolved: "bg-turquoise/15 text-turquoise",
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <Badge className={ISSUE_STATUS_CLASS[status]}>{ISSUE_STATUS_LABELS[status]}</Badge>;
}

/** Complex status is free text from the seed («сдан (2024)», «строится, есть сданные корпуса»). */
export function ComplexStatusBadge({ status }: { status: string }) {
  const building = status.startsWith("строится");
  return (
    <Badge className={cn(building ? "bg-work/20 text-foreground" : "bg-turquoise/15 text-turquoise")}>{status}</Badge>
  );
}
