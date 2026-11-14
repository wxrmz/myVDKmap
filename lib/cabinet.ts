// Cabinet data (§5.8): kept in localStorage (`vdk-cabinet`), synced with `/api/cabinet/data` after login.
// No React here: the API route imports the schema; hooks live in components/cabinet/shared.tsx.
import { z } from "zod";
import { BILL_KINDS, ISSUE_CATEGORIES, ISSUE_KINDS } from "@/lib/types";

const KEY = "vdk-cabinet";
export const CABINET_EVENT = "cabinet:changed";

const id = z.string().min(1).max(200);
const iso = z.string().max(40);

export const METER_KINDS = ["cold", "hot", "power"] as const;
export const FONT_SCALES = [1, 1.125, 1.25] as const;

const IssueEntry = z.object({
  id,
  title: z.string().max(300),
  category: z.enum(ISSUE_CATEGORIES),
  address: z.string().max(300),
  buildingId: id.nullable(),
  createdAt: iso,
});
const BillEntry = z.object({
  id,
  /** Missing on bills saved before receipts were split: those were combined housing receipts. */
  kind: z.enum(BILL_KINDS).optional(),
  period: z.string().max(7).optional(),
  total: z.number(),
  buildingId: id.optional(),
  items: z
    .array(
      z.object({
        name: z.string().max(300),
        plainName: z.string().max(300),
        amount: z.number(),
        explanation: z.string().max(1000).optional(),
        unit: z.string().max(20).optional(),
        volume: z.number().optional(),
        tariff: z.number().optional(),
      }),
    )
    .max(100),
  savedAt: iso,
});
const MeterEntry = z.object({ id, kind: z.enum(METER_KINDS), value: z.number().nonnegative(), date: iso });
const PostEntry = z.object({ id, houseId: id, text: z.string().max(2000), createdAt: iso });
const VoteEntry = z.object({ id, houseId: id, choice: z.enum(["yes", "no", "neutral"]), at: iso });
const Draft = z.object({
  updatedAt: z.number(),
  step: z.number().int().min(0).max(3),
  photo: z.string().max(600_000).optional(),
  text: z.string().max(5000),
  kind: z.enum(ISSUE_KINDS).optional(),
  address: z.string().max(300).optional(),
  buildingId: id.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
const Settings = z.object({
  updatedAt: z.number(),
  fontScale: z.literal(FONT_SCALES),
  notify: z.object({ email: z.boolean(), telegram: z.boolean(), works: z.boolean(), issues: z.boolean() }),
  meterDay: z.number().int().min(1).max(28),
});

const list = <T extends z.ZodType>(item: T) => z.array(item).max(1000).catch([]);
export const CabinetSchema = z.object({
  houses: list(id),
  subscriptions: list(id),
  issues: list(IssueEntry),
  supported: list(id),
  bills: list(BillEntry),
  meters: list(MeterEntry),
  posts: list(PostEntry),
  votes: list(VoteEntry),
  draft: Draft.nullable().catch(null),
  settings: Settings.nullable().catch(null),
});
export type Cabinet = z.infer<typeof CabinetSchema>;
export type MeterKind = (typeof METER_KINDS)[number];
export type CabinetSettings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: CabinetSettings = {
  updatedAt: 0,
  fontScale: 1,
  notify: { email: true, telegram: false, works: true, issues: true },
  meterDay: 20,
};

/** Any stored value → a valid cabinet; broken fields fall back to empty ones. */
export function parseCabinet(v: unknown): Cabinet {
  return CabinetSchema.parse(v && typeof v === "object" && !Array.isArray(v) ? v : {});
}

// --- merge (server ∪ local, nothing lost) ---
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
function byId<T extends { id: string }>(a: T[], b: T[], newer?: (x: T, y: T) => boolean) {
  const out = new Map(a.map((x) => [x.id, x]));
  for (const y of b) {
    const x = out.get(y.id);
    if (!x || (newer && newer(y, x))) out.set(y.id, y);
  }
  return [...out.values()];
}
const newest = <T extends { updatedAt: number }>(a: T | null, b: T | null) => (!a ? b : !b ? a : b.updatedAt > a.updatedAt ? b : a);

/** Lossless union: lists deduplicated by id (server wins ties, a newer vote wins), newest draft and settings. */
export function mergeCabinets(server: Cabinet, local: Cabinet): Cabinet {
  return {
    houses: union(server.houses, local.houses),
    subscriptions: union(server.subscriptions, local.subscriptions),
    issues: byId(server.issues, local.issues),
    supported: union(server.supported, local.supported),
    bills: byId(server.bills, local.bills),
    meters: byId(server.meters, local.meters),
    posts: byId(server.posts, local.posts),
    votes: byId(server.votes, local.votes, (y, x) => y.at > x.at),
    draft: newest(server.draft, local.draft),
    settings: newest(server.settings, local.settings),
  };
}

// --- local store ---
export const rawCabinet = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export function readRaw(raw: string | null): Cabinet {
  try {
    return parseCabinet(JSON.parse(raw ?? "{}"));
  } catch {
    return parseCabinet({});
  }
}
export const getCabinet = () => readRaw(rawCabinet());

let syncing = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** Fired with the HTTP status (0 offline) when the cabinet could not be saved on the server; the local copy is kept. */
export const CABINET_SYNC_FAILED = "cabinet:sync-failed";
const push = (attempt = 0) => {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(
    async () => {
      const res = await fetch("/api/cabinet/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(getCabinet()) }).catch(
        () => null,
      );
      if (res?.ok) return;
      if (res?.status === 401) syncing = false; // the session ended: the next login merges this copy back
      else if (attempt < 2 && (!res || res.status >= 500)) return push(attempt + 1);
      window.dispatchEvent(new CustomEvent(CABINET_SYNC_FAILED, { detail: res?.status ?? 0 }));
    },
    attempt ? attempt * 5000 : 600,
  );
};

function write(c: Cabinet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // storage full or blocked: the change lives in memory until reload only
  }
  window.dispatchEvent(new Event(CABINET_EVENT));
}

export function updateCabinet(fn: (c: Cabinet) => Cabinet) {
  write(fn(getCabinet()));
  if (syncing) push();
}

/** After login: server ∪ local saved on both sides; later changes are pushed until `stopCabinetSync`. */
export async function startCabinetSync() {
  const res = await fetch("/api/cabinet/data");
  if (!res.ok) return;
  const { data } = (await res.json()) as { data: unknown };
  const merged = mergeCabinets(parseCabinet(data), getCabinet());
  syncing = true;
  write(merged);
  push();
}

/** On logout or account deletion: the copy stays on the server, this device forgets it. */
export function stopCabinetSync() {
  syncing = false;
  clearTimeout(pushTimer);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage blocked: nothing stored
  }
  window.dispatchEvent(new Event(CABINET_EVENT));
}

// --- helpers used by the passport and the map ---

/** Returns whether the house is saved after the toggle. */
export function toggleSavedHouse(houseId: string) {
  const saved = !getCabinet().houses.includes(houseId);
  updateCabinet((c) => ({ ...c, houses: saved ? [...c.houses, houseId] : c.houses.filter((h) => h !== houseId) }));
  return saved;
}

export function markSupported(issueId: string) {
  updateCabinet((c) => ({ ...c, supported: union(c.supported, [issueId]) }));
}
