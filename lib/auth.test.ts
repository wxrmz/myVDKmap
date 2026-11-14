// Self-check for lib/auth.ts (§5.8): npx tsx lib/auth.test.ts
import assert from "node:assert/strict";
import { hashPassword, LoginSchema, RegisterSchema, verifyPassword } from "./auth";

async function main() {
  const stored = await hashPassword("секретный-пароль");
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/, "format scrypt$<salt>$<hash>");
  assert.notEqual(await hashPassword("секретный-пароль"), stored, "salt is random");
  assert.equal(await verifyPassword("секретный-пароль", stored), true);
  assert.equal(await verifyPassword("секретный-парол", stored), false, "wrong password");
  assert.equal(await verifyPassword("секретный-пароль", "plain-text"), false, "unknown format");
  assert.equal(await verifyPassword("секретный-пароль", stored.slice(0, -2)), false, "truncated hash");

  assert.equal(RegisterSchema.safeParse({ email: "a@b.ru", password: "1234567", name: "Аня" }).success, false, "password ≥ 8");
  assert.equal(RegisterSchema.safeParse({ email: "not-mail", password: "12345678", name: "Аня" }).success, false, "email");
  assert.equal(RegisterSchema.safeParse({ email: "a@b.ru", password: "12345678", name: "  " }).success, false, "name");
  assert.equal(RegisterSchema.parse({ email: " A@B.ru ", password: "12345678", name: "Аня" }).email, "a@b.ru");
  assert.equal(LoginSchema.safeParse({ email: "a@b.ru", password: "" }).success, false);

  console.log("auth: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
