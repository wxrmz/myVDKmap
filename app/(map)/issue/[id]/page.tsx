import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IssuePanel } from "@/components/panel/IssuePanel";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getIssue } from "@/lib/queries";
import { districtAt } from "@/lib/search";
import { tally } from "@/lib/votes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const i = await prisma.issue.findUnique({ where: { id: decodeURIComponent((await params).id) }, select: { title: true } });
  return i ? { title: i.title, description: "Проблема на карте «Мой дом. Владивосток»: что случилось, где и кто за неё отвечает." } : {};
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssue(decodeURIComponent(id));
  if (!issue) notFound();
  const [authority, rows, user] = await Promise.all([
    prisma.authority.findUnique({ where: { id: issue.authorityId }, select: { name: true } }),
    prisma.issueVote.findMany({ where: { issueId: issue.id }, select: { gone: true, userId: true, issue: { select: { authorId: true } } } }),
    currentUser(),
  ]);
  const { gone, still } = tally(rows.map((v) => ({ gone: v.gone, author: v.userId === v.issue.authorId })));
  return (
    <IssuePanel
      key={issue.id}
      issue={issue}
      authority={authority?.name ?? null}
      districtId={districtAt(issue.lat, issue.lng) ?? undefined}
      votes={{ gone, still, mine: rows.find((v) => v.userId === user?.id)?.gone ?? null }}
    />
  );
}
