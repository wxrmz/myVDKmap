import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getIssues, toIssueDTO } from "@/lib/queries";
import { safePhoto } from "@/lib/photo";
import { ensureOsmBuilding } from "@/lib/search";
import { ISSUE_CATEGORIES, ISSUE_KINDS } from "@/lib/types";
import { rateLimit } from "@/lib/rateLimit";

const OUTSIDE = "Точка за пределами Владивостока";

const IssueInput = z.object({
  buildingId: z.string().min(1).optional(),
  lat: z.number({ error: "Укажите точку на карте" }).min(42.9, OUTSIDE).max(43.4, OUTSIDE),
  lng: z.number({ error: "Укажите точку на карте" }).min(131.7, OUTSIDE).max(132.3, OUTSIDE),
  kind: z.enum(ISSUE_KINDS, { error: "Выберите тип: авария, обращение или прочее" }).default("appeal"),
  category: z.enum(ISSUE_CATEGORIES, { error: "Выберите категорию из списка" }),
  title: z.string({ error: "Добавьте заголовок" }).trim().min(1, "Добавьте заголовок").max(200, "Заголовок длиннее 200 символов"),
  description: z.string({ error: "Опишите проблему" }).trim().min(1, "Опишите проблему").max(5000, "Описание длиннее 5000 символов"),
  // An uploaded raster photo (checked by its bytes: no SVG or other active content) or the demo photo.
  photoUrl: z
    .string()
    .transform((v, ctx) => {
      const ok = v.startsWith("/demo/") && !v.includes("..") ? v : safePhoto(v);
      if (!ok) ctx.addIssue({ code: "custom", message: "Фото должно быть снимком: JPG, PNG, WebP или HEIC" });
      return ok ?? v;
    })
    .optional(),
  authorityId: z.string({ error: "Укажите, кому направить обращение" }).min(1, "Укажите, кому направить обращение"),
  appealText: z.string({ error: "Добавьте текст обращения" }).trim().min(1, "Добавьте текст обращения").max(10000, "Обращение длиннее 10 000 символов"),
  severity: z.number({ error: "Серьёзность — число от 1 до 3" }).int("Серьёзность — число от 1 до 3").min(1, "Серьёзность — число от 1 до 3").max(3, "Серьёзность — число от 1 до 3"),
});

export async function GET() {
  try {
    return NextResponse.json(await getIssues());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "issue", 20, 60);
    if (limited) return limited;
    const body = await parseBody(req, IssueInput);
    if (body instanceof NextResponse) return body;

    let buildingId: string | null = null;
    if (body.buildingId) {
      buildingId = body.buildingId.startsWith("osm-")
        ? await ensureOsmBuilding(Number(body.buildingId.slice(4)))
        : ((await prisma.building.findUnique({ where: { id: body.buildingId }, select: { id: true } }))?.id ?? null);
      if (!buildingId) return apiError(400, "Проверьте данные", [{ path: "buildingId", message: "Дом не найден" }]);
    }
    if (!(await prisma.authority.findUnique({ where: { id: body.authorityId }, select: { id: true } }))) {
      return apiError(400, "Проверьте данные", [{ path: "authorityId", message: "Такого ответственного нет в справочнике" }]);
    }

    const row = await prisma.issue.create({
      data: { ...body, buildingId, photoUrl: body.photoUrl ?? null, authorId: (await currentUser())?.id ?? null },
      include: { building: { select: { address: true } } },
    });
    const { building, ...issue } = row;
    return NextResponse.json(toIssueDTO(issue, building?.address), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
