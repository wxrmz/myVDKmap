import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { CabinetSchema } from "@/lib/cabinet";
import { prisma } from "@/lib/db";

const NOT_SIGNED_IN = "Войдите в кабинет";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, NOT_SIGNED_IN);
    const row = await prisma.cabinetData.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ data: row ? JSON.parse(row.json) : null });
  } catch (e) {
    return serverError(e);
  }
}

/** Replaces the stored cabinet: the client sends it already merged (`mergeCabinets`). */
export async function PUT(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, NOT_SIGNED_IN);
    const body = await parseBody(req, CabinetSchema);
    if (body instanceof NextResponse) return body;
    const json = JSON.stringify(body);
    await prisma.cabinetData.upsert({ where: { userId: user.id }, create: { userId: user.id, json }, update: { json } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
