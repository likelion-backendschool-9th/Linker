# Linker frontend — agent guide

Read `../AGENTS.md` and the relevant sections of `../docs/development/03-frontend-blueprint.md`. The blueprint is the full rulebook: MUST/NEVER are mandatory; RECOMMENDED requires judgment. It is not auto-imported; read the sections you need. Look and feel (colors, type, spacing, component styles) is in `../docs/development/04-design-guide.md`; token values are in `apps/web/styles/tokens/`.

## Before implementing a page
1. Blueprint ch. 13: route group, directory, controller/orval tag.
2. `../docs/planning/07-page-todo.md`: same page number, screen contents, scope, sheets.
3. `../docs/planning/04-policy.md`: ch. 2 access, feature limits/states/exceptions, ch. 12 UI copy.
4. `../docs/planning/02-prd.md` ch. 5: feature completion conditions.
5. `../docs/development/02-wbs.md` ch. 4: controller and endpoints.
6. Complete blueprint §1-1 foundation and end-of-D2 check before page work. Add missing shared infrastructure there.
7. Finish with blueprint ch. 14 checklist.

## Structure, data, and rendering
- Next.js 16 App Router, React 19, strict TypeScript. Route groups: `(auth)`, `(public)`, `(member)`, `(developer)`, `(recruiter)`, `(admin)`; role variants of one URL use `_views/`.
- Colocate page-only code in `_components`, `_hooks`, `_lib`, `_views`; shared by two pages → nearest common folder; across role groups → `features/<domain>/`. `components/` contains domain-free UI/layout/overlay only. `_components` units use kebab folders with PascalCase view + `api.ts` + `hook.ts` + module CSS (blueprint §3-1).
- Route files stay kebab-case; other components use PascalCase filenames. Colocate tests as `*.test.tsx`.
- Centralize route access in `lib/auth/route-access.ts`, consumed by `proxy.ts` and group layouts. Backend enforces actual permissions.
- `page.tsx` and `layout.tsx` are Server Components; never add `'use client'`. Keep interactive client boundaries small; split components for blueprint §5-3 reasons only.
- Prefetch server data, then use TanStack Query on client. Client props must be serializable (dates as ISO strings).
- API calls use generated orval hooks/functions in `packages/api`; never hand-edit generated output. No direct `fetch('/api/v1/...')` outside `lib/api/`.
- State: TanStack Query for server data, nuqs for URL tabs/filters/overlays, Zustand for other UI state.
- Next fetch cache is for cookie-less public data only; per-user queries follow blueprint §9-1 `staleTime`.
- Limits and plan values come from `lib/policy.ts`, sourced from Policy; never hard-code them.

## Accessible, mobile-first UI
- Follow WCAG 2.2 AA / KWCAG 2.2 and blueprint ch. 6. Use `PageFrame` for one header/main/main-menu nav, exactly one h1, ordered headings, and “본문 바로가기”; label additional navs.
- Actions use buttons; navigation uses Link. Never `div onClick`. Follow §6-2 semantics (`ul > li > article`, `<time>`, etc.).
- Inputs need visible labels; errors use `aria-invalid` + `aria-describedby`; focus first invalid field after failed submission.
- Icon buttons need sr-only text; toggles use `aria-pressed`; state cannot rely on color alone.
- Contrast ≥ 4.5:1 for text, 3:1 for large text/icons; retain focus-visible rings; targets ≥ 44×44px; provide button alternatives to dragging.
- Honor reduced motion with `MotionConfig reducedMotion="user"`; allow zoom; no hover-only interaction.
- Base layout targets 360px, widening with `@media (min-width: 600px | 1024px)` (tablet, desktop) in CSS Modules (no Tailwind or other utility-class framework). App screens use `max-width: var(--content-max-width)` (1440px, centered) with `var(--page-gutter)`; tablet follows mobile (bottom tab bar on every size). Only admin becomes two-column at 1024px.
- Use `100dvh`, safe-area padding for bottom tabs/input bars, and input fonts ≥ 16px.

## Navigation and overlays
- Open sheets/modals/drawers/photo viewers only via `useOverlay()`, never plain `useState` or Intercepting/Parallel Routes.
- URL uses `overlay` (+ `oid`): push on first open, replace when switching. Close via `history.back()` for our push, otherwise replace away the parameter; never push on close.
- Exit overlays with `closeThen(href)`; top-bar back uses `useAppBack()`.
- Callback/completion screens (login, onboarding, team creation, payments, finished writing) navigate onward with `router.replace`.

## Images, browser, and native bridge
- Use `next/image` with `alt`/`sizes`; `<img>` only for external images inside user markdown (§10-3). Install `sharp` and include it in `onlyBuiltDependencies`.
- Photo alt: `"{repo name} 이미지"`, numbered for multiple photos; avatars beside visible names use `alt=""`. Unknown image sizes use `fill` with a fixed-ratio parent.
- Browser APIs belong in handlers/effects or `typeof window` guards; never unguarded at module scope or during render. Use `safeStorage`, `useIsClient`, `useSyncExternalStore` for browser-dependent rendering.
- Format dates in KST via `@date-fns/tz` and `lib/format/time.ts`; servers run UTC. Use `<RelativeTime>` to avoid hydration mismatches.
- Use `packages/bridge` shared types, `postToNative`, `requestNative`, `NativeBridgeProvider`. JWT never crosses the bridge; native stores only `userId`/`userType`.
- Every screen is web; native handles GitHub login return, push (Android-only MVP), sharing, back, external links.

## Styling (design guide)
- CSS Modules next to the component; read every color, size, space, and radius through `var(--token)` from `styles/tokens/`. Never a raw hex, font size, or radius in a component. Add missing values to the tokens and the guide first.
- Text on tinted surfaces uses `--color-text-subtle-on-tint`; text on dark surfaces uses `--color-text-inverse*`. Accent is never a CTA fill. No shadows except `--shadow-segment-active`.

## Mock data (blueprint §1-2)
- Until Spring is live, run `pnpm dev:mock`. Pages call orval/`apiFetch` as usual; `mocks/` answers. Pages, components and `_lib` never reference mocks, `USE_MOCKS` or `linker_mock_role`.
- One mock file per page in `mocks/pages/pNN-*.ts` with the WBS path; shared rows in `fixtures/`; register new files in `mocks/routes.ts`. Missing field → add it to the mock, not a fallback in the page.
- Log in as a role with the "목업 계정" switcher or `/api/mock/login/<role>`. Response shapes are provisional; verify against OpenAPI once it exists.
- Check mock code stays out of the normal build: `grep -r MOCK_NOT_IMPLEMENTED apps/web/.next` must find nothing.

## Caching (blueprint ch. 9)
- Next fetch cache only for cookie-less public data (legal, tech tags, job categories, contribution graph). Plans include personal trial eligibility: server `no-store`, no shared Next cache. Per-user data uses TanStack Query `staleTime` per §9-1.

## SEO and privacy
- Every page needs a unique title via `buildMetadata()` in `metadata`/`generateMetadata`. Default `noindex`; only blueprint §8-1 pages use `indexable: true`.
- Content previews only for post detail (23), recruit detail (21), developer profile (04); invite (10) and everything else use the root default (Linker + intro + `/og-default.png`).
- Never put private team names, issue titles, or chat text into login-only metadata/OG. Hidden/deleted/blocked content uses defaults.
- Canonical and `og:url` exclude query parameters, including overlay/filter/share parameters.

Blueprint links resolve relative to `docs/development/`; planning documents are in `docs/planning/`.
