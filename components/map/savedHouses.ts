"use client";

// Local cabinet (`vdk-cabinet` in localStorage): saved houses and supported issues. Other fields are preserved.
import { useSyncExternalStore } from "react";

const KEY = "vdk-cabinet";
const EVENT = "cabinet:changed";

type Cabinet = { houses?: string[]; supported?: string[] } & Record<string, unknown>;

function read(raw: string | null): Cabinet {
  try {
    const v: unknown = JSON.parse(raw ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Cabinet) : {};
  } catch {
    return {};
  }
}

const rawCabinet = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function update(fn: (c: Cabinet) => Cabinet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(fn(read(rawCabinet()))));
  } catch {
    // storage blocked: the change lives until reload only through the event below
  }
  window.dispatchEvent(new Event(EVENT));
}

export const getSavedHouses = () => list(read(rawCabinet()).houses);

/** Returns whether the house is saved after the toggle. */
export function toggleSavedHouse(id: string) {
  const saved = !getSavedHouses().includes(id);
  update((c) => ({ ...c, houses: saved ? [...list(c.houses), id] : list(c.houses).filter((h) => h !== id) }));
  return saved;
}

export function markSupported(issueId: string) {
  update((c) => ({ ...c, supported: [...new Set([...list(c.supported), issueId])] }));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Live cabinet; empty on the server and during hydration. */
export function useCabinet() {
  const raw = useSyncExternalStore(subscribe, rawCabinet, () => null);
  const c = read(raw);
  return { houses: list(c.houses), supported: list(c.supported) };
}
