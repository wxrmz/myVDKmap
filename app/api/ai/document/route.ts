import { NextResponse } from "next/server";
import { summarizeDocument } from "@/lib/ai";
import { parseBody, serverError } from "@/lib/ai/http";
import { DocumentInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, DocumentInputSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json(await summarizeDocument(body.text));
  } catch (e) {
    return serverError(e);
  }
}
