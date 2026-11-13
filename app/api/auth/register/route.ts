import { NextResponse } from "next/server";
import { allowAttempt, hashPassword, publicUser, RegisterSchema, startSession } from "@/lib/auth";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    if (!allowAttempt(req)) return apiError(429, "Слишком много попыток. Подождите минуту");
    const body = await parseBody(req, RegisterSchema);
    if (body instanceof NextResponse) return body;
    if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } }))
      return apiError(409, "Эта почта уже зарегистрирована. Войдите в кабинет");
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password) },
    });
    await startSession(user.id);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
