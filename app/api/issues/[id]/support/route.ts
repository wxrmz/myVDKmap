import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supports } = await prisma.issue.update({ where: { id }, data: { supports: { increment: 1 } }, select: { supports: true } });
    return NextResponse.json({ supports });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return apiError(404, "Жалоба не найдена");
    return serverError(e);
  }
}
