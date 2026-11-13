import { NextResponse, type NextRequest } from "next/server";
import { districtDigest } from "@/lib/ai";
import { apiError, serverError } from "@/lib/ai/http";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("district");
    const digest = id && (await districtDigest(id));
    return digest ? NextResponse.json(digest) : apiError(404, "Район не найден");
  } catch (e) {
    return serverError(e);
  }
}
