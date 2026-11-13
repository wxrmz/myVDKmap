import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tally } from "@/lib/votes";

const VoteInput = z.object({ gone: z.boolean({ error: "Ответьте: проблема ещё есть или уже решена" }) });

/** A signed-in resident's «уже решено» / «ещё есть»; closes or reopens the issue by `tally`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, "Войдите в кабинет, чтобы отметить");
    const body = await parseBody(req, VoteInput);
    if (body instanceof NextResponse) return body;
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const issue = await tx.issue.findUnique({ where: { id }, select: { status: true, statusBeforeVotes: true, authorId: true } });
      if (!issue) return null;
      // Closed officially, not by votes: residents cannot reopen it.
      if (issue.status === "resolved" && issue.statusBeforeVotes === null) return "official" as const;

      await tx.issueVote.upsert({
        where: { issueId_userId: { issueId: id, userId: user.id } },
        create: { issueId: id, userId: user.id, gone: body.gone },
        update: { gone: body.gone },
      });
      const votes = await tx.issueVote.findMany({ where: { issueId: id }, select: { gone: true, userId: true } });
      const t = tally(votes.map((v) => ({ gone: v.gone, author: v.userId === issue.authorId })));

      if (t.closed && issue.status !== "resolved") {
        await tx.issue.update({ where: { id }, data: { status: "resolved", statusBeforeVotes: issue.status } });
      } else if (!t.closed && issue.statusBeforeVotes !== null) {
        await tx.issue.update({ where: { id }, data: { status: issue.statusBeforeVotes, statusBeforeVotes: null } });
      }
      return { ...t, mine: body.gone };
    });

    if (!result) return apiError(404, "Жалоба не найдена");
    if (result === "official") return apiError(409, "Проблема уже решена");
    return NextResponse.json(result);
  } catch (e) {
    return serverError(e);
  }
}
