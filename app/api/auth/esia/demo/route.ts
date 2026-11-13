import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser, publicUser, startSession } from "@/lib/auth";
import { apiError, serverError } from "@/lib/ai/http";
import { prisma } from "@/lib/db";

// Demo of «Войти через Госуслуги»: no real ESIA, only the verified flag and a demo id.
const demoId = () => `demo-${randomBytes(8).toString("hex")}`;

/** Signed in: links the account. Guest: creates a verified demo user and signs in. */
export async function POST() {
  try {
    const user = await currentUser();
    if (user) {
      const linked = await prisma.user.update({ where: { id: user.id }, data: { verified: true, esiaId: user.esiaId ?? demoId() } });
      return NextResponse.json({ user: publicUser(linked) });
    }
    const created = await prisma.user.create({ data: { name: "Житель (демо)", verified: true, esiaId: demoId() } });
    await startSession(created.id);
    return NextResponse.json({ user: publicUser(created) }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE() {
  try {
    const user = await currentUser();
    if (!user) return apiError(401, "Войдите в кабинет");
    if (!user.passwordHash) return apiError(400, "Сначала задайте пароль в настройках, иначе войти будет нечем");
    const unlinked = await prisma.user.update({ where: { id: user.id }, data: { verified: false, esiaId: null } });
    return NextResponse.json({ user: publicUser(unlinked) });
  } catch (e) {
    return serverError(e);
  }
}
