// Server auth (§5.8): scrypt passwords, random session token in an httpOnly cookie, only its SHA-256 in the DB.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
export const SESSION_COOKIE = "vdk_session";
const SESSION_DAYS = 30;

// --- validation ---
const email = z.string({ error: "Укажите почту" }).trim().toLowerCase().pipe(z.email("Проверьте адрес почты").max(200, "Слишком длинная почта"));
export const PasswordSchema = z
  .string({ error: "Укажите пароль" })
  .min(8, "Пароль — не короче 8 символов")
  .max(200, "Пароль — не длиннее 200 символов");
export const NameSchema = z.string({ error: "Укажите имя" }).trim().min(1, "Укажите имя").max(80, "Имя — не длиннее 80 символов");

export const RegisterSchema = z.object({ email, password: PasswordSchema, name: NameSchema });
export const LoginSchema = z.object({ email, password: z.string({ error: "Укажите пароль" }).min(1, "Укажите пароль").max(200) });

// --- passwords ---
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  return timingSafeEqual(expected, await scryptAsync(password, salt, KEY_LENGTH));
}

// --- sessions ---
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user, or null (no cookie, unknown or expired session). */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

// --- rate limit: 5 attempts per minute per IP ---
// shortcut: in-memory, per server process; move to the DB or Redis if the app ever runs on several instances.
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** Records an attempt; false once the IP has used up its attempts for the last minute. */
export function allowAttempt(req: Request, now = Date.now()) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(ip, recent);
    return false;
  }
  attempts.set(ip, [...recent, now]);
  return true;
}

/** What the client sees about the user. */
export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  verified: u.verified,
  esia: u.esiaId !== null,
  hasPassword: u.passwordHash !== null,
});
export type PublicUser = ReturnType<typeof publicUser>;
