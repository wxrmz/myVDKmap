// Typed fetch for flows and the cabinet: JSON in and out; errors become a Russian toast and `null`.
import { toast } from "sonner";

const OFFLINE = "Не получилось связаться с сервером. Проверьте интернет и попробуйте ещё раз";

type ApiErrorBody = { error?: string; details?: { path: string; message: string }[] };

/** Parsed JSON, or null after showing the error (the API's own text, with its first detail). */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    toast.error(OFFLINE);
    return null;
  }
  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (res.ok && body !== null) return body;
  const detail = body?.details?.[0]?.message;
  toast.error(body?.error ?? "Что-то пошло не так. Попробуйте ещё раз", detail ? { description: detail } : undefined);
  return null;
}

/** A photo as a JPEG data URL at most 1600 px wide or tall: a phone shot shrinks from megabytes to ~300 KB. Images the
 * browser cannot decode (HEIC outside Safari) are kept as they are. */
export async function readPhoto(file: File, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return readAsDataUrl(file);
  }
}

/** A picked file as a data URL. */
export const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
