import { NextResponse } from "next/server";
import { parseBill } from "@/lib/ai";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { pdfText } from "@/lib/ai/pdf";
import { BillInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, BillInputSchema);
    if (body instanceof NextResponse) return body;
    // A PDF is read here as text (its own lines), so the mock and the model both get what is printed in it.
    const pdf = body.image?.startsWith("data:application/pdf") ? await pdfText(body.image).catch(() => "") : null;
    const bill = await parseBill(pdf === null ? body : { ...body, image: undefined, text: pdf || undefined });
    if (!bill) {
      return apiError(
        422,
        body.image?.startsWith("data:application/pdf")
          ? "В этом PDF нет текста — похоже, это скан. Скопируйте текст квитанции и вставьте его в поле ниже"
          : "Фото квитанции сейчас прочитать не можем: ИИ не подключён. Загрузите PDF или вставьте текст квитанции",
      );
    }
    if (!bill.items.length) {
      return apiError(422, "Не нашли в тексте строк квитанции. Вставьте текст целиком или попробуйте пример квитанции");
    }
    return NextResponse.json(bill);
  } catch (e) {
    return serverError(e);
  }
}
