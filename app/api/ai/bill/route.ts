import { NextResponse } from "next/server";
import { parseBill } from "@/lib/ai";
import { apiError, parseBody, serverError } from "@/lib/ai/http";
import { BillInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, BillInputSchema);
    if (body instanceof NextResponse) return body;
    const bill = await parseBill(body);
    if (!bill.items.length) {
      return apiError(422, "Не нашли в тексте строк квитанции. Вставьте текст целиком или попробуйте пример квитанции");
    }
    return NextResponse.json(bill);
  } catch (e) {
    return serverError(e);
  }
}
