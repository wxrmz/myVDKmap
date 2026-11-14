// Per-IP request limits for routes that cost work or can be abused (sign-in, reports, receipt and text analysis).
import { apiError } from "@/lib/ai/http";

// shortcut: kept in the memory of the one pm2 process; move to the DB or Redis if the app ever runs as several processes.
const hits = new Map<string, { count: number; until: number }>();

const LOOPBACK = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/;

/**
 * The client's address as nginx passes it. Next.js itself fills X-Forwarded-For with its peer, which behind nginx is
 * 127.0.0.1 for everyone: a loopback address means «unknown», not one shared visitor.
 */
function clientIp(req: Request) {
  const ip = (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0])?.trim();
  return ip && !LOOPBACK.test(ip) ? ip : null;
}

/**
 * A 429 answer once `ip` made more than `max` requests to `name` within `minutes`, else null. Without an address nothing
 * is limited: one shared bucket would let a single visitor lock everyone out.
 */
export function rateLimit(req: Request, name: string, max: number, minutes: number) {
  const ip = clientIp(req);
  if (!ip) return null;
  const now = Date.now();
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  const key = `${name}|${ip}`;
  const h = hits.get(key);
  if (!h || h.until <= now) {
    hits.set(key, { count: 1, until: now + minutes * 60_000 });
    return null;
  }
  if (++h.count <= max) return null;
  const res = apiError(429, `Слишком много запросов. Попробуйте через ${Math.ceil((h.until - now) / 60_000)} мин.`);
  res.headers.set("Retry-After", String(Math.ceil((h.until - now) / 1000)));
  return res;
}
