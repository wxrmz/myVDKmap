import { NextResponse } from "next/server";
import { classifyIssue } from "@/lib/ai";
import { parseBody, serverError } from "@/lib/ai/http";
import { ClassifyInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, ClassifyInputSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json(await classifyIssue(body));
  } catch (e) {
    return serverError(e);
  }
}
