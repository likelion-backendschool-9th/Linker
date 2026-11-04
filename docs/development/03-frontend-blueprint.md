# Linker Frontend Blueprint

> **What structure and rules do AI (and humans) follow when writing Linker frontend code?**
> Sources of truth: pages and paths → [07 Page TODO](../planning/07-page-todo.md), APIs and controllers → [02 WBS](02-wbs.md), access and numbers → [04 Policy](../planning/04-policy.md). This document turns them into folder, component and code rules; **if it disagrees with a source, the source wins.** Look and feel → [04 Design Guide](04-design-guide.md); token values → `frontend/apps/web/src/styles/tokens/`.
>
> `MUST` / `NEVER` are followed without exception; `RECOMMENDED` needs judgment. Work in 07 page order (00 → 01 → … → 33); no page work before §1-1 is done. For a page: ① ch. 13 row → ② 07 checklist with the same number → ③ finish with ch. 14.
>
> Translation of the Korean `10-프론트엔드-청사진.md`; keep both in sync.

> **Path conventions:** `apps/`, `packages/` and frontend tooling commands are relative to `frontend/`; `src/` is relative to `frontend/apps/web/`. Explicit `frontend/` paths and Compose commands are relative to the repository root. Markdown links are relative to this document.

## 0. At a glance
| Item | Decision |
| --- | --- |
| Structure | pnpm + Turborepo: `apps/web` (Next.js), `apps/mobile` (Expo WebView shell), `packages/api` (orval output), `packages/bridge` (web↔app message types) |
| Web | Next.js 16 App Router, React 19, TypeScript strict, Vercel (icn1) |
| App | Expo + react-native-webview. Every screen is web; native handles login return, push, share, back, external links |
| State | Server data = TanStack Query (orval hooks) · URL state (tabs, filters, overlays) = nuqs · other UI = Zustand |
| UI | CSS Modules + CSS tokens · `radix-ui` · Motion (LazyMotion + `m`) · TanStack Virtual · dnd-kit · react-hook-form + zod · date-fns + `@date-fns/tz` |
| Mock data | `pnpm dev:mock`: `apiFetch` answers from `src/mocks/` (one file per page, WBS paths) until Spring is live (§1-2) |
| Realtime · Tests | `@stomp/stompjs` (Spring STOMP) · Vitest + Testing Library + vitest-axe, Playwright + @axe-core/playwright, MSW (orval mocks) |
| A11y · Search | WCAG 2.2 AA, KWCAG 2.2 · metadata + OG on every page; only developer profiles, posts, recruit posts indexed (POL-A-9) |

## 1. Absolute rules
1. `page.tsx` and `layout.tsx` are server components; `'use client'` NEVER in them (ch. 5).
2. Pages live in the role group given by ch. 13. Same URL for several roles → `_views/` (ch. 4).
3. Access decisions live only in `src/lib/auth/route-access.ts`, read by `proxy.ts` and group layouts. Spring does the real permission check.
4. Overlays (sheets, modals, drawers, photo viewer) open only via `useOverlay()`. Never a `useState` sheet (ch. 7).
5. Callback/completion screens move on with `router.replace` (§7-4).
6. Browser APIs only in handlers, `useEffect`, or behind `typeof window` (§11-1).
7. Images use `next/image` with `alt` and `sizes`. `<img>` NEVER, except external images in user markdown (§10-3).
8. Per page: 1 `header`, 1 `main`, 1 main-menu `nav`, exactly one `h1` (ch. 6).
9. Actions are `<button>`, navigation is `<Link>`. `div onClick` NEVER.
10. Numbers (character counts, limits, plan values) come from `src/lib/policy.ts` (values from 04 Policy), never hard-coded.
11. Mobile first: base styles at 360px, widen with `@media (min-width: 600px | 1024px)` (tablet, desktop).
12. APIs only through orval hooks/functions. Direct `fetch('/api/v1/...')` NEVER outside `src/lib/api/`.
13. Styles are CSS Modules reading `var(--token)`. NEVER raw hex, font size, spacing or radius; add new values to tokens + Design Guide first. No CSS-in-JS, no utility-class framework.

### 1-1. Foundation built before pages (the most important work)
Every page depends on this; build it D1–D2 in order. Checkboxes: [07 TODO 00](../planning/07-page-todo.md); owners/dates: [02 WBS ch. 3](02-wbs.md).

- **MUST NOT** build ad-hoc versions in page code (own sheet opening, fetch, permission branching, date formatting). Missing piece → add it to the foundation.
- A stage starts after the previous one finishes; items in a stage may run in parallel.

| Stage | Foundation | Files | Ch. | Owner |
| --- | --- | --- | --- | --- |
| 1 · D1 AM | Monorepo, Next.js, tokens, `radix-ui` | root, `apps/web`, `styles/tokens/*`, `styles/globals.css` | 2 | E |
| 1 · D1 AM | orval + `api-fetch` + shared error handling + Providers | `packages/api`, `lib/api/*`, `app/providers.tsx` | 2-1, 5-4, 9-3 | E |
| 2 · D1 | Role, access table, guards | `lib/auth/route-access.ts`, `session.ts`, `read-role.ts`, `proxy.ts` | 4 | A |
| 2 · D1 | Frames and landmarks | `components/layout/*` (AppShell, EntryShell, AdminShell, PageFrame, TabHeader, StackHeader, BottomTabBar, SkipLink), 6 group layouts | 3-2, 4-6, 6-1 | A |
| 2 · D1 | Overlays and back | `lib/navigation/*` (useOverlay, overlay-keys, nav-depth, useAppBack), `components/overlay/*` | 7 | E |
| 2 · D1 | Policy numbers, formatting, SSR guards | `lib/policy.ts`, `lib/format/*` (KST), `lib/browser/*`, `hooks/useIsClient` | 1, 11-1 | C |
| 2 · D1 | SEO and images | `lib/seo/*`, `app/robots.ts`, `next.config.ts`, `sharp` | 8, 10 | C |
| 3 · D2 | Login-prompt sheet, `useRequireLogin` | `features/auth/*` | 4-5 | A |
| 3 · D2 | Common sheets (report, block, external link, delete confirm, limit, draft restore) | `features/*` | 7-3 | E |
| 3 · D2 | Bridge + Expo shell | `packages/bridge`, `lib/bridge/*`, `apps/mobile` | 11, 12 | B |
| 3 · D2 | STOMP client | `lib/realtime/*` | 11-1 | D |
| 3 · D2 | Test setup | root config, `apps/web/e2e` | 14 | C |

**End-of-D2 check** (page work starts when all pass)
- [ ] Empty `/feed` renders in `PageFrame` with header/main/nav and "본문 바로가기"
- [ ] Guest opening `/workspace` sees the login-prompt sheet over `/feed`; after login returns to `/workspace`
- [ ] Guest opening `/admin` gets 404
- [ ] Open a sheet, close with X, press back → sheet doesn't reopen, previous page shows
- [ ] Android app: open sheet, hardware back → only the sheet closes; twice on the first screen exits
- [ ] One orval hook loads `GET /api/v1/user/me` and shows the member type
- [ ] axe: 0 violations on the empty page

### 1-2. Mock data mode (until the backend APIs are live)
Frontend work is due before Spring is ready (target 2 Nov), so pages are built and checked against mock data. **The page code is the real code**: it calls orval hooks / `apiFetch` exactly as it will with Spring, and the mock layer answers underneath. Nothing in a page, `_lib` or component may know about mocks.
- **On/off**: `pnpm dev:mock` (= `NEXT_PUBLIC_USE_MOCKS=true next dev`). Off by default, and the build drops all mock code when off (`next.config.ts` always defines the flag; check with `grep -r MOCK_NOT_IMPLEMENTED .next`).
- **Where it plugs in**: only `lib/api/api-fetch.ts` (server and browser), `lib/realtime/stomp-client.ts` (no socket; an in-tab bus makes chat work), `features/image-upload/upload-image.ts` (no storage PUT), and `lib/payments/payment-widget.ts` (labelled local payment simulation, no Toss request). Each guards with `process.env.NEXT_PUBLIC_USE_MOCKS === 'true'` written out, never a shared constant, or the bundler keeps the mock chunks.
- **Folder**: `src/mocks/` — one file per page, `pages/pNN-<name>.ts`, exporting `routes: MockRoute[]` with the **same path as WBS**. Shared rows live in `fixtures/` (users, teams, issues, posts, recruits, chat, tech tags); `core/define.ts` has `get/post/put/patch/del`, `fail()`, `paginate()` and time helpers. New page → add its file to `mocks/routes.ts`.
- **Permissions follow the URL prefix** like the real API: `/api/v1/user|recruiter|admin` answer a guest with 401 `LOGIN_REQUIRED` (so the login sheet path is exercised), `/recruiter` and `/admin` 403 other roles, `{ only: 'developer' }` 403 `DEVELOPER_ONLY` for recruiters.
- **Who is logged in**: a plain cookie `linker_mock_role` = `guest | developer | newcomer (onboarding not done) | recruiter | operator`. Use the "목업 계정" switcher bottom-left, or open `/api/mock/login/<role>?returnTo=/path`. `proxy.ts` and `session.ts` read it instead of the JWT, so guards behave as in production. "GitHub로 시작" in mock mode just logs in as a developer.
- **State**: writes (follow, like, comment, issue status/assignee/schedule, apply/accept, chat send, recruit/post create …) change in-memory data, so lists and detail screens follow. Mock payment orders and subscription cancellation/refund records are additionally kept per account in browser session storage so a payment callback or reload can re-confirm the same order. Other server and browser state each keep their own copy: a write made in the browser disappears on a full reload and server renders never see it.
- **Errors you can trigger**: the mocks return the real error codes for the cases in 04 (`PLAN_LIMIT`, `RATE_LIMITED`, `GITHUB_PERMISSION`, `ALREADY_MEMBER`, …). Team 2 is read-only for the mock user, team 1 is Flex and team 2 free, invite codes `demo-expired` / `demo-revoked` / `demo-member` / `demo-full`, recruiter login `jihyun.song@nextlab.example` / `password1234`, email code `123456`. See the header comment of each mock file.
- **Response shapes are provisional.** They follow the endpoint descriptions in WBS, not a real OpenAPI. When the backend publishes `/v3/api-docs`: run `pnpm generate`, switch pages from hand-written types to the orval hooks, fix field-name differences in the page, and either delete that page's mock file or let orval's MSW mocks take over. Keep the mock file until the real API for that page is verified.
- A missing mock answers 404 `MOCK_NOT_IMPLEMENTED` and logs `[mock] no mock for …` in the console. A page that needs a field the mock lacks adds it to the mock (and its fixture), not to the page.
- Tests: `src/mocks/mock-fetch.test.ts` checks the route table (no duplicates, permission prefixes) and the main rules. Component tests keep using MSW in `src/mocks/handlers.ts`.

## 2. Monorepo structure
`apps/web`, `apps/mobile`, `packages/{api,bridge,config}`, `turbo.json`, `pnpm-workspace.yaml`.
- No `packages/ui`; base components live in `apps/web/src/components/ui`.
- `pnpm-workspace.yaml`: `onlyBuiltDependencies: [sharp, esbuild]` (pnpm 10 blocks install scripts).
- If Metro can't resolve modules, set `node-linker=hoisted` in `.npmrc`.
- Local Docker screen development: `docker compose -f compose.yml -f compose.dev.yml up --build --watch` from the repository root runs Next.js in development mode and syncs web/shared-package sources. Nginx forwards the Next.js HMR connection separately from Spring STOMP. The default Compose command still builds and runs the production bundle; see [Docker 가이드](../operations/02-docker.md) for mode switching and dependency/environment changes.

### 2-1. orval (`packages/api`)
- Generated from springdoc `/v3/api-docs`. Preserve each endpoint’s original page `@Tag` at method level when system controllers combine pages (WBS §2 rule 6) → `mode: 'tags-split'`, one file per page (e.g. `generated/p11-issue-list/p11-issue-list.ts`).
- Output: react-query hooks + query options, MSW mocks, zod schemas. Never hand-edited.
- One mutator: `apps/web/src/lib/api/api-fetch.ts` (§5-4). `pnpm --filter @linker/api generate` runs before Turborepo `build`.

## 3. Web app folder structure (colocation)
### 3-1. Principles
- Used by one page → that page's private folders (`_components`, `_hooks`, `_lib`, `_views`; `_` never becomes a URL).
- Used by 2+ pages → nearest common ancestor (e.g. `(developer)/posts/_components/post-editor/`, `teams/[id]/_components/issue-sheets/`).
- Used across role groups → `src/features/<domain>/`.
- `src/components/` = domain-free only (`ui/`, `layout/`, `overlay/`).
- Tests next to the target (`*.test.tsx`); per-screen MSW overrides in `_lib/handlers.ts`.
- kebab-case file names, PascalCase exported component, one exported component per file.

### 3-2. Role groups
| Group | Pages | On entry |
| --- | --- | --- |
| `(auth)` | Before login: start, callbacks, recruiter sign-up/login/reset | Logged in → `/feed` (except callbacks) |
| `(public)` | Anyone reads: feed, posts, recruit posts, profiles, legal, invite | Guest actions → login-prompt sheet |
| `(member)` | Developers + recruiters: chat, notifications, settings, profile edit, subscription/payment | Branch inside with `_views/` |
| `(developer)` | Developers only: onboarding, workspace, teams, issues, writing, stats | Recruiters → `/feed` |
| `(recruiter)` | Recruiters only: sent offers | Developers → `/feed` |
| `(admin)` | Operators only | Non-operators → 404 |

Operators = developer + operator permission: they use `(developer)`, `(member)`, `(public)` like developers, plus `(admin)`.

### 3-3. Tree (`apps/web`)
Page paths per group are in ch. 13. Beyond them:
```
next.config.ts  public/
src/proxy.ts    (with a src/ dir Next 16 requires it next to app/)
src/app/        layout.tsx (<html lang="ko">)  providers.tsx ('use client': QueryClient, NuqsAdapter, LazyMotion, Toaster, NativeBridgeProvider)
                not-found.tsx ("삭제되었거나 볼 수 없는 콘텐츠예요")  error.tsx  global-error.tsx  robots.ts  manifest.ts
  (public)/_components/recruiter-ad-card/          shared by 24 feed and 04 job ad sheet
  (developer)/teams/[id]/layout.tsx                team name, switcher sheet, team menu nav, chat shortcut
  (developer)/teams/[id]/_components/issue-sheets/ made by 12, used by 13–15; _lib/issue-filters.ts (11 → 14, 15)
  (developer)/{recruits,posts}/_components/{recruit,post}-editor/   shared by 20 / 22 create and edit
  (admin)/admin/layout.tsx                         operator check + OTP gate + 30-min idle logout; page.tsx → /admin/reports
src/components/ ui/  layout/  overlay/ (OverlaySheet, OverlayDialog)
src/features/   auth  report  block  plan-limit  share (ShareButton, ShareSheet, ShareTargetPicker, ShareCard)
                chart (Ring, StackedBar, Line, ChartFigure)  external-link  draft-restore (7-day draft)
                tech-tags  job-status  job-categories  image-upload  user  chat-request
src/hooks/      useIsClient, useMediaQuery, useInfiniteScrollTrigger
src/lib/        api/ (api-fetch, api-error, query-client)  auth/ (session, route-access)
                navigation/ (use-overlay, overlay-keys, nav-depth, use-app-back)  bridge/  realtime/
                seo/ (metadata, seo-flags)  format/ (time KST, number "1.2천", text counts)  browser/ (safe-storage)  policy.ts
src/stores/     Zustand (no server data, no overlays)
src/mocks/      core/ (define, viewer)  fixtures/  pages/pNN-*.ts  routes.ts  mock-fetch.ts  mock-realtime.ts — dev data, ch. 1-2
src/features/mock/  MockRoleSwitcher (mock mode only)   public/mock/  placeholder images
src/styles/     globals.css  tokens.css  tokens/{color,typography,layout}.css
```

### 3-4. One page folder
`page.tsx` (server: params, prefetch, `generateMetadata`, landmarks) · `loading.tsx` (same landmarks) · `_lib/get-*.ts` (React `cache()`) · `_views/` (only for per-role screens) · `_components/` (server frames + small client leaves, e.g. `comment-section.tsx` server → `comment-form.tsx` client) · `page.test.tsx`.

## 4. Role separation and access guards
### 4-1. Reading the role
`guest` = no session cookie · `developer` = `userType = DEVELOPER` · `recruiter` = `userType = RECRUITER` · `operator` = developer + `isAdmin = true`.
- `proxy.ts` reads only verified JWT claims (`jose`, backend public key): `typ`, `adm`, `onb`, `st` (ch. 15). No API call per request.
- Group layouts and pages re-check with `getSession()` (`lib/auth/session.ts` → `GET /api/v1/user/me`, React `cache()`). Never trust `proxy.ts` alone. Spring makes the real decision.

### 4-2. `route-access.ts`
A direct copy of 04 Policy ch. 2; when the policy changes, edit only this file. `ROUTE_ACCESS` has one row per ch. 13 path: `{ page, match: RegExp, allow: Role[] | 'all', deny }`, where `deny` is `'login'` (sheet over `/feed` + `returnTo`), `'home'` (`/feed`), `'notFound'` (404), or a per-role map such as `{ guest: 'login', recruiter: 'home' }`. `'onboarding'` is returned before the table.
- Static paths (`/posts/new`) MUST match before dynamic ones (`/posts/[id]`); order rules or test it.
- `onb = false` → `/onboarding` from every URL except `(auth)`, `/legal/*`, `/onboarding`.
- `st = SUSPENDED` is not blocked; show a suspension banner. The API rejects writes with `SUSPENDED`.

### 4-3. `proxy.ts`
Next 16 name for middleware. `readRoleFromCookie(req)` → `resolveAccess(path, viewer)` → on deny:
- `login`: redirect to `/feed?overlay=login&returnTo=<path+search>`
- `home`: redirect to `/feed` · `onboarding`: redirect to `/onboarding`
- `notFound`: rewrite to `/404` with status 404
- Matcher excludes `_next/static`, `_next/image`, favicon, robots, manifest, image files.
- `returnTo` accepts only same-origin paths (starts with `/`, `//` forbidden).
- On allow, `proxy.ts` sets request headers `x-linker-pathname` / `x-linker-search` so group layouts (which get no path prop) can re-check with `enforceAccess()` (`lib/auth/enforce-access.ts`).
- Env: `JWT_PUBLIC_KEY` (PEM, `\n` escapes allowed), `JWT_ALGORITHM` (default `RS256`), `SESSION_COOKIE_NAME` (default `linker_session`; set once the backend names the cookie). No key → every request is a guest.

### 4-4. Same URL, several roles: `_views/`
Don't split the URL; `page.tsx` reads the session and picks a view. If only buttons differ, branch inside one action component instead.

| Page | `_views/` | Picked by |
| --- | --- | --- |
| 04 `/u/[login]` | `developer-profile-view.tsx`, `recruiter-profile-view.tsx`, `recruiter-my-page-view.tsx` | Owner type × is it mine. Viewer role only changes buttons in `profile-actions.tsx` |
| 06 `/settings` | `developer-settings-view.tsx`, `recruiter-settings-view.tsx` | My type (recruiter: no GitHub, Scout only, password change) |
| 05 `/settings/profile` | `developer-profile-form.tsx`, `recruiter-profile-form.tsx` | My type (job categories developer-only) |
| 28, 29 | none | Server returns only that type's plans (Pro·Flex / Scout) |
| 16 `/chats` | none | Tab array per role (recruiters: personal only) |
| 24 `/feed` | none | Only the top toggle ("제안 받는 개발자만") and write button differ by role; ad cards arrive only for logged-in developers, so no role branch: render `RecruiterAdCard` when `item.type === 'AD'` |
| 10 `/invite/[code]` | none | Slim landing (logo + "팀에 합류하기" + "GitHub로 빠르게 시작하기"); guest → GitHub login with `returnTo`, recruiter → "개발자 계정만 팀에 참여할 수 있어요" |

### 4-5. Guest actions: `useRequireLogin()`
Every "login prompt" cell in POL-A-9 uses this hook: for guests it opens the login-prompt sheet and returns `false` (`onClick={() => requireLogin() && like.mutate(...)}`).
- 401 `LOGIN_REQUIRED` opens the same sheet (`MutationCache.onError`).
- 403 `DEVELOPER_ONLY` means a screen-branching bug (the button shouldn't exist): toast + Sentry.

### 4-6. Bottom tabs per role (`components/layout/bottom-tabs.config.ts`)
guest / developer / operator: `home, recruits, workspace, chats` (guest Workspace/Chat entries open the login prompt) · recruiter: `home, chats`. Profile is reached from the header on every screen size; the recruiter's own profile uses the recruiter my-page view. This matches the shared GNB from PR #34.

## 5. Server and client components
### 5-1. Rules
- Server is the parent, client is the leaf. `'use client'` only on the smallest unit needing state, events, browser APIs or realtime.
- Client components can't import server components; pass server content as `children`/props.
- `providers.tsx` is client but receives `children` from the server root layout.
- Server → client props are serializable (no functions/classes; dates as ISO strings).
- `next/dynamic` `ssr: false` only inside client components.

### 5-2. Data flow
Server `page.tsx` prefetches with orval query options into `getQueryClient()` → `<HydrationBoundary state={dehydrate(qc)}>` → client hooks render immediately from cache. nuqs filters parsed on the server with the shared cache parser (`_lib/issue-filters.ts`).
- `generateMetadata` and `page` share data through `_lib/get-*.ts` wrapped in React `cache()`.
- Read-only areas (repo card, terms body) render on the server without prefetch.
- Heavy lower areas go in `<Suspense fallback={<Skeleton/>}>`.

### 5-3. When to split a component
Split only for one of these reasons, written as a one-line comment at the top (`// client boundary: optimistic like`):

| Reason | Example |
| --- | --- |
| Server/client boundary | `comment-section.tsx` → `comment-form.tsx` |
| Own Suspense/error boundary | Profile contribution calendar |
| Own landmark/region | Team menu nav, workspace "내 이슈" |
| Overlay | `issue-status-sheet.tsx` |
| Real reuse (2+ places now) | `TechTagSheet` (02·05·19·20·22) |
| Per-role view | `_views/recruiter-my-page-view.tsx` |

NEVER split only because a file is long (one region of one screen stays one file even at 200 lines), use names like `Wrapper`/`Container`/`Box`/`Item2`, or generalize for "maybe later" (promote per §3-1 when a second user appears). Names say what it does (`IssueAssigneeSheet`, `RecruitDeadlineBadge`). Style-only variants are a `variant` prop mapped to CSS Module classes.

### 5-4. `api-fetch.ts` (orval mutator)
- Works on server and browser; prefixes `url` with the API base (see container note below). Server: forwards the viewer's cookies from `next/headers` (imported only on the server). Browser: `credentials: 'include'`.
- `!res.ok` → `throw ApiError.from(res)` (`{ code, message, detail }`, WBS §1-4). 204 → `undefined`.
- Shared error handling in `query-client.ts`: `LOGIN_REQUIRED` → login sheet · `PLAN_LIMIT` → limit sheet → `/subscribe?reason=` from `detail` · `RATE_LIMITED` → "잠시 후 다시 시도해 주세요" + time left · `SUSPENDED` → banner · `GITHUB_UNAVAILABLE` → GitHub banner.
- Cacheable public data uses separate cookie-less server functions (ch. 9).
- Container execution: server requests use the server-only `API_INTERNAL_URL` when set (Compose: `http://backend:8080`), falling back to `NEXT_PUBLIC_API_BASE_URL`. Compose builds with an empty public origin so browser `/api/v1/*` goes through the same-origin Nginx proxy; `/ws` goes directly to Spring through Nginx; `/api/bff/*` is reserved for Next.js but has no BFF handler yet. Setup: [Docker 가이드](../operations/02-docker.md).

## 6. Accessibility, landmarks, semantic markup
### 6-1. Page skeleton (via `PageFrame`)
Order: skip link "본문 바로가기" (`href="#main"`) → `header` (TabHeader/StackHeader: logo or back, search, notification bell; guests get a "설정" icon that opens the login sheet instead) → `main id="main" tabIndex={-1} aria-labelledby="page-title"` with one `h1` (may be `sr-only`) → `nav aria-label="주 메뉴"` (bottom tabs, after `main` in the DOM).
- Other `nav`s MUST have names ("팀 메뉴", "게시물 탭"). On stack screens the top-bar title may be the `h1`.
- No skipped heading levels; card titles are `h2`/`h3` by position.
- Admin: `header` + `nav aria-label="운영 메뉴"` + `main` + `aside aria-label="신고 상세"` (a sheet on narrow screens).

### 6-2. Choosing elements
| Content | Element |
| --- | --- |
| Feed/list cards | `ul > li > article aria-labelledby`; feed `role="feed"` + `aria-busy` |
| Feed ad card | Same; visible "광고" label before the title, read first via `aria-labelledby` ("광고, ○○회사, 백엔드 개발자 채용"); X `aria-label="광고 닫기"`; button "외부 공고 보기(새 창)"; on close focus the next card |
| Charts (11, 30) | `ChartFigure` = `figure` + visible `figcaption` summary ("12개 중 7개 완료, 58%"); SVG `role="img"` + same `aria-label`, shapes `aria-hidden`; "표로 보기" toggle (`aria-expanded`) shows a `<table>` with `caption`/`th scope`; not color alone (column names/patterns); 3:1 contrast in light and dark; animation off with `prefers-reduced-motion`; per-assignee sorted by name, not ranked |
| Share sheet / room picker | `h2` title, actions are `button`s; picker = `input type="search"` + `ul` of `button`s ("○○ 팀 채팅방에 공유"); after send focus returns + `role="status"` toast |
| Share card in chat | One `<a>` inside the message `article` ("게시물: 레포 이름, 한 줄 소개"); not viewable → text only |
| Time · name–value · photo · radios | `<time dateTime="…+09:00">` · `dl/dt/dd` · `figure/figcaption` · `fieldset` + `legend` |
| Tabs · chat · toast · steps | Radix `Tabs` (value in URL via nuqs) · `role="log"` + `aria-live="polite"`, messages are `article` · `role="status"` (errors `role="alert"`) · `ol` + `aria-current="step"` |
| Calendar | `table` + `th scope="col"`; date cells are `button` with `aria-label="10월 16일, 이슈 2개"` |
| Unread badge | Number in the link name: `aria-label="채팅, 안 읽은 메시지 3개"` |
| Icon-only button | Icon `aria-hidden` + `sr-only` text or `aria-label` |
| Toggles (like, follow) | `aria-pressed` · current page/tab: `aria-current="page"` |

### 6-3. Forms
- Visible `<label>` on every input; placeholder never replaces it.
- Errors: `aria-invalid` + `aria-describedby`; focus the first invalid field on failed submit.
- Character counters: `aria-live="polite"`, announce only at ≥ 90% of the limit.
- Required: `required` + visual marker (not color alone).
- react-hook-form + zod in `_lib/schema.ts`; numbers from `policy.ts`.

### 6-4. Overlays
All overlays are Radix `Dialog` (styled in `components/overlay/`): focus trap, `Esc`, focus return stay on. Every overlay has `DialogTitle` + `DialogDescription`. Confirm modals use `AlertDialog` with default focus on "취소".

### 6-5. Other musts
- Contrast: text 4.5:1, large text/icons 3:1 (measured values in Design Guide ch. 1).
- Never remove `focus-visible` rings. Touch targets ≥ 44×44px. Never block zoom (no `maximumScale`/`userScalable: false`).
- Drag has a button alternative: board "상태 바꾸기", photos "앞으로/뒤로"; dnd-kit `KeyboardSensor` + Korean `announcements`.
- `<MotionConfig reducedMotion="user">`; GIFs play only on tap.
- Infinite lists end with a "더 보기" button; virtualized items get `aria-setsize`/`aria-posinset`.
- Every page needs a unique `title` (Next route announcer reads it).

### 6-6. Mobile first
- Base = 360px (mobile 360–599, tablet from 600, desktop from 1024). App screens use `max-width: var(--content-max-width)` (1440px, centered); side gutter is `var(--page-gutter)`. Bottom tab bar on all sizes; the top bar is shared by mobile and tablet. The admin shell is separate and goes two-column at 1024px.
- `100dvh`; bottom tabs/input bars use `padding-bottom: env(safe-area-inset-bottom)`; `viewportFit: 'cover'`.
- Input font ≥ 16px. No hover-only UI; long-press has a "더보기" button alternative.

## 7. Overlays and back navigation
### 7-1. What causes trapping
Closing by **pushing** a URL without the param (back reopens it, loops) · pushing every overlay switch · pushing on reopen · leaving callback/payment screens in history · closing a URL-entered overlay with `history.back()` (leaves the app).

### 7-2. Rules
1. Overlay state is one URL param `overlay` (+ `oid` for a target id); only one overlay at a time.
2. Push only on first open; if another overlay is open, replace; same overlay → do nothing.
3. Close: if we pushed it on this screen, `history.back()`; otherwise remove the param with `replace`. NEVER push on close.
4. Leaving the page from an overlay: `closeThen(href)` (close, wait for popstate, then navigate).
5. Overlay params are `shallow` and never in canonical/OG URLs.
6. NEVER build modals with Intercepting/Parallel Routes.

### 7-3. `useOverlay()`
```ts
// src/lib/navigation/use-overlay.ts
'use client';
const parsers = { overlay: parseAsStringLiteral(OVERLAY_KEYS), oid: parseAsString };
let pushedByApp = false;
export function useOverlay(key: OverlayKey) {
  const [{ overlay, oid }, set] = useQueryStates(parsers, { shallow: true });
  const isOpen = overlay === key;
  function open(id?: string) {
    if (isOpen && (id ?? null) === oid) return;
    const history = overlay ? 'replace' : 'push';
    if (history === 'push') pushedByApp = true;
    void set({ overlay: key, oid: id ?? null }, { history });
  }
  function close() {
    if (!isOpen) return;
    if (pushedByApp) { pushedByApp = false; window.history.back(); }
    else void set({ overlay: null, oid: null }, { history: 'replace' });
  }
  return { isOpen, id: oid, open, close, onOpenChange: (o: boolean) => (o ? open() : close()) };
}
```
- `OverlayRoot` resets `pushedByApp = false` when `overlay === null` (back from browser, Android or bridge).
- `OverlaySheet`/`OverlayDialog` wire `isOpen`/`onOpenChange` to Radix; feature sheets only supply content (`<OverlaySheet overlay={useOverlay('issue-status')} title="상태 바꾸기">`).

### 7-4. Navigation
| Situation | Method |
| --- | --- |
| Login callback → `returnTo` / `/feed` / `/onboarding`; onboarding done; team-creation callback; payment success/fail; finished writing → detail | `router.replace` |
| Step screens (`?step=`) | Forward push, final completion replace |
| List tabs and filters (nuqs) | replace (default) |
| Access guard redirects | Server redirect (`proxy.ts`, `redirect()`) |

### 7-5. Top-bar back
`useAppBack(fallbackHref)`: `getNavDepth() > 0 ? router.back() : router.replace(fallbackHref)`, so a shared-link visitor never leaves the app. `nav-depth.ts` tracks depth in `sessionStorage` (popstate −1, other path change +1, first entry 0) behind the §11-1 guard.

## 8. SEO and metadata
### 8-1. Search exposure (04 POL-A-9)
| Page | Index | Sitemap |
| --- | --- | --- |
| 01 `/`, 03 `/legal/[slug]`, 24 `/feed`, 19 `/recruits` | Yes | Yes |
| 23 `/posts/[id]` | Yes | Yes (`lastModified`) |
| 21 `/recruits/[id]` | Yes (closed too; 404 if deleted) | Open posts only |
| 04 `/u/[login]` developer | Yes | Yes |
| 04 recruiter, 10 `/invite/[code]`, `(auth)` callback/recruiter screens, all `(member)` `(developer)` `(recruiter)` | `noindex` | No |
| `/admin/*` | `noindex, nofollow` + `X-Robots-Tag` | No |
| Hidden/deleted/suspended/withdrawing/blocked content | `notFound()` → 404 | No |

- Rules live in `INDEXABLE` (`lib/seo/seo-flags.ts`). Root default `noindex`; indexed pages opt in with `buildMetadata({ indexable: true })`.
- `robots.ts`: allow all, `Disallow: /admin`, `/api/` only, plus `Sitemap:`.
- `sitemap.ts`: `generateSitemaps()` per kind (`/sitemap/posts/0.xml`, `/sitemap/recruits/0.xml`, `/sitemap/users/0.xml`; ≤ 50,000 each) from the backend sitemap API, `revalidate: 86400`.
- canonical and `og:url` drop query params (including `?from=share`). Old GitHub-login profile URLs → 308 to the new URL (90-day forwarding, 07 TODO 04).
- OG 1200×630. Posts: cover photo, else `opengraph-image.tsx` repo card. Recruit posts: title, remaining roles, D-n. Developer profiles: avatar, name, stack. Others: `/og-default.png`.

### 8-2. Root metadata (`src/app/layout.tsx`)
- `metadataBase` from `NEXT_PUBLIC_SITE_URL`; title `{ default: 'Linker — 개발자 팀 찾기와 협업', template: '%s | Linker' }`; description '팀을 찾고, GitHub 조직으로 함께 일하고, 완성한 작업물을 보여주는 개발자 소셜 서비스'.
- OG `siteName: 'Linker'`, `locale: 'ko_KR'`, `/og-default.png`; Twitter `summary_large_image`; `robots: { index: false, follow: true }`; `formatDetection` off.
- `viewport`: `device-width`, `initialScale: 1`, `viewportFit: 'cover'`, themeColor light `#ffffff` / dark `#0b0b0f`.

### 8-3. Metadata per page
| Page | Method | title | description | OG image |
| --- | --- | --- | --- | --- |
| 23 `/posts/[id]` | `generateMetadata` | One-line intro | First 120 chars of body | Cover / repo card |
| 21 `/recruits/[id]` | `generateMetadata` | Post title | Remaining spots per role · D-n | `opengraph-image.tsx` |
| 04 developer | `generateMetadata` | "Name (@login) · top 3 stack" | Bio 160 chars, else "완주 N회 · 작업물 N개" | `opengraph-image.tsx` |
| 19, 24 (04 recruiter: all default) | static | "팀 찾기", "홈" | fixed | default |
| 03 | `generateMetadata` + `generateStaticParams` | Document name | Effective date | none |
| 10 | static | "팀 초대" | fixed / default | default |
| Logged-in screens | static title only | "채팅", "이슈" … | default | default |
| Admin | static title | "운영 · 신고 처리" | none | none |

- Content previews only on 23, 21, 04 (developer). Invite (10) uses the root default OG — no team name, intro, or org avatar in metadata. Login-only screens NEVER put team names, issue titles or chat text into title/OG. Hidden/deleted/blocked content uses defaults.
- All metadata goes through `buildMetadata({ title, description, image, path, indexable })` (`lib/seo/metadata.ts`), which strips `overlay`, `oid` and filters from canonical.
- JSON-LD on indexed pages: profile `ProfilePage` + `Person` (`sameAs` GitHub, blog); post `CreativeWork` (`author`, `image`, `datePublished`, `codeRepository`); recruit posts are not jobs, so `CreativeWork`, not `JobPosting`. `<script type="application/ld+json">` rendered in a server component, every `<` in JSON strings replaced with the escape sequence backslash-u003c.
- Indexed pages render their full body on the server without cookies (logged-in-only info is added on the client).

## 9. Caching
### 9-1. Where to cache
| Data | Web |
| --- | --- |
| 03 legal, tech tags, job categories | Next fetch cache 1 day (`revalidate: 86400`), tags `legal` (+ `generateStaticParams`), `tech-tags`, `job-categories` |
| 28 plans (`GET /api/v1/user/plans?reason=`) | Personalized (including trial eligibility): server `cache: 'no-store'`, no shared Next cache; TanStack `staleTime 30s`, query key includes account ID and reason; invalidate after checkout/subscription changes and clear on logout/account switch |
| 04 contribution graph | Server: Next fetch cache 1h, tag `contrib:{login}`; month navigation: TanStack `staleTime 1h` |
| 23 README (on expand), 30 My stats charts (per person, no Next cache) | TanStack `staleTime 1h` |
| 30 stats summary (including Pro access) | TanStack `staleTime 1h`, `refetchOnMount: 'always'`; key under the existing subscription account prefix so checkout/cancel/refund invalidates it. Recheck access before showing or requesting Pro data; server `cache: 'no-store'` |
| 11 Progress | TanStack `staleTime 60s`; invalidate on issue status change (12, 14) |
| 17 AI summaries left, 04/33 offers left today | TanStack; invalidate after use |
| 11 pull-to-refresh | Button disabled for remaining time (`aria-disabled` + seconds) |
| Feed, posts, recruits, chat, notifications | TanStack default `staleTime 30s`; STOMP updates the cache |
| Feed ads | Only inside the feed response; close/hide removes optimistically, undo restores |

### 9-2. Next cache only for cookie-less public data
- Use `server-only` functions in `lib/api/public-cached.ts` with `cache: 'force-cache'` + `next: { revalidate, tags }`. Requests with cookies NEVER go into the Next cache.
- `cacheComponents` (`'use cache'`) is NOT enabled in the MVP.
- After changes to cached public data (e.g. 05 profile edit), invalidate via Route Handler `POST /api/revalidate` (server secret), `revalidateTag(tag, 'max')` on Next 16.

### 9-3. TanStack Query defaults (`lib/api/query-client.ts`)
`staleTime 30_000`, `gcTime 5 * 60_000`, `retry 1`, `refetchOnWindowFocus: true`; `QueryCache`/`MutationCache` `onError: handleApiError`.
- Server `getQueryClient()` is fresh per request (React `cache()`); browser reuses one. Bridge `APP_STATE active` → `focusManager.setFocused(true)`.
- Likes, follows, board moves are optimistic, rolled back on failure.

## 10. Images
### 10-1. Install and config
`pnpm --filter web add sharp` (+ `onlyBuiltDependencies`). `next.config.ts` `images`: formats avif/webp; `remotePatterns` `avatars.githubusercontent.com` and `NEXT_PUBLIC_IMAGE_HOST`; `deviceSizes [360, 414, 600, 1024, 1440]`; `imageSizes [24, 32, 40, 48, 64, 96, 128, 256]`.

### 10-2. Usage
| Image | Rule |
| --- | --- |
| Feed cover | `sizes="(min-width: 1024px) 480px, (min-width: 600px) 50vw, 100vw"`; only the first card `preload` |
| Post gallery | First image `preload`, rest lazy; `fill` + fixed-ratio parent |
| Avatar | Fixed size 24–96; GitHub `?s=` param |
| Chat photo | Thumbnail `sizes="240px"`; large in the viewer |
| GIF | Server-made first-frame still via `Image`; original plays on tap |
| Logo, icons | SVG components (lucide-react), not `Image` |

- `alt`: post photos auto `"{repo name} 이미지"`, numbered for 2+ (`"Linker 이미지 2"`); no input field. Avatars next to a visible name: `alt=""`.
- Unknown sizes: `fill` + fixed-ratio parent.

### 10-3. Exception
External images in issue/README markdown: `react-markdown` `img` → `<img loading="lazy" decoding="async">`, keep `alt`. ESLint exception for that file only.

## 11. Hybrid rules on the web side
### 11-1. SSR guards
| Situation | Method |
| --- | --- |
| Event handlers | Fine as is |
| Once after mount | `useEffect` |
| Render depends on a browser value | `useSyncExternalStore` + `getServerSnapshot`, or `useIsClient()` |
| Utils | `typeof window === 'undefined'` guard |
| Module top level | NEVER |

- `safeStorage` wraps `localStorage` with the guard + try/catch (private mode, webview limits).
- Never branch markup on `typeof window` during render (hydration error).
- Zustand `persist` stores: `skipHydration: true` + `rehydrate()` in `useEffect`.
- `<RelativeTime>` renders an absolute date on the server, relative after mount. Servers run UTC: all dates, "today" and calendars use `TZDate(…, 'Asia/Seoul')` via `lib/format/time.ts`.
- STOMP client: singleton obtained in `useEffect`, never at module top level.

### 11-2. Bridge contract (`packages/bridge/src/messages.ts`)
Web and app share these types and zod schemas. Envelope: `{ v: BRIDGE_VERSION (1), source: 'linker', msg }` as one JSON string.
- **web → app** `WebToNative`: `READY` · `BACK_RESULT { id, handled }` · `EXIT_APP` · `AUTH_GITHUB_START { id, authorizeUrl }` · `AUTH_SESSION_SAVE { session: { userId, userType: 'DEVELOPER' | 'RECRUITER' } }` · `AUTH_SESSION_CLEAR` · `SHARE { id, title, text?, url }` · `PUSH_PERMISSION_REQUEST { id }` · `OPEN_EXTERNAL { url }` · `HAPTIC { style: 'light' | 'success' | 'error' }`
- **app → web** `NativeToWeb`: `BACK_PRESSED { id }` · `RESULT { id, ok: true, payload? }` / `{ id, ok: false, error }` · `PUSH_TOKEN { token, platform: 'ios' | 'android' }` · `DEEP_LINK { path }` (push tap) · `APP_STATE { state: 'active' | 'background' }`
**The JWT never crosses the bridge.** The webview cookie store keeps the session (iOS `sharedCookiesEnabled`); the app stores only `userId`/`userType` in SecureStore (ch. 15).

### 11-3. Web side
- `isInApp()` = `window.ReactNativeWebView` exists. `postToNative(msg)` sends a JSON envelope (returns `false` in a browser). `requestNative(msg)` waits for `RESULT` by `id` (5 s timeout).
- App → web arrives as a `window` `message` event (`injectJavaScript` + `dispatchEvent`); handle only `source === 'linker'` messages that pass zod.
- Share button (posts, recruit posts, profiles) opens Linker's `ShareSheet` ("링크 복사" / "채팅방에 공유") in app and browser. Copy uses `navigator.clipboard`, falling back to bridge `SHARE`. Team invite sharing uses bridge `SHARE`.
- In a browser: invite share → `navigator.share` → copy link; external links → new tab + confirm sheet; push → guidance only.

`NativeBridgeProvider` (in `providers.tsx`):
| Received | Handling |
| --- | --- |
| `BACK_PRESSED` | Overlay open → `close()` + `BACK_RESULT handled: true`; else `handled: false` |
| `DEEP_LINK` | `router.push(path)` for same-origin paths only |
| `PUSH_TOKEN` | `POST /api/v1/user/push-tokens` (18, Android only) |
| `APP_STATE active` | `focusManager.setFocused(true)`, check STOMP reconnection |

- Sends `READY` on mount; `AUTH_SESSION_SAVE`/`CLEAR` on login/logout. **In-app GitHub login**: "GitHub로 시작" → `GET /api/v1/public/auth/github/authorize-url?client=app` → `AUTH_GITHUB_START` → system browser → `linker://auth?code&state` → app opens `/auth/callback?code&state` in the webview → web calls `POST /api/v1/public/auth/github/callback` → `router.replace(returnTo)`. A callback opened in the system browser with `client=app` doesn't exchange the code; it hands off to `linker://auth?…`.

## 12. App (Expo)
### 12-1. Folders (`apps/mobile`)
`app.config.ts` (scheme `linker`, web URL env, push) · `src/app/index.tsx` (single screen `<LinkerWebView />`) · `src/webview/` (`linker-webview.tsx`, `navigation-policy.ts` — only our domain stays in the webview, `use-android-back.ts`) · `src/bridge/` (`dispatcher.ts`, `send-to-web.ts`, `handlers/{auth,share,push,navigation,external,haptic}.ts`) · `src/lib/` (`secure-store.ts`, `config.ts` with `WEB_ORIGIN`).

### 12-2. Handler structure
- `dispatcher.ts`: allowed-origin check → `envelopeSchema.safeParse` → typed handler map keyed by `WebToNative['type']`; unknown messages ignored; a thrown handler replies `RESULT ok: false` when the message has an `id`. `READY` flushes deep links held during cold start.
- `WebView` props: `originWhitelist={[WEB_ORIGIN]}`, `onShouldStartLoadWithRequest={navigationPolicy}` (external → `Linking.openURL`), `sharedCookiesEnabled`, `applicationNameForUserAgent="LinkerApp/1"`, `allowsBackForwardNavigationGestures`, `pullToRefreshEnabled={false}`, reload on `onContentProcessDidTerminate`.

### 12-3. What each handler does
| Message | App |
| --- | --- |
| `AUTH_GITHUB_START` | `WebBrowser.openAuthSessionAsync(url, 'linker://auth')` → webview to `/auth/callback?code&state` → `RESULT`; cancel → `ok: false 'cancelled'` |
| `AUTH_SESSION_SAVE` / `CLEAR` | Save `{ userId, userType }` and resend `PUSH_TOKEN` if granted / clear SecureStore and give the web the token so the server deletes it (`DELETE /push-tokens/{token}`) |
| `SHARE` · `OPEN_EXTERNAL` | `Share.share` → `RESULT` · `Linking.openURL`, `https` only |
| `PUSH_PERMISSION_REQUEST` | `expo-notifications` → `RESULT { status }` + `PUSH_TOKEN`. Android only in MVP |
| Notification tap | Hold `path` until `READY`, then `DEEP_LINK` |
| Hardware back | `BACK_PRESSED` → `handled: false` or no reply in 300 ms → `canGoBack ? goBack() : exit on 2nd press in 2 s` ("한 번 더 누르면 종료돼요") |
| `EXIT_APP` · app state | Android `BackHandler.exitApp()` (ignored on iOS) · `AppState` → `APP_STATE` |

- `canGoBack` comes from `onNavigationStateChange` (includes web pushState). No native screens except a single "다시 시도" screen when the web can't load at all.

## 13. Folder structure double-check
### 13-1. All 33 pages
Matched against 07 paths, 04 access table and WBS system controllers; no new URLs. Access: Guest / Developer / Recruiter / Operator ("prompt" = login-prompt sheet). The controller column is the owning **system** controller; keep method-level OpenAPI tags as the page slug (`pNN-…`).

| # | Path (07) | Group | Access (04) | System controller · tag |
| --- | --- | --- | --- | --- |
| 01 | `/`, `/auth/callback` | (auth) | ○ / →feed / →feed / →feed | AuthController · p01 |
| 02 | `/onboarding` | (developer) | × / ○ / × / ○ | AccountController · p02 |
| 03 | `/legal/[slug]` | (public) | ○ everyone | LegalController · p03 |
| 04 | `/u/[login]` | (public) + `_views` | view / ○ / view + offer, my page / ○ | AccountController, PostController, TeamController, RecruiterAdController (+ Chat as borrowed) · p04 |
| 05 | `/settings/profile` | (member) + `_views` | × / ○ / ○ / ○ | AccountController · p05 |
| 06 | `/settings` | (member) + `_views` | × / ○ / ○ / ○ | AccountController, AuthController, NotificationController · p06 |
| 07 | `/workspace`, `/workspace/issues` | (developer) | prompt / ○ / × / ○ | TeamController, IssueController · p07 |
| 08 | `/teams/new`, `/teams/new/callback` | (developer) | prompt / ○ / × / ○ | TeamController, GithubController · p08 |
| 09 | `/teams/[id]/settings` | (developer) | × / team role / × / ○ ※1 | TeamController, GithubController · p09 |
| 10 | `/invite/[code]` | (public) | slim landing / ○ / × message / ○ | TeamController · p10 |
| 11–15 | `/teams/[id]/issues`, `…/issues/[issueId]`, `…/issues/new`, `…/board`, `…/calendar` | (developer) | × / team member / × / ○ ※1 | IssueController · p11–p15 |
| 16 | `/chats` | (member) | prompt / ○ / personal tab / ○ | ChatController · p16 |
| 17 | `/chats/[roomId]` | (member) | × / ○ / personal only / ○ ※1 | ChatController (+ Github / Issue as borrowed) · p17 |
| 18 | `/notifications` | (member) | prompt / ○ / ○ / ○ | NotificationController, ModerationController · p18 |
| 19 | `/recruits` | (public) | view / ○ / view / ○ | RecruitmentController · p19 |
| 20 | `/recruits/new`, `/recruits/[id]/edit` | (developer) | prompt / ○ / × / ○ | RecruitmentController · p20 |
| 21 | `/recruits/[id]` | (public) | view / ○ / view / ○ | RecruitmentController · p21 |
| 22 | `/posts/new`, `/posts/[id]/edit` | (developer) | prompt / ○ / × / ○ | PostController · p22 |
| 23 | `/posts/[id]` | (public) | view / ○ / view + offer / ○ | PostController · p23 |
| 24 | `/feed` | (public) | view / ○ / view / ○ | PostController, RecruiterAdController · p24 |
| 25–27 | `/admin/reports`, `/admin/users`, `/admin/audit` | (admin) | × / × / × / ○ ※2 | AdminController (+ SubscriptionController for 26 refund) · p25–p27 |
| 28 | `/subscribe`, `/subscribe/success`, `/subscribe/fail` | (member) | prompt / ○ Pro·Flex / ○ Scout / ○ | SubscriptionController · p28 |
| 29 | `/settings/subscription` | (member) | prompt / ○ / ○ Scout / ○ | SubscriptionController · p29 |
| 30 | `/me/stats` | (developer) | prompt / ○ / × / ○ | StatsController · p30 |
| 31 | `/recruiter/signup` | (auth) | ○ / × / →feed / × | AuthController · p31 |
| 32 | `/recruiter/login`, `/recruiter/reset` | (auth) | ○ / × / →feed / × | AuthController · p32 |
| 33 | `/recruiter/offers` | (recruiter) | × / × / ○ / × ※3 | ChatController · p33 |

- ※1 Guest "×" = login-prompt sheet + `returnTo` (04 Policy aligned 2026-10-29); logged-in "×" → `/feed`.
- ※2 The admin OTP gate is inside `(admin)/admin/layout.tsx`, no separate URL.
- ※3 The recruiter my page is `_views/recruiter-my-page-view.tsx` of `/u/[login]`, no new URL.
- Same URL prefix may span groups (`/recruits`, `/posts`, `/recruiter`). 28 and 29 are in `(member)` because recruiters pay for Scout (2026-10-30).

## 14. Page completion checklist (before a PR)
- [ ] Group and URL from ch. 13; a rule exists in `route-access.ts`
- [ ] No `'use client'` in `page.tsx`/`layout.tsx`; client components only at leaves
- [ ] Every split component has a §5-3 reason
- [ ] One `header`, `main`, main-menu `nav`, `h1`; no skipped heading levels
- [ ] Every button and input has an accessible name; icon buttons have `sr-only` text
- [ ] Overlays via `useOverlay`: open → back stays on the page; open → X → back → previous page
- [ ] Completion and callback navigation uses `router.replace`; `metadata`/`generateMetadata` with a unique `title`
- [ ] Images use `next/image` + `alt` + `sizes`
- [ ] No browser API access during render; no hydration warnings in `pnpm build`
- [ ] As a guest: reading works, actions show the login-prompt sheet
- [ ] Checked with recruiter and developer seed accounts (multi-role pages)
- [ ] No horizontal scroll at 360px; everything works by keyboard
- [ ] 0 axe violations (Vitest + vitest-axe, Playwright + axe)
- [ ] Works with `pnpm dev:mock` as each role the page allows; a field the page needs is in the page's mock file (§1-2)
- [ ] Numbers come from `policy.ts`; passes the [04 Design Guide](04-design-guide.md) ch. 8 checklist

## 15. Alignment with backend and other docs
- **JWT claims** (WBS 00 A task): `sub`, `typ` (`DEVELOPER`/`RECRUITER`), `adm`, `onb`, `st` (`ACTIVE`/`SUSPENDED`/`WITHDRAWING`). Asymmetric signature (RS256 etc.); the web holds only the public key. Reissue on onboarding completion, suspension, unsuspension, operator assignment. Cookie `Domain=.<domain>`, `HttpOnly; Secure; SameSite=Lax`.
- **CORS**: `api.` allows `credentials: true` for the `app.` origin; the STOMP handshake uses the same cookie.
- **orval tags**: `@Tag(name = "pNN-…")` per controller; renaming breaks frontend imports.
- **Mock → real switch** (§1-2): response shapes in `src/mocks/` are guesses from WBS. After the first OpenAPI export, compare field names per page before removing its mock file.
- **App login token**: only `AUTH_SESSION_SAVE` (no JWT). If iOS webview cookies disappear in a demo, add app-only recovery-token issue/exchange APIs to `AuthController` (S01, page 01; not in WBS yet).
- **GitHub App callback URLs**: register web `/auth/callback` and app (`?client=app` or a separate URL).
- **Search**: sitemap lists from `SitemapController` (WBS S18, foundation 00) (`GET /api/v1/public/sitemap/{kind}?page=`, B, D10). Guest read limit 60/min per IP has a separate limit for reverse-DNS-verified Googlebot/Yeti.
- **Push tokens**: 18's `POST/DELETE /api/v1/user/push-tokens`.
- **Feed ad items** (WBS 24): `items` = `{ type: 'POST', … } | { type: 'AD', adId, companyName, title, jobCategory, closesOn }`. No URL in the item; tap → `POST /api/v1/user/ads/{adId}/click` returns it; open with the `features/external-link` confirm sheet.
- **Image host**: `NEXT_PUBLIC_IMAGE_HOST` and GIF first-frame generation belong to `UploadController` (WBS S05, foundation 00; resize, EXIF strip).
