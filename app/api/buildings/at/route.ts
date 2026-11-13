import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/ai/http";
import { houseAt } from "@/lib/search";

const OUTSIDE = "Точка за пределами Владивостока";
const Query = z.object({
  lat: z.coerce.number({ error: "Нет широты" }).min(42.9, OUTSIDE).max(43.4, OUTSIDE),
  lng: z.coerce.number({ error: "Нет долготы" }).min(131.7, OUTSIDE).max(132.3, OUTSIDE),
  street: z.string({ error: "Нет улицы" }).trim().min(1, "Нет улицы").max(200, "Название улицы слишком длинное"),
  number: z.string({ error: "Нет номера дома" }).trim().min(1, "Нет номера дома").max(40, "Номер дома слишком длинный"),
});

/** `?lat&lng&street&number` — the 2GIS building under a click → `{ id }` of its passport, or 404. */
export async function GET(req: NextRequest) {
  try {
    const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!q.success) return apiError(400, "Проверьте данные", q.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const id = await houseAt(q.data.lat, q.data.lng, q.data.street, q.data.number);
    return id ? NextResponse.json({ id }) : apiError(404, "Этого дома нет в нашей базе");
  } catch (e) {
    return serverError(e);
  }
}
