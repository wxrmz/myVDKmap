// Client session store (§4): who is signed in; loads `/api/auth/me` on first use and starts cabinet sync.
import { useSyncExternalStore } from "react";
import type { PublicUser } from "@/lib/auth";
import { startCabinetSync, stopCabinetSync } from "@/lib/cabinet";

type SessionState = { status: "loading"; user: null } | { status: "guest"; user: null } | { status: "user"; user: PublicUser };

let state: SessionState = { status: "loading", user: null };
let requested = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Signed in (login, register, Госуслуги demo) or profile updated. */
export function setSessionUser(user: PublicUser) {
  const fresh = state.status !== "user" || state.user.id !== user.id;
  set({ status: "user", user });
  if (fresh) startCabinetSync().catch(() => {}); // offline: local data stays, sync on next login
}

export function clearSession() {
  set({ status: "guest", user: null });
  stopCabinetSync();
}

async function load() {
  try {
    const res = await fetch("/api/auth/me");
    const { user } = (await res.json()) as { user: PublicUser | null };
    if (user) setSessionUser(user);
    else set({ status: "guest", user: null });
  } catch {
    set({ status: "guest", user: null });
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!requested) {
    requested = true;
    load();
  }
  return () => listeners.delete(cb);
}

const SERVER: SessionState = { status: "loading", user: null };

export function useSession() {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
