import { NextResponse } from "next/server";
import { summarizeDocument } from "@/lib/ai";
import { parseBody, serverError } from "@/lib/ai/http";
import { DocumentInputSchema } from "@/lib/ai/schemas";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "ai", 30, 10);
    if (limited) return limited;
    const body = await parseBody(req, DocumentInputSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json(await summarizeDocument(body.text));
  } catch (e) {
    return serverError(e);
  }
}
