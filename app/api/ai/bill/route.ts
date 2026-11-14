import { NextResponse } from "next/server";
import { parseBill } from "@/lib/ai";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { pdfText } from "@/lib/ai/pdf";
import { BillInputSchema } from "@/lib/ai/schemas";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "ai", 30, 10);
    if (limited) return limited;
    const body = await parseBody(req, BillInputSchema);
    if (body instanceof NextResponse) return body;
    // A PDF is read as its own lines and then parsed like pasted text.
    const text = body.pdf ? await pdfText(body.pdf).catch(() => "") : body.text;
    const bill = await parseBill({ ...body, text: text || undefined });
    if (!bill) return apiError(422, "В этом PDF нет текста — похоже, это скан. Скопируйте текст квитанции и вставьте его в поле ниже");
    if (!bill.items.length) {
      return apiError(422, "Не нашли в тексте строк квитанции. Вставьте текст целиком или попробуйте пример квитанции");
    }
    return NextResponse.json(bill);
  } catch (e) {
    return serverError(e);
  }
}
