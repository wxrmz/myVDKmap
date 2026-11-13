import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/ai/http";
import { houseFromGis } from "@/lib/search";

const OUTSIDE = "Точка за пределами Владивостока";
const Query = z.object({
  gisId: z.string({ error: "Нет id здания" }).regex(/^\d{1,30}$/, "Неверный id здания"),
  lat: z.coerce.number({ error: "Нет широты" }).min(42.9, OUTSIDE).max(43.4, OUTSIDE),
  lng: z.coerce.number({ error: "Нет долготы" }).min(131.7, OUTSIDE).max(132.3, OUTSIDE),
  street: z.string({ error: "Нет улицы" }).trim().min(1, "Нет улицы").max(200, "Название улицы слишком длинное"),
  number: z.string({ error: "Нет номера дома" }).trim().min(1, "Нет номера дома").max(40, "Номер дома слишком длинный"),
});

/** `?gisId&lat&lng&street&number` — the 2GIS building under a click → `{ id }` of its passport, or 404 outside the districts. */
export async function GET(req: NextRequest) {
  try {
    const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!q.success) return apiError(400, "Проверьте данные", q.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const { gisId, ...rest } = q.data;
    const id = await houseFromGis({ id: gisId, ...rest });
    return id ? NextResponse.json({ id }) : apiError(404, "Этот дом за пределами районов города");
  } catch (e) {
    return serverError(e);
  }
}
