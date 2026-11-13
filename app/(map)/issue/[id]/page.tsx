import { notFound } from "next/navigation";
import { IssuePanel } from "@/components/panel/IssuePanel";
import { prisma } from "@/lib/db";
import { getIssue } from "@/lib/queries";
import { districtAt } from "@/lib/search";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssue(decodeURIComponent(id));
  if (!issue) notFound();
  const authority = await prisma.authority.findUnique({ where: { id: issue.authorityId }, select: { name: true } });
  return (
    <IssuePanel
      key={issue.id}
      issue={issue}
      authority={authority?.name ?? null}
      districtId={districtAt(issue.lat, issue.lng) ?? undefined}
    />
  );
}
