import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalises Russian text for comparison: lowercase, ё → е. */
export const norm = (s: string) => s.toLocaleLowerCase("ru").replace(/ё/g, "е");

export const rub = (n: number) => `${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

/** «2026-11» → «Ноябрь 2026». */
export function monthLabel(period: string) {
  const s = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1).toLocaleDateString("ru-RU", { month: "long" });
  return `${s[0].toUpperCase()}${s.slice(1)} ${period.slice(0, 4)}`;
}

/** «YYYY-MM-DD» of a moment in Vladivostok: works start and end by the city's calendar, not the server's or the browser's. */
export const vlDay = (t: number | string | Date) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Vladivostok" });

export const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
