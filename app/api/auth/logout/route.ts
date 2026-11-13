import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { serverError } from "@/lib/ai/http";

export async function POST() {
  try {
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
