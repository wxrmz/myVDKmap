import { NextResponse, type NextRequest } from "next/server";

// Every full page load (new tab, reload, typed or shared URL) starts at the city map.
// In-app navigation fetches RSC payloads, not documents, so it is not affected.
export function middleware(req: NextRequest) {
  if (req.headers.get("sec-fetch-dest") !== "document" || req.headers.has("rsc")) return;
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  // Pages only: not "/", the API, Next internals or files with an extension.
  matcher: ["/((?!api|_next|.*\\.).+)"],
};
