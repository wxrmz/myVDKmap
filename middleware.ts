import { NextResponse, type NextRequest } from "next/server";

// Every full page load (new tab, reload, typed URL) starts at the city map; shared house and issue links (/house/…, /issue/…) still open,
// but reloading them goes home too (the script in app/layout.tsx).
// In-app navigation fetches RSC payloads, not documents, so it is not affected.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    // CSRF: a browser marks a request another site's page sends; such a request never changes data here.
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Запрос с другого сайта отклонён" }, { status: 403 });
    }
    return;
  }
  if (req.headers.get("sec-fetch-dest") !== "document" || req.headers.has("rsc")) return;
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  // The API (cross-site check), and pages: not "/", house passports, issues, Next internals or files with an extension.
  matcher: ["/api/:path*", "/((?!api|_next|house/|issue/|.*\\.).+)"],
};
