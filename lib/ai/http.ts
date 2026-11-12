// API error helpers: every error is `{ error: "<по-русски>", details?: [{ path, message }] }` (§2).
import { NextResponse } from "next/server";
import { z } from "zod";

z.config(z.locales.ru()); // fallback messages for schemas without their own Russian text

const MAX_BODY_BYTES = 8 * 1024 * 1024;

export function apiError(status: number, error: string, details?: { path: string; message: string }[]) {
  return NextResponse.json(details ? { error, details } : { error }, { status });
}

/** Body text, or null once it passes the limit (content-length can be absent or wrong). */
async function readLimited(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Parsed and validated JSON body, or a ready error response (413 / 400). */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | NextResponse> {
  const tooLarge = () => apiError(413, "Слишком большой запрос: не больше 8 МБ");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return tooLarge();
  const text = await readLimited(req);
  if (text === null) return tooLarge();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return apiError(400, "Некорректный JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      400,
      "Проверьте данные",
      parsed.error.issues.map((i) => ({ path: i.path.join(".") || "body", message: i.message })),
    );
  }
  return parsed.data;
}

export function serverError(e: unknown) {
  console.error(e);
  return apiError(500, "Внутренняя ошибка сервера");
}
