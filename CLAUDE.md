# myVDKmap — «Мой дом. Владивосток»

Stack: Next.js 15.5 App Router · React 19 · TS strict · Tailwind v4 · shadcn/ui (radix-ui) · Prisma 6 + SQLite · zod 4 · 2GIS MapGL.

Spec: `START_PROMPT.md` is normative (sections cited as §N); decisions on top of it in `docs/SPEC.md`; task list in `docs/PLAN.md`; file index in `filemap.md`.

## Commands
- Install: `npm install` (runs `prisma generate`)
- DB: `npx prisma db push && npm run seed`
- Dev: `npm run dev` (webpack, no Turbopack) · Prod preview: `npm run preview`
- Types: `npx tsc --noEmit` · Lint: `npm run lint`
- Self-checks: `npx tsx lib/<name>.test.ts` (node:assert, no test framework)

## Rules
- Files in `data/`, `public/geo/`, `public/demo/`, `lib/fixtures/`, `scripts/` are prepared inputs: do not edit them.
- Do not run `npm run setup` casually: it may rewrite `public/geo/*`.
- `.env` holds the real 2GIS key: never print, edit, or commit it; `.env.example` has empty values.
- All UI text in Russian, no officialese; never invent real facts (phones, addresses, laws, real management companies, build years).
- API errors are always `{ error: "<по-русски>", details?: [{ path, message }] }` via `lib/ai/http.ts`.
- Compare Russian text only via `norm()` from `lib/utils.ts`.
- Only colors/tokens from `app/globals.css` (§7); coral = issues, `work` yellow = city works, turquoise = confirmations.
- Add/move a file → update `filemap.md`. No dead code, unused exports, TODOs.
