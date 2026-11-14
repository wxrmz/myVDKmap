import { NextResponse } from "next/server";
import { LoginSchema, publicUser, startSession, verifyPassword } from "@/lib/auth";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "login", 10, 10);
    if (limited) return limited;
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
