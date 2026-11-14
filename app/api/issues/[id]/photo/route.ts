import { prisma } from "@/lib/db";
import { apiError, serverError } from "@/lib/ai/http";

// An uploaded photo is stored as a data URL; pages get this link instead, so the map payload stays small.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.issue.findUnique({ where: { id }, select: { photoUrl: true } });
    const m = /^data:(image\/[\w.+-]+);base64,([\w+/=]*)$/.exec(row?.photoUrl ?? "");
    if (!m) return apiError(404, "Фото не найдено");
    return new Response(Buffer.from(m[2], "base64"), {
      // A photo never changes after the report is sent.
      headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    return serverError(e);
  }
}
