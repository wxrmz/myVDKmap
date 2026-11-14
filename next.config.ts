import type { NextConfig } from "next";

// Browser restrictions for every response. A script CSP is left out: 2GIS loads its own scripts and workers.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    // A resident's photo opened directly runs nothing, whatever is inside (the later rule wins for the same header).
    { source: "/api/issues/:id/photo", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }] },
  ],
};

export default nextConfig;
