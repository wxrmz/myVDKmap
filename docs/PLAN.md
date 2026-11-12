# PLAN

Разделы «§N» — в `START_PROMPT.md`. Статус: ☐ — не начато, ☑ — принято оркестратором.

| # | Задача | Тир | Зависит от | Статус |
|---|---|---|---|---|
| 1 | Каркас | light | — | ☑ |
| 2 | Prisma, типы, сид | careful | 1 | ☐ |
| 3 | Запросы, поиск, навигация, здоровье, API поиска и жалоб | careful | 2 | ☐ |
| 4 | Токены, базовые компоненты, тема, заставка | medium | 1 | ☐ |
| 5 | Карта 2GIS | heavy | 3, 4 | ☐ |
| 6 | Оболочка, рейл, шторка, контролы, поиск | medium | 5 | ☐ |
| 7 | Панели и паспорт дома | medium | 6 | ☐ |
| 8 | ИИ-слой и `/api/ai/*` | careful | 3 | ☐ |
| 9 | `/report`, `/bill`, `/changes` | medium | 7, 8 | ☐ |
| 10 | Аутентификация и кабинет `/me` | careful | 3, 4 (UI встраивается после 6) | ☐ |
| 11 | README и финальная проверка | light | все | ☐ |

Параллельно: 2 ‖ 4; затем 8 ‖ 5 после 3; 10 после 6 (нужна оболочка для страницы).

## 1. Каркас
Next 15.5 + React 19 + TS strict + Tailwind v4 + tw-animate-css, eslint (flat config `next`), Prisma 6 (пустая схема с datasource sqlite), зависимости из SPEC «Стек», `components.json` для shadcn (компоненты пока не ставить — их ставят задачи по мере нужды). Перенести всё из `inputs/` на те же пути (`inputs/data/x` → `data/x` и т. д.) **без изменений**, удалить `inputs/`. `.env.example`, `.gitignore` (`.env`, `prisma/*.db*`, `.next`, `node_modules`), `.claude/launch.json`, все скрипты `package.json` из §8. Страница-заглушка `app/(map)/page.tsx` допустима только до задачи 6. Проверка: `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; контрольные суммы перенесённых файлов совпадают.

## 2. Prisma, типы, сид
`prisma/schema.prisma` (§3.2), `lib/types.ts` (DTO + справочники §3.2), `lib/db.ts`, `prisma/seed.ts` строго по §3.3 (детерминированный PRNG от соли, point-in-polygon по `public/geo/districts.geojson` через turf). Проверка: `npx prisma db push && npm run seed` дважды даёт одинаковые данные; `fregat-2-1` существует, у него ровно 3 открытые + 1 решённая жалоба; ЖК «Легенда» имеет один дом на адресной точке; ~105 жалоб с горячими точками §3.3; число работ = числу документов фикстуры.

## 3. Запросы, поиск, навигация, здоровье
`lib/queries.ts`, `lib/search.ts` (§6.2–6.4), `lib/utils.ts` (`cn`, `norm`), `lib/nav.ts`, `lib/health.ts` (§6.5), самопроверки `lib/streets.test.ts` и `lib/health.test.ts`, `GET /api/search`, `GET|POST /api/issues`, `POST /api/issues/[id]/support`, хелперы ошибок `lib/ai/http.ts` (`apiError`, `parseBody`, `serverError`, лимит тела 8 МБ). Проверка: тесты через `npx tsx`, запрос из одной буквы ≤ ~30 мс на сервере, `osm-<id>` апсертится (§6.3).

## 4. Токены и базовые компоненты
`app/globals.css` (токены §7, `panel-box`, `.skeleton-shimmer`, анимация `<details>`), шрифт Inter, нужные shadcn-компоненты с настройками §7, `components/providers.tsx` (next-themes, `MotionConfig reducedMotion="user"`, sonner), `ThemeToggle` (морфинг, View Transitions, событие `theme:switch` + `waits` §5.2), `Splash` (§5.10), `PageLoading`. Проверка: build, визуально обе темы.

## 5. Карта 2GIS
`components/map/MapView.tsx`, `MapContext`, `shapes.ts` (`buildShapes`), `MapTip`, кэш стилей через обёртку `fetch`, подсветка наведения, кластеры, маркеры, клики, `map:ready` — всё по §5.2. Проверка: в браузере без ошибок консоли, плавное наведение, смена темы мгновенная.

## 6. Оболочка
`app/(map)/layout.tsx` (`force-dynamic`), `MapShell`, `Rail` (§5.1, `<Link prefetch>`), `PanelSheet` (десктоп-панель 420 px / мобильная шторка 3 положения), `MapControls` (крошки, «Мой дом», слои §5.2), `components/search/SearchBox.tsx` (§5.9). Проверка: 375 px без горизонтального скролла, навигация не перемонтирует карту.

## 7. Панели и паспорт
`CityPanel`, `DistrictPanel`, `ComplexCard`, `BuildingLink`, бейджи, `AiDigest` (вызывает `/api/ai/digest`, до задачи 8 — допустимо скрытое пустое состояние), `HousePassport`, `HealthRing`, `CabinetButtons`, `ShareButton`, `Spotlight` и `?issue=` (§5.3–5.4). Страницы `/`, `/d/...`, `/house/[id]`.

## 8. ИИ-слой
`lib/ai/index.ts`, `mock.ts`, `openai.ts`, `schemas.ts`; `/api/ai/classify|bill|document|digest` (§6.1); самопроверка `lib/ai/mock.test.ts` (классификация примера «яма» → road + администрация; разбор квитанции даёт рост после 2026-10; `summarizeDocument` привязывает дома). Проверка: mock без ключа, openai — один повтор при невалидном ответе, затем mock.

## 9. Потоки
`ReportWizard` (§5.5), `BillAnalyzer` (§5.6), `WorksFeed`, `WorksSearch`, `DocumentParser` (§5.7), `FlowHeader`, `components/flows/api.ts`; страницы `/report`, `/bill`, `/changes`. Событие `issues:changed`.

## 10. Аутентификация и кабинет
`lib/auth.ts` (§5.8), `lib/session.ts`, `lib/cabinet.ts` (`mergeCabinets`), `/api/auth/*`, `/api/cabinet/*`, `components/cabinet/*`, страница `/me`; самопроверки `lib/auth.test.ts`, `lib/cabinet.test.ts`.

## 11. Финал
README по-русски (§8). Проверка §11 целиком: с нуля `npm install && npx prisma db push && npm run seed && npm run preview`, tsc, lint, все тесты, демо-сценарий §9 в браузере.
