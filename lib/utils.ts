import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalises Russian text for comparison: lowercase, ё → е. */
export const norm = (s: string) => s.toLocaleLowerCase("ru").replace(/ё/g, "е");
