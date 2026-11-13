import { NextResponse, type NextRequest } from "next/server";

// Every full page load (new tab, reload, typed URL) starts at the city map; shared house and issue links (/house/…, /issue/…) still open.
// In-app navigation fetches RSC payloads, not documents, so it is not affected.
export function middleware(req: NextRequest) {
  if (req.headers.get("sec-fetch-dest") !== "document" || req.headers.has("rsc")) return;
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  // Pages only: not "/", house passports, issues, the API, Next internals or files with an extension.
  matcher: ["/((?!api|_next|house/|issue/|.*\\.).+)"],
};
