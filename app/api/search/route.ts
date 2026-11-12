import { NextResponse, type NextRequest } from "next/server";
import { serverError } from "@/lib/ai/http";
import { searchAll } from "@/lib/search";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    return NextResponse.json(q ? await searchAll(q) : []);
  } catch (e) {
    return serverError(e);
  }
}
