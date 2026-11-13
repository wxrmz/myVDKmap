import { NextResponse } from "next/server";
import { allowAttempt, LoginSchema, publicUser, startSession, verifyPassword } from "@/lib/auth";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    if (!allowAttempt(req)) return apiError(429, "Слишком много попыток. Подождите минуту");
    const body = await parseBody(req, LoginSchema);
    if (body instanceof NextResponse) return body;
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash)))
      return apiError(401, "Неверная почта или пароль");
    await startSession(user.id);
    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    return serverError(e);
  }
}
