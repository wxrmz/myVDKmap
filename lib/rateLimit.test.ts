// Self-check: npx tsx lib/rateLimit.test.ts
import assert from "node:assert/strict";
import { rateLimit } from "./rateLimit";

const req = (ip?: string) => new Request("http://x/api", { headers: ip ? { "x-real-ip": ip } : {} });
for (let i = 0; i < 3; i++) assert.equal(rateLimit(req("1.1.1.1"), "t", 3, 1), null);
const blocked = rateLimit(req("1.1.1.1"), "t", 3, 1);
assert.equal(blocked?.status, 429);
assert.ok(blocked?.headers.get("Retry-After"));
assert.equal(rateLimit(req("2.2.2.2"), "t", 3, 1), null); // another address has its own count
assert.equal(rateLimit(req("1.1.1.1"), "other", 3, 1), null); // another route too
for (let i = 0; i < 10; i++) assert.equal(rateLimit(req(), "t", 3, 1), null); // no address: not limited
for (let i = 0; i < 10; i++) assert.equal(rateLimit(req("127.0.0.1"), "t", 3, 1), null); // nginx itself, not a visitor
const fwd = (ip: string) => new Request("http://x/api", { headers: { "x-forwarded-for": `${ip}, 127.0.0.1` } });
for (let i = 0; i < 3; i++) assert.equal(rateLimit(fwd("3.3.3.3"), "t", 3, 1), null);
assert.equal(rateLimit(fwd("3.3.3.3"), "t", 3, 1)?.status, 429);
console.log("rateLimit: ok");
