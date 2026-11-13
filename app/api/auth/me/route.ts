import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, endSession, hashPassword, NameSchema, PasswordSchema, publicUser, verifyPassword } from "@/lib/auth";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";

const NOT_SIGNED_IN = "Войдите в кабинет";

const PatchSchema = z.object({
  name: NameSchema.optional(),
  phone: z
    .string()
    .trim()
    .max(30, "Телефон — не длиннее 30 символов")
    .regex(/^[\d\s()+-]*$/, "В телефоне только цифры, пробелы, скобки, + и -")
    .optional(),
  password: z.object({ current: z.string().max(200).optional(), next: PasswordSchema }).optional(),
});

// Guests get `{ user: null }` with 200: not being signed in is a normal state here.
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user: user && publicUser(user) });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, NOT_SIGNED_IN);
    const body = await parseBody(req, PatchSchema);
    if (body instanceof NextResponse) return body;
    let passwordHash: string | undefined;
    if (body.password) {
      if (user.passwordHash && !(await verifyPassword(body.password.current ?? "", user.passwordHash)))
        return apiError(400, "Проверьте данные", [{ path: "password.current", message: "Текущий пароль не подходит" }]);
      passwordHash = await hashPassword(body.password.next);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name, phone: body.phone === undefined ? undefined : body.phone || null, passwordHash },
    });
    return NextResponse.json({ user: publicUser(updated) });
  } catch (e) {
    return serverError(e);
  }
}

/** Deletes the account with its sessions and cabinet data. */
export async function DELETE() {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, NOT_SIGNED_IN);
    await endSession();
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
