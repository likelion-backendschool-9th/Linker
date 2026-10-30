# Linker Frontend Blueprint

> Question this document answers: **What structure and rules do AI (and humans) follow when writing Linker frontend code?**
> Page numbers and paths come from [07 Page TODO](../docs/07-page-todo.md), APIs and controllers from [09 WBS](../docs/09-wbs.md), and per-role access and numbers from [04 Policy](../docs/04-policy.md); those are the sources of truth. This document turns them into **folder, component and code rules**, so if it disagrees with a source, the source wins.
>
> **For AI workers**: `MUST` and `NEVER` in this document are followed without exception. Places that need judgment say `RECOMMENDED`. Work order follows the [07 TODO](../docs/07-page-todo.md) page order (00 → 01 → … → 33). **Before page work, first check that everything in §1-1 "foundation built first" exists.** When you take a page: ① find its group, folder and orval tag in the ch. 13 table, ② read the checklist with the same number in the 07 TODO, ③ finish with the ch. 14 checklist.
>
> Korean UI copy is kept in quotes, with an English gloss where helpful. This is a translation of the Korean `10-프론트엔드-청사진.md`; when the Korean document changes, this copy must be updated too.

## 0. At a glance

| Item | Decision |
| --- | --- |
| Structure | pnpm monorepo + Turborepo. `apps/web` (Next.js) · `apps/mobile` (Expo WebView shell) · `packages/api` (orval output) · `packages/bridge` (web↔app message types) |
| Web | Next.js 16 App Router, React 19, TypeScript strict. Deployed on Vercel (icn1) |
| App | Expo + react-native-webview. Every screen is web; native only handles login return, push, sharing, back navigation, external links |
| State | Server data = TanStack Query (orval hooks) · URL state (tabs, filters, **overlays**) = nuqs · other UI state = Zustand |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) · Motion (LazyMotion + `m`) · TanStack Virtual · dnd-kit · react-hook-form + zod · date-fns (+ `@date-fns/tz`) |
| Realtime | `@stomp/stompjs` (Spring STOMP) |
| Tests | Vitest + Testing Library + vitest-axe · Playwright + @axe-core/playwright · MSW (orval mocks) |
| Accessibility standard | WCAG 2.2 AA, KWCAG 2.2 (Korean Web Content Accessibility Guidelines) |
| Search engines | Metadata and OG on every page; developer profiles, posts and recruit posts are indexed (POL-A-9, changed 2026-10-29). Logged-in screens, recruiter profiles and operations screens are `noindex` |

### User requirements → where they live in this document

| Requirement | Chapter |
| --- | --- |
| Web accessibility, landmarks, semantic markup | Ch. 6 |
| Colocated folder structure, App Router | Ch. 2, 3 |
| Pages split by role (guest, recruiter, developer, operator) | Ch. 3, 4 |
| SEO metadata | Ch. 8 |
| Server components as parents of client components | Ch. 5 |
| Purposeful component splits | §5-3 |
| Mobile first | §6-6 |
| Modals, bottom sheets, drawers never trap back navigation | Ch. 7 |
| Once-a-day policies → Next cache / TanStack Query | Ch. 9 |
| next/image optimization + sharp | Ch. 10 |
| SSR guards, `postMessage` bridge (web) | Ch. 11 |
| RN `onMessage` bridge | Ch. 12 |
| Folder structure double check | Ch. 13 |

---

## 1. Absolute rules (summary)

The list AI checks every time before writing code. Reasons and examples are in each chapter.

1. **`page.tsx` and `layout.tsx` are server components.** `'use client'` is NEVER allowed in these two files. Interaction is handled by small client components pushed down below them (ch. 5).
2. **Pages live inside role groups.** Create new pages only in the group given by the ch. 13 table. If several roles see the same URL, split with `_views/` (ch. 4).
3. **Access decisions live in one place: `src/lib/auth/route-access.ts`.** `proxy.ts` and group `layout.tsx` files read the same table. Real permission checks are done by the Spring API (frontend guards only tidy up the screen).
4. **Overlays (bottom sheets, modals, drawers, photo viewer) are opened only with `useOverlay()`.** Opening adds one history entry; closing undoes that entry. An overlay on top of an overlay replaces the entry. Sheets opened directly with `useState` are NEVER allowed (ch. 7).
5. **From callback and completion screens, move on with `router.replace`.** Login callback, onboarding completion, team-creation callback, payment success/failure, login-guard redirects (§7-4).
6. **Browser APIs only inside event handlers, `useEffect` or a `typeof window` guard.** Never read `window`, `document` or `localStorage` during render (§11-1).
7. **Images use `next/image`.** `<img>` is NEVER allowed (exception: external images inside user-supplied markdown → §10-3). Every `Image` has `alt` and `sizes`.
8. **Landmarks per page: 1 `header` · 1 `main` · 1 bottom `nav`.** Exactly one `h1` per page (ch. 6).
9. **Buttons are `<button>`, navigation is `<Link>`.** `div onClick` is NEVER allowed.
10. **Numbers (character counts, photo counts, limits) are never hard-coded; import them from `src/lib/policy.ts`.** Values come from the 04 Policy.
11. **Mobile by default → widen with `sm:`, `md:`, `lg:`.** Don't write for desktop and override for mobile.
12. **APIs are called only through orval-generated hooks and functions.** Direct `fetch('/api/v1/...')` calls are NEVER allowed (exception: inside `src/lib/api/`).

### 1-1. Foundation built before pages (the most important work)

Every page uses the code below. Adding it later means reworking all 33 pages, so **build it first on D1–D2 in this order.** Checkboxes live in [07 TODO 00 "Frontend"](../docs/07-page-todo.md#00-common-foundation-required--days-12-everyone); owners and dates in [09 WBS ch. 3](../docs/09-wbs.md#3-common-foundation-00-required--d1d2--everyone) are the source.

- **MUST NOT** build ad-hoc versions of this foundation inside page code (own sheet opening, own fetch, own permission branching, own date formatting). If the foundation lacks something, add it to the foundation and use that.
- A stage starts only after the previous stage finishes. Items within one stage may run in parallel.

| Stage | Foundation | Files | Blueprint | Owner (09) |
| --- | --- | --- | --- | --- |
| 1 · D1 morning | Monorepo, Next.js, Tailwind tokens, shadcn install | root, `apps/web`, `styles/globals.css` | Ch. 2 | E |
| 1 · D1 morning | orval generation + API call function + shared failure-code handling + Providers | `packages/api`, `lib/api/*`, `app/providers.tsx` | §2-1, §5-4, §9-3 | E |
| 2 · D1 | Role computation, access table, guards | `lib/auth/route-access.ts`, `session.ts`, `read-role.ts`, `proxy.ts` | Ch. 4 | A |
| 2 · D1 | Screen frames and landmarks | `components/layout/*` (AppShell, EntryShell, AdminShell, PageFrame, TabHeader, StackHeader, BottomTabBar, SkipLink), 6 group `layout.tsx` files | §3-2, §4-6, §6-1 | A |
| 2 · D1 | Overlays and back navigation | `lib/navigation/*` (useOverlay, overlay-keys, nav-depth, useAppBack), `components/overlay/*` | Ch. 7 | E |
| 2 · D1 | Policy numbers, formatting, SSR guards | `lib/policy.ts`, `lib/format/*` (KST), `lib/browser/*`, `hooks/useIsClient` | Ch. 1 rule 10, §11-1 | C |
| 2 · D1 | SEO and image config | `lib/seo/*`, `app/robots.ts`, `next.config.ts` (images), install `sharp` | Ch. 8, 10 | C |
| 3 · D2 | Login-prompt sheet, `useRequireLogin` | `features/auth/*` | §4-5 | A |
| 3 · D2 | Common sheets (report, block, external link, delete confirm, limit prompt, draft restore) | `features/*` | on top of §7-3 | E |
| 3 · D2 | Web↔app bridge and Expo shell | `packages/bridge`, `lib/bridge/*`, `apps/mobile` | Ch. 11, 12 | B |
| 3 · D2 | STOMP client | `lib/realtime/*` | §11-1 | D |
| 3 · D2 | Test setup (Vitest + vitest-axe, Playwright + axe, MSW) | root config, `apps/web/e2e` | Ch. 14 | C |

**End-of-D2 check (page work starts when this passes)**

- [ ] An empty `/feed` renders in `PageFrame`, with landmarks (header, main, nav) and "본문 바로가기" (skip to content)
- [ ] Opening `/workspace` as a guest shows the login-prompt sheet over `/feed`, and logging in returns to `/workspace`
- [ ] Opening `/admin` as a guest gives 404
- [ ] Open any sheet, close it with X, then go back → the sheet doesn't reopen and you reach the previous page
- [ ] In the Android app, open a sheet and press the hardware back button → only the sheet closes. Pressing twice on the first screen exits the app
- [ ] One orval hook loads `GET /api/v1/user/me` and the member type shows on screen
- [ ] axe reports 0 violations on the empty page

---

## 2. Monorepo structure

```
linker-web/                      # frontend repo (backend is a separate Gradle repo)
├── apps/
│   ├── web/                     # Next.js 16 App Router — every screen
│   └── mobile/                  # Expo WebView shell — ch. 12
├── packages/
│   ├── api/                     # orval output (hooks, query options, MSW mocks, zod). Never edited by hand
│   ├── bridge/                  # web↔app message types and zod schemas, shared by web and mobile
│   └── config/                  # shared tsconfig, eslint, prettier
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

- No `packages/ui`. Only one app (`apps/web`) draws screens, so shadcn components live in `apps/web/src/components/ui`.
- Put `onlyBuiltDependencies: [sharp, esbuild]` in `pnpm-workspace.yaml`. pnpm 10 blocks install scripts by default, so the sharp binary install may be skipped (ch. 10).
- Expo supports pnpm monorepos, but if Metro can't find modules, set `node-linker=hoisted` in `.npmrc` as the Expo monorepo guide says.

### 2-1. orval (`packages/api`)

- Generated from springdoc `/v3/api-docs`. Per 09 WBS §1-3 rule 6, **controller `@Tag` = page**, so `mode: 'tags-split'` produces one file per page.
  - e.g. `packages/api/src/generated/p11-issue-list/p11-issue-list.ts` → `useGetTeamIssues`, `getGetTeamIssuesQueryOptions` …
- Output: `react-query` hooks + query options, `msw` mocks, `zod` schemas.
- One mutator: `apps/web/src/lib/api/api-fetch.ts` (works on server and browser, §5-4).
- Generate with `pnpm --filter @linker/api generate`, as a step before Turborepo `build`.

---

## 3. Web app folder structure (colocation)

### 3-1. Principles

- **What only one page uses lives in that page's folder.** Components, hooks, schemas and tests go in private folders next to `page.tsx` (`_components`, `_hooks`, `_lib`, `_views`). Folders starting with `_` never become URLs.
- **If two or more pages use it, move it up to the nearest common ancestor folder.** e.g. the editor shared by post create (`/posts/new`) and edit (`/posts/[id]/edit`) → `(developer)/posts/_components/post-editor/`.
- **If used across role groups, move it to `src/features/<domain>/`.** e.g. the 4 sheets made by issue detail (12) and used by 13, 14, 15 are all under `teams/[id]`, so `teams/[id]/_components/issue-sheets/`. Something used by nearly every group, like the report sheet, goes to `src/features/report/`.
- **Only domain-free shared parts go in `src/components/`.** shadcn originals (`ui/`), layout skeletons (`layout/`), overlay frames (`overlay/`).
- Tests sit next to their target as `*.test.tsx`. MSW handlers use orval output; only per-screen overrides go in `_lib/handlers.ts`.
- File names are kebab-case (`issue-status-sheet.tsx`), exported component names PascalCase (`IssueStatusSheet`). One exported component per file.

### 3-2. Role groups

**Pages are split by role** with App Router route groups `( )`, which don't change URLs. A group's `layout.tsx` handles that role's access check and screen frame.

| Group | Whose pages | Role in user requirements | On entry |
| --- | --- | --- | --- |
| `(auth)` | Entry **before** login: start, login callback, recruiter sign-up, login, password reset | Guest | If logged in, to `/feed` (except callbacks) |
| `(public)` | Anyone **reads**: feed, posts, recruit posts, profiles, legal docs, invite preview | Guest + every logged-in role | Action buttons show the login-prompt sheet for guests |
| `(member)` | Shared by logged-in **developers + recruiters**: chat, notifications, settings, profile edit, subscription and payment (developers Pro/Flex, recruiters Scout) | Developer, recruiter | Items inside a screen branch per role with `_views/` |
| `(developer)` | **Developers (GitHub login) only**: onboarding, workspace, teams, issues, writing screens, stats | Social-login users (+ operators) | Recruiters go to `/feed` |
| `(recruiter)` | **Recruiters only**: sent recruiting offers list | Recruiter | Developers go to `/feed` |
| `(admin)` | **Operators only** back office | Operator | 404 if not an operator (doesn't reveal it exists) |

By policy an operator is "a developer account + operator permission", so in the app operators use `(developer)`, `(member)` and `(public)` exactly like developers, and `(admin)` additionally opens.

### 3-3. Full tree

`★` is the 07 TODO page number. Private folders such as `_components` show only representative examples.

```
apps/web/
├── next.config.ts                    # images, typedRoutes, headers (X-Robots-Tag)
├── proxy.ts                          # (formerly middleware, renamed in Next 16) role guard → ch. 4
├── public/                           # logo, favicon, default OG image
└── src/
    ├── app/
    │   ├── layout.tsx                # <html lang="ko">, Providers, default metadata and viewport
    │   ├── providers.tsx             # 'use client' — QueryClient, NuqsAdapter, LazyMotion, Toaster, NativeBridgeProvider
    │   ├── not-found.tsx             # "삭제되었거나 볼 수 없는 콘텐츠예요" (deleted or unavailable content)
    │   ├── error.tsx                 # 'use client' — retry
    │   ├── global-error.tsx
    │   ├── robots.ts                 # ch. 8 SEO switch
    │   ├── manifest.ts
    │   │
    │   ├── (auth)/
    │   │   ├── layout.tsx            # EntryShell (no bottom tabs); to /feed if logged in
    │   │   ├── page.tsx              # ★01 /  start (3 intro blocks, start with GitHub, browse)
    │   │   ├── auth/callback/page.tsx            # ★01 /auth/callback
    │   │   └── recruiter/
    │   │       ├── signup/page.tsx               # ★31 /recruiter/signup  (steps: ?step=)
    │   │       ├── login/page.tsx                # ★32 /recruiter/login
    │   │       └── reset/page.tsx                # ★32 /recruiter/reset
    │   │
    │   ├── (public)/
    │   │   ├── layout.tsx            # AppShell (bottom tabs), no guard
    │   │   ├── feed/page.tsx                     # ★24 /feed
    │   │   ├── posts/[id]/page.tsx               # ★23 /posts/[id]
    │   │   ├── recruits/page.tsx                 # ★19 /recruits
    │   │   ├── recruits/[id]/page.tsx            # ★21 /recruits/[id]
    │   │   ├── _components/recruiter-ad-card/    # job ad card: shared by the 24 feed card and the 04 job ad sheet preview
    │   │   ├── u/[login]/page.tsx                # ★04 /u/[login]  (includes recruiter my page + job ad sheet)
    │   │   ├── legal/[slug]/page.tsx             # ★03 /legal/[slug]
    │   │   └── invite/[code]/page.tsx            # ★10 /invite/[code]
    │   │
    │   ├── (member)/
    │   │   ├── layout.tsx            # login check, AppShell
    │   │   ├── chats/page.tsx                    # ★16 /chats
    │   │   ├── chats/[roomId]/page.tsx           # ★17 /chats/[roomId]
    │   │   ├── notifications/page.tsx            # ★18 /notifications
    │   │   ├── settings/page.tsx                 # ★06 /settings
    │   │   ├── settings/profile/page.tsx         # ★05 /settings/profile
    │   │   ├── subscribe/
    │   │   │   ├── page.tsx                      # ★28 /subscribe  (developers: Pro/Flex, recruiters: Scout)
    │   │   │   ├── success/page.tsx              # ★28
    │   │   │   └── fail/page.tsx                 # ★28
    │   │   └── settings/subscription/page.tsx    # ★29 /settings/subscription
    │   │
    │   ├── (developer)/
    │   │   ├── layout.tsx            # developer check + onboarding-done check, AppShell
    │   │   ├── onboarding/page.tsx               # ★02 /onboarding  (steps: ?step=)
    │   │   ├── workspace/page.tsx                # ★07 /workspace
    │   │   ├── teams/
    │   │   │   ├── new/page.tsx                  # ★08 /teams/new  (steps: ?step=)
    │   │   │   ├── new/callback/page.tsx         # ★08 /teams/new/callback
    │   │   │   └── [id]/
    │   │   │       ├── layout.tsx                # team layout: team name, team switcher sheet, team menu nav (issues, board, calendar, settings), team chat shortcut
    │   │   │       ├── _components/issue-sheets/ # made by 12, used by 13, 14, 15 (assignee, label, date, status)
    │   │   │       ├── _lib/issue-filters.ts     # 11's nuqs filter parser, used by 14, 15
    │   │   │       ├── _components/progress-card/ # 11 progress card (Flex): completion ring, 4-column bars, 14-day trend, per assignee + view as table
    │   │   │       ├── issues/page.tsx           # ★11
    │   │   │       ├── issues/new/page.tsx       # ★13
    │   │   │       ├── issues/[issueId]/page.tsx # ★12
    │   │   │       ├── board/page.tsx            # ★14
    │   │   │       ├── calendar/page.tsx         # ★15
    │   │   │       └── settings/page.tsx         # ★09
    │   │   ├── recruits/
    │   │   │   ├── _components/recruit-editor/   # shared by 20 create/edit
    │   │   │   ├── new/page.tsx                  # ★20 /recruits/new
    │   │   │   └── [id]/edit/page.tsx            # ★20 /recruits/[id]/edit
    │   │   ├── posts/
    │   │   │   ├── _components/post-editor/      # shared by 22 create/edit
    │   │   │   ├── new/page.tsx                  # ★22 /posts/new
    │   │   │   └── [id]/edit/page.tsx            # ★22 /posts/[id]/edit
    │   │   └── me/stats/page.tsx                 # ★30 /me/stats
    │   │
    │   ├── (recruiter)/
    │   │   ├── layout.tsx            # recruiter check, AppShell
    │   │   └── recruiter/offers/page.tsx         # ★33 /recruiter/offers
    │   │
    │   └── (admin)/
    │       └── admin/
    │           ├── layout.tsx        # operator check + OTP gate + logout after 30 min idle, AdminShell
    │           ├── page.tsx          # redirect('/admin/reports')
    │           ├── reports/page.tsx              # ★25
    │           ├── users/page.tsx                # ★26
    │           └── audit/page.tsx                # ★27
    │
    ├── components/
    │   ├── ui/                       # shadcn originals (button, drawer, dialog, sheet, tabs …). No domain logic
    │   ├── layout/                   # AppShell, EntryShell, AdminShell, PageFrame, TabHeader, StackHeader, BottomTabBar, SkipLink
    │   └── overlay/                  # OverlaySheet, OverlayDialog (frames bound to useOverlay)
    ├── features/                     # domain parts used across groups
    │   ├── auth/                     # LoginRequiredSheet, useRequireLogin, useSession
    │   ├── report/                   # ReportSheet
    │   ├── block/                    # BlockConfirmSheet
    │   ├── plan-limit/               # PlanLimitSheet (subscription prompt on hitting a limit)
    │   ├── share/                    # ShareButton, ShareSheet ("링크 복사" Copy link / "채팅방에 공유" Share to chat room), ShareTargetPicker (chat room list), ShareCard (post / recruit post / profile card in chat, used by 17)
    │   ├── chart/                    # 3 library-free SVG charts (Ring, StackedBar, Line) and ChartFigure (summary sentence + "표로 보기" View as table). 11 progress, 30 my stats
    │   ├── external-link/            # ExternalLinkConfirmSheet, ExternalLink
    │   ├── draft-restore/            # draft restore sheet + useDraft (7-day local draft)
    │   ├── tech-tags/                # TechTagSheet (02, 05, 19, 20, 22)
    │   ├── job-status/               # JobStatusFieldset (02, 05)
    │   ├── job-categories/           # JobCategoryChips (05 up to 3 job categories of interest, 04 job ad sheet 1)
    │   ├── image-upload/             # ImageUploader (presigned)
    │   ├── user/                     # UserAvatar, UserBadge (looking for team, job seeking)
    │   └── chat-request/             # message request / recruiting offer composer (opened from 04, 23)
    ├── hooks/                        # domain-free hooks: useIsClient, useMediaQuery, useInfiniteScrollTrigger
    ├── lib/
    │   ├── api/                      # api-fetch.ts (orval mutator), api-error.ts, query-client.ts
    │   ├── auth/                     # session.ts (read session on server), route-access.ts (ch. 4)
    │   ├── navigation/               # use-overlay.ts, overlay-keys.ts, nav-depth.ts, use-app-back.ts (ch. 7)
    │   ├── bridge/                   # native-bridge.ts, native-bridge-provider.tsx (ch. 11)
    │   ├── realtime/                 # stomp-client.ts, use-stomp-subscription.ts
    │   ├── seo/                      # metadata.ts (shared builder), seo-flags.ts
    │   ├── format/                   # time.ts (KST), number.ts ("1.2천" = 1.2K), text.ts (character counts)
    │   ├── browser/                  # safe-storage.ts, is-browser.ts
    │   └── policy.ts                 # 04 Policy numbers (with POL id comments)
    ├── stores/                       # Zustand: ui-store.ts etc. (no server data, no overlays)
    └── styles/globals.css            # Tailwind v4 @theme tokens
```

### 3-4. Shape of one page folder

```
(public)/posts/[id]/
├── page.tsx                  # server: params, prefetch, generateMetadata, landmarks and section layout
├── loading.tsx               # skeleton (same landmark structure)
├── _lib/
│   └── get-post.ts           # React cache() so metadata and page make the same request only once
├── _views/                   # (only when the same URL is drawn differently per role)
├── _components/
│   ├── post-gallery.tsx          # 'use client' swipe + open fullscreen viewer
│   ├── post-repo-card.tsx        # server
│   ├── readme-section.tsx        # server frame + readme-toggle.tsx ('use client')
│   ├── post-actions.tsx          # 'use client' like, comment count, more
│   ├── comment-section.tsx       # server frame (heading, count) → comment-list.tsx, comment-form.tsx ('use client')
│   └── post-more-sheet.tsx       # 'use client' overlay
└── page.test.tsx
```

---

## 4. Role separation and access guards

### 4-1. Reading the role on the frontend

The policy's four roles are computed as follows (same as ERD ch. 1 "How roles are represented").

| Role | Condition |
| --- | --- |
| `guest` | No session cookie |
| `developer` | `userType = DEVELOPER` |
| `recruiter` | `userType = RECRUITER` |
| `operator` | `developer` + `isAdmin = true` (treated as developer in the app, plus `/admin`) |

- So that `proxy.ts` doesn't call the API on every request, it only reads the **JWT cookie claims** (`typ`, `adm`, `onb` (onboarding done), `st` (user status)) after verifying the signature (`jose`, backend public key). These claims must match the backend (ch. 15).
- Group `layout.tsx` files and pages check again with `getSession()` from `src/lib/auth/session.ts` (calls `GET /api/v1/user/me` internally, wrapped in React `cache()`). Never trust `proxy.ts` alone.
- **Spring makes the real authorization decision.** The frontend guard only goes as far as "don't show screens that shouldn't open".

### 4-2. `route-access.ts` — the one place the policy table lives in code

This is a direct copy of the "Access by role" table in 04 Policy ch. 2. When the table changes, edit only this file.

```ts
// src/lib/auth/route-access.ts
export type Role = 'guest' | 'developer' | 'recruiter' | 'operator';

/** What to do when blocked — login: login-prompt sheet over /feed + returnTo · home: /feed · notFound: 404
 *  (resolveAccess returns 'onboarding' before this table when onboarding is not done) */
type Deny = 'login' | 'home' | 'notFound' | 'onboarding';

export const ROUTE_ACCESS = [
  // (auth) — entry before login. Logged in → /feed
  { page: '01', match: /^\/$/,                          allow: ['guest'],                       deny: 'home' },
  { page: '01', match: /^\/auth\/callback$/,            allow: ['guest', 'developer', 'recruiter', 'operator'] },
  { page: '31', match: /^\/recruiter\/signup$/,         allow: ['guest'],                       deny: 'home' },
  { page: '32', match: /^\/recruiter\/(login|reset)$/,  allow: ['guest'],                       deny: 'home' },
  // (public) — anyone reads
  { page: '24', match: /^\/feed$/,                      allow: 'all' },
  { page: '23', match: /^\/posts\/[^/]+$/,              allow: 'all' },
  { page: '19', match: /^\/recruits$/,                  allow: 'all' },
  { page: '21', match: /^\/recruits\/[^/]+$/,           allow: 'all' },
  { page: '04', match: /^\/u\/[^/]+$/,                  allow: 'all' },
  { page: '03', match: /^\/legal\/[^/]+$/,              allow: 'all' },
  { page: '10', match: /^\/invite\/[^/]+$/,             allow: 'all' },   // recruiters see "developer accounts only…" inside the screen
  // (member)
  { page: '16', match: /^\/chats$/,                     allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  { page: '17', match: /^\/chats\/[^/]+$/,              allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  { page: '18', match: /^\/notifications$/,             allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  { page: '06', match: /^\/settings$/,                  allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  { page: '05', match: /^\/settings\/profile$/,         allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  { page: '28', match: /^\/subscribe(\/(success|fail))?$/, allow: ['developer', 'recruiter', 'operator'], deny: 'login' },   // plan list differs by role
  { page: '29', match: /^\/settings\/subscription$/,    allow: ['developer', 'recruiter', 'operator'], deny: 'login' },
  // (developer) — guests get the login prompt, recruiters go to /feed
  { page: '02', match: /^\/onboarding$/,                allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '07', match: /^\/workspace$/,                 allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '08', match: /^\/teams\/new(\/callback)?$/,   allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '09-15', match: /^\/teams\/[^/]+\/.+$/,       allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '20', match: /^\/recruits\/(new|[^/]+\/edit)$/, allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '22', match: /^\/posts\/(new|[^/]+\/edit)$/,  allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  { page: '30', match: /^\/me\/stats$/,                 allow: ['developer', 'operator'], deny: { guest: 'login', recruiter: 'home' } },
  // (recruiter)
  { page: '33', match: /^\/recruiter\/offers$/,         allow: ['recruiter'], deny: { guest: 'login', developer: 'home', operator: 'home' } },
  // (admin) — hide its existence from non-operators
  { page: '25-27', match: /^\/admin(\/.*)?$/,           allow: ['operator'], deny: 'notFound' },
] as const;
```

- `proxy.ts` checks the table "most specific first", so static paths (`/posts/new`) match **before** dynamic paths (`/posts/[id]`) (put static rules higher, or add a test for `match` order).
- Developers who haven't finished onboarding (`onb = false`) are sent to `/onboarding` from every URL except `(auth)`, `/legal/*` and `/onboarding` (07 TODO 00).
- Suspended accounts (`st = SUSPENDED`) are not blocked; a suspension banner shows over the screen. The API rejects writes with `SUSPENDED`.

### 4-3. `proxy.ts`

```ts
// apps/web/proxy.ts  (Next 16. On 15 or lower, put the same code in middleware.ts / export function middleware)
import { NextResponse, type NextRequest } from 'next/server';
import { readRoleFromCookie } from '@/lib/auth/read-role';      // signature check with jose + claims
import { resolveAccess } from '@/lib/auth/route-access';

export async function proxy(req: NextRequest) {
  const viewer = await readRoleFromCookie(req);                  // { role, onboarded, status }
  const result = resolveAccess(req.nextUrl.pathname, viewer);
  if (result.ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  switch (result.deny) {
    case 'login':                                                // login-prompt sheet over /feed, carrying the URL being viewed
      url.pathname = '/feed';
      url.search = `?overlay=login&returnTo=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);                         // an HTTP redirect leaves no history entry
    case 'home':
      url.pathname = '/feed'; url.search = '';
      return NextResponse.redirect(url);
    case 'notFound':
      return NextResponse.rewrite(new URL('/404', req.url), { status: 404 });
    case 'onboarding':
      url.pathname = '/onboarding'; url.search = '';
      return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
```

`returnTo` only accepts same-origin paths (starts with `/`, `//` forbidden) to prevent open redirects.

### 4-4. When several roles see the same URL: `_views/`

For URLs whose screen differs by role, **don't split the URL**. Put per-role view components in `_views/` inside the page folder. `page.tsx` (server) reads the session and picks one. If the policy table difference is only "same view, different buttons", don't create `_views/`; branch inside a single action-area component.

| Page | `_views/` | How it picks |
| --- | --- | --- |
| 04 `/u/[login]` | `developer-profile-view.tsx`, `recruiter-profile-view.tsx`, `recruiter-my-page-view.tsx` | Profile owner type × whether it's my profile. The viewer's role only changes buttons in `profile-actions.tsx` (follow / send recruiting offer / login prompt) |
| 06 `/settings` | `developer-settings-view.tsx`, `recruiter-settings-view.tsx` | My account type (recruiter: no GitHub, Scout-only subscription, has password change) |
| 05 `/settings/profile` | `developer-profile-form.tsx`, `recruiter-profile-form.tsx` | My account type (job categories of interest only in the developer form) |
| 28 `/subscribe` · 29 `/settings/subscription` | none | The server returns only the plans for the account type (developers Pro·Flex, recruiters Scout). The screen just draws that list |
| 16 `/chats` | none | Only the tab list is a per-role array (recruiters: personal tab only) |
| 24 `/feed` | none | Only the top toggle ("제안 받는 개발자만", developers open to offers only) and the write button differ by role. The server puts job ad cards only in responses for logged-in developers, so no role branch: if `item.type === 'AD'`, render `RecruiterAdCard` |
| 10 `/invite/[code]` | none | Only the accept area: guest → login prompt, recruiter → "개발자 계정만 팀에 참여할 수 있어요" (only developer accounts can join teams) |

```tsx
// (public)/u/[login]/page.tsx — server component
export default async function ProfilePage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const [session, profile] = await Promise.all([getSession(), getProfile(login)]); // getProfile lives in _lib, React cache()
  if (profile.kind === 'RECRUITER') {
    return profile.login === session?.login
      ? <RecruiterMyPageView profile={profile} />
      : <RecruiterProfileView profile={profile} viewerRole={session?.role ?? 'guest'} />;
  }
  return <DeveloperProfileView profile={profile} viewerRole={session?.role ?? 'guest'} />;
}
```

### 4-5. Guest actions: `useRequireLogin()`

Every "login prompt" cell in policy POL-A-9 is handled by this one hook.

```tsx
'use client';
export function LikeButton({ postId, liked }: Props) {
  const requireLogin = useRequireLogin();          // for guests: opens the login-prompt sheet and returns false
  const like = useLikePost();                      // orval hook
  return (
    <button type="button" aria-pressed={liked}
      onClick={() => requireLogin() && like.mutate({ postId })}>
      <HeartIcon aria-hidden /> <span className="sr-only">좋아요</span>
    </button>
  );
}
```

- If the API returns 401 `LOGIN_REQUIRED`, the same sheet opens (`MutationCache.onError` in `query-client.ts`).
- If a recruiter triggers a developer-only action (403 `DEVELOPER_ONLY`), the correct behavior is that the button doesn't exist at all. If that response arrives, show only a toast and log it to Sentry (it's a screen-branching bug).

### 4-6. Bottom tabs are a per-role array

```ts
// src/components/layout/bottom-tabs.config.ts
export const TABS_BY_ROLE = {
  guest:     ['home', 'recruits', 'workspace', 'chats', 'profile'],   // last 3 open the login prompt (buttons, not links)
  developer: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  operator:  ['home', 'recruits', 'workspace', 'chats', 'profile'],
  recruiter: ['home', 'chats', 'profile'],                           // profile = recruiter my page (/u/r-…)
} as const;
```

---

## 5. Server components and client components

### 5-1. Rules

- **Server is the parent, client is the leaf.** `page.tsx`, `layout.tsx` and section frames are server components. Put `'use client'` only on the **smallest unit** that needs state, events, browser APIs or realtime.
- Client components can't `import` server components. If server content must go inside, take it as `children` or a prop.
- `providers.tsx` is a client component too, but the root `layout.tsx` (server) passes it `children`, so the pages below stay server components.
- Props passed from server to client must be serializable (no functions, class instances or Date → ISO strings).
- Use `ssr: false` of `next/dynamic` only inside client components (Next blocks it in server components).

### 5-2. Data flow: prefetch on the server, client hooks take over

```tsx
// (developer)/teams/[id]/issues/page.tsx — server
export default async function IssueListPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const filters = issueFiltersCache.parse(await searchParams);   // nuqs server cache (_lib/issue-filters.ts)
  const qc = getQueryClient();
  await qc.prefetchInfiniteQuery(getGetTeamIssuesInfiniteQueryOptions(id, filters));
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <PageFrame header={<TeamTabHeader teamId={id} />} title="이슈">
        <IssueListToolbar />          {/* 'use client' opens filter sheet, new-issue button */}
        <IssueList teamId={id} />     {/* 'use client' useGetTeamIssuesInfinite — renders immediately from prefetched data */}
      </PageFrame>
    </HydrationBoundary>
  );
}
```

- When `generateMetadata` and `page` use the same data, wrap `_lib/get-*.ts` in React `cache()` so it's requested only once.
- Read-only areas with no interaction (repo card, terms body, completion record) render directly on the server without prefetch.
- Wrap heavy lower areas in `<Suspense fallback={<Skeleton/>}>` so the first visible part doesn't wait.

### 5-3. When to split a component

**Split only when the reason is one of the following.** Write the reason as a one-line comment at the top of the file (e.g. `// client boundary: optimistic like`).

| Reason to split | Example |
| --- | --- |
| Server/client boundary | `comment-section.tsx` (server) → `comment-form.tsx` (client) |
| Independent loading/error boundary (Suspense) | Contribution calendar on profile, suggested developers in feed |
| Independent landmark/region (`section`, `aside`, `nav`) | Team menu nav, the "내 이슈" (My issues) section of the workspace |
| Overlay | `issue-status-sheet.tsx` |
| Real reuse (used in two or more places right now) | `TechTagSheet` (02·05·19·20·22) |
| Per-role view | `_views/recruiter-my-page-view.tsx` |

**When NOT to split**

- NEVER split just because a file is long. If it's one region of one screen, one file is better even at 200 lines.
- NEVER use purposeless names like `Wrapper`, `Container`, `Box`, `Item2`. Names say "what it does" (`IssueAssigneeSheet`, `RecruitDeadlineBadge`).
- NEVER generalize ahead of time because "it might be reused later". When a second user appears, promote it per rule 3-1.
- Variants that differ only in style are `cva` variants, not duplicated components.

### 5-4. API calls: `api-fetch.ts` (orval mutator)

```ts
// src/lib/api/api-fetch.ts — works on server and browser
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const isServer = typeof window === 'undefined';
  const headers = new Headers(init.headers);
  if (isServer) {
    const { cookies } = await import('next/headers');            // imported only on the server
    headers.set('cookie', (await cookies()).toString());         // forward the viewer's cookie (optional auth for public APIs)
  }
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...init, headers,
    credentials: isServer ? undefined : 'include',               // browser: include api. domain cookies
  });
  if (!res.ok) throw await ApiError.from(res);                    // { code, message, detail } — 09 WBS 1-4
  return res.status === 204 ? (undefined as T) : res.json();
}
```

- Shared handling per error code (`query-client.ts`): `LOGIN_REQUIRED` → login-prompt sheet, `PLAN_LIMIT` → limit sheet (links to `/subscribe?reason=` with the limit name from `detail`), `RATE_LIMITED` → "잠시 후 다시 시도해 주세요" (please try again shortly) + time remaining, `SUSPENDED` → suspension banner, `GITHUB_UNAVAILABLE` → GitHub instability banner.
- Public data you want cached is fetched by the separate server functions in ch. 9 (attaching cookies makes the response per-person, so it can't be cached).

---

## 6. Accessibility, landmarks, semantic markup

### 6-1. Page skeleton

Every app screen gets the same landmark order through `PageFrame` (server).

```tsx
// The order actually rendered
<body>
  <a href="#main" className="skip-link">본문 바로가기</a>      {/* "Skip to content", visible on first Tab */}
  <header>                                                      {/* banner: TabHeader or StackHeader */}
    …logo or back button, notification bell ("로그인" Log in button for guests)…
  </header>
  <main id="main" tabIndex={-1} aria-labelledby="page-title">
    <h1 id="page-title">이슈</h1>                               {/* one h1 per page. May be visually hidden (sr-only) */}
    <section aria-labelledby="…">…</section>
  </main>
  <nav aria-label="주 메뉴">…bottom tabs…</nav>                  {/* "Main menu"; fixed at the bottom on screen, but after main in the DOM */}
</body>
```

- One each of `header`, `main` and `nav` (main menu) per page. Every other `nav` MUST have a name (`aria-label="팀 메뉴"` team menu, `"게시물 탭"` post tabs).
- On stack screens (StackHeader) the top bar title may itself be the `h1`. Then `main`'s `aria-labelledby` points at that `h1`. Either way, **exactly one h1**.
- Don't skip heading levels (h1 → h2 → h3). Card titles are `h2`/`h3` according to their place in the list.
- Admin screens (AdminShell): `header` + left `nav aria-label="운영 메뉴"` (admin menu) + `main` (list) + detail panel `aside aria-label="신고 상세"` (report detail) (a sheet on narrow screens).

### 6-2. Choosing elements

| Content | Element |
| --- | --- |
| Post, recruit post and issue cards in feeds/lists | `<ul>` > `<li>` > `<article aria-labelledby>`. The whole feed is `role="feed"` + `aria-busy` (while loading) |
| Feed job ad card | Same `<li>` > `<article>`. Put a visible "광고" (Ad) label before the title and have `aria-labelledby` read it first ("광고, ○○회사, 백엔드 개발자 채용" = Ad, ○○ Company, hiring backend developer). X has `aria-label="광고 닫기"` (close ad); the outbound button is "외부 공고 보기(새 창)" (view external posting, new window). On close, move focus to the next card |
| Charts (11 progress, 30 my stats) | `ChartFigure` = `<figure>` + `<figcaption>` (visible summary sentence: "12개 중 7개 완료, 58%" = 7 of 12 done, 58%). SVG gets `role="img"` + the same summary as `aria-label`; shapes inside are `aria-hidden`. The "표로 보기" (view as table) toggle (`aria-expanded`) shows the same values as a `<table>` (`<caption>`, `<th scope>`). Never distinguish status by color alone: add column names/patterns; bars and lines at 3:1 contrast or more (light and dark). Animation off with `prefers-reduced-motion`. Per-assignee view is sorted by name, not ranked |
| Share sheet, chat room picker | Sheet title `h2`, the two actions are a list of `<button>`s. The room picker is a search `<input type="search">` + `<ul>` list, each room a `<button>` ("○○ 팀 채팅방에 공유" = share to ○○ team chat room). After sending, focus returns to the share button and a toast with `role="status"` |
| Share card / Linker link card in chat | A single link (`<a>`) inside the message `<article>`, named "게시물: 레포 이름, 한 줄 소개" (Post: repo name, one-line intro). If it can't be viewed, text only, no link |
| Time | `<time dateTime="2026-10-16T09:00:00+09:00">10월 16일</time>` |
| Name–value groups (repo info, plan comparison, profile meta) | `<dl>` `<dt>` `<dd>` |
| Photo + caption | `<figure>` + `<figcaption>` |
| Radio groups (job-seeking status, meeting style) | `<fieldset>` + `<legend>` |
| Tabs (feed tabs, chat tabs, recruit tabs) | shadcn `Tabs` (Radix, `role="tablist"`). Tab value in the URL via nuqs |
| Chat message list | `role="log"` + `aria-live="polite"`, each message an `<article>` |
| Toast | `role="status"` (errors `role="alert"`) |
| Step screens (onboarding, team creation, recruiter signup) | `<ol>` step indicator + current step `aria-current="step"` |
| Calendar | `<table>` + `<th scope="col">` (weekdays). Date cells are `<button>` + `aria-label="10월 16일, 이슈 2개"` (Oct 16, 2 issues) |
| Unread badge | Show the number visually and include it in the link name: `aria-label="채팅, 안 읽은 메시지 3개"` (Chat, 3 unread messages) |
| Icon-only button | Icon `aria-hidden`; button gets `sr-only` text or `aria-label` |
| Toggle button (like, follow) | `aria-pressed` |
| Current tab / current page link | `aria-current="page"` |

### 6-3. Forms

- Every input has a visible `<label>`. A placeholder never replaces a label.
- Errors: `aria-invalid="true"` + `aria-describedby` linking the error text. On submit failure, focus the first invalid field.
- Character counters use `aria-live="polite"` and only announce at 90% of the limit or more (not on every keystroke).
- Required fields: `required` + a visual marker (NEVER color alone).
- react-hook-form + zod schemas live in `_lib/schema.ts`; numbers come from `policy.ts`.

### 6-4. Overlay accessibility

- Bottom sheets are shadcn `Drawer`, centered modals `Dialog`, side panels `Sheet`. All are Radix-based, so focus trapping, `Esc` to close and returning focus to the trigger after close are built in. Do not turn these off.
- Every overlay has a `DialogTitle` (may be visually hidden) and a `DialogDescription`.
- Confirm modals (delete, leave service, delete team) use `AlertDialog`, with default focus on "취소" (Cancel).

### 6-5. Other musts

- Contrast: body text 4.5:1, large text and icons 3:1. Check when creating color tokens.
- Focus indicator: never remove the `focus-visible` ring (NEVER `outline-none` alone).
- Touch targets: 44×44px or more (more generous than the WCAG 2.5.8 minimum of 24px).
- Drag actions (board drag, reordering photos) have a button alternative doing the same thing (WCAG 2.5.7). Board: card menu "상태 바꾸기" (change status); photos: "앞으로/뒤로" (forward/back) buttons. Also enable dnd-kit `KeyboardSensor` and `announcements` (in Korean).
- Motion: `<MotionConfig reducedMotion="user">`. Autoplay GIFs play only on tap (same as policy).
- NEVER block zoom: don't put `maximumScale` or `userScalable: false` in `viewport`.
- Infinite-scroll lists also have a "더 보기" (Load more) button at the end (so keyboard and screen reader users aren't trapped). Items in virtualized lists get `aria-setsize` and `aria-posinset`.
- Page navigation announcements use Next's default route announcer (reads the document title). So every page needs a unique `title` (ch. 8).

### 6-6. Mobile first

- Base Tailwind classes = 360px-wide mobile. Wider screens add `sm:` (640) `md:` (768) `lg:` (1024).
- App screens keep a centered max width (`max-w-screen-sm`) even at `lg`; only admin screens expand to list + detail two columns at `lg` (07 TODO ch. 8 says "admin screens are desktop-first", but CSS is still written mobile-first).
- Height `100dvh`; bottom tabs and input bars use `pb-[env(safe-area-inset-bottom)]`. `viewportFit: 'cover'` in `viewport`.
- Input font size 16px or more (prevents iOS zoom).
- NEVER rely on hover-only UI (hover menus, hover tooltips). Long-press actions have a "더보기" (More) button alternative.

---

## 7. Overlays and back navigation — never trap the user in place

### 7-1. Causes of trapping

| Cause | Result |
| --- | --- |
| Close implemented as "**push** with the param removed from the URL" | Back → sheet reopens → close → push again … infinite loop |
| Push every time sheet B opens from sheet A | Back must be pressed many times to leave the page |
| Push even when reopening the same sheet | History piles up |
| Intermediate screens like login callback or payment success left in history | Back → callback runs again → sends you forward again |
| A sheet entered directly by URL (`?overlay=…`) closed with `history.back()` | Leaves the app (or lands on a blank screen) |

### 7-2. Rules

1. **Overlay state lives only in one URL param (`overlay`).** If a target id is needed, use `oid`. Since it's one key, two can never be open at once.
2. **Push only on first open**; if another overlay is already open, **replace** it. If the same overlay is already open, do nothing.
3. **On close**: if we opened it with push on this screen, `history.back()`. If it came in directly by URL or was swapped in by replace, remove the param with `replace`. **NEVER push while closing.**
4. **Going to another page from inside an overlay** uses `closeThen(href)`: close first (wait for popstate), then navigate. No overlay history is left behind.
5. Overlay params are `shallow` (no server re-render) and never go into canonical or OG URLs.
6. **NEVER build modals with Next Intercepting/Parallel Routes** (MVP). Their history behavior matches page navigation, making the rules above hard to keep.

### 7-3. `useOverlay()`

```ts
// src/lib/navigation/use-overlay.ts
'use client';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { OVERLAY_KEYS, type OverlayKey } from './overlay-keys';   // 'login' | 'report' | 'issue-status' | …

const parsers = { overlay: parseAsStringLiteral(OVERLAY_KEYS), oid: parseAsString };
let pushedByApp = false;                                         // did we open it with push on this screen?

export function useOverlay(key: OverlayKey) {
  const [{ overlay, oid }, set] = useQueryStates(parsers, { shallow: true });
  const isOpen = overlay === key;

  function open(id?: string) {
    if (isOpen && (id ?? null) === oid) return;                  // reopening the same one → ignore
    const history = overlay ? 'replace' : 'push';                // swap instead of stacking
    if (history === 'push') pushedByApp = true;
    void set({ overlay: key, oid: id ?? null }, { history });
  }

  function close() {
    if (!isOpen) return;
    if (pushedByApp) { pushedByApp = false; window.history.back(); }   // undo the entry we pushed
    else void set({ overlay: null, oid: null }, { history: 'replace' });
  }

  return { isOpen, id: oid, open, close, onOpenChange: (o: boolean) => (o ? open() : close()) };
}
```

- When back (browser, Android, app bridge) removes the param, the nuqs state changes and the sheet closes; an effect in `OverlayRoot` resets `pushedByApp = false` when `overlay === null`.
- `OverlaySheet`/`OverlayDialog` (`src/components/overlay/`) are frames that wire `useOverlay`'s `isOpen`/`onOpenChange` to Radix `open`/`onOpenChange`. Feature sheets only put content inside these frames.

```tsx
'use client';
export function IssueStatusSheet({ issueId }: { issueId: string }) {
  const sheet = useOverlay('issue-status');
  return (
    <OverlaySheet overlay={sheet} title="상태 바꾸기">
      {/* 4 status radios + save → on mutate success, sheet.close() */}
    </OverlaySheet>
  );
}
```

### 7-4. Navigation rules

| Situation | Method |
| --- | --- |
| Login callback → `returnTo` / `/feed` / `/onboarding` | `router.replace` |
| Onboarding done → `/feed` | `router.replace` |
| Team creation callback → next step | `router.replace` |
| Payment success/fail → done screen / subscription management | `router.replace` |
| Finished writing (post, recruit post, issue) → detail | `router.replace` (so back doesn't return to an empty editor) |
| Steps of step screens (`?step=`) | Forward is push (back = previous step); the final completion is replace |
| List tabs and filters (nuqs) | replace (default). Switching tabs doesn't pile up history |
| Access guard redirects | Server redirect (`proxy.ts`, `redirect()`) — no history |

### 7-5. Top bar back button

For someone who came in directly from a shared link, `router.back()` becomes a button that leaves the app. `StackHeader`'s back decides based on in-app navigation depth.

```ts
// src/lib/navigation/use-app-back.ts
export function useAppBack(fallbackHref: Route) {
  const router = useRouter();
  return () => (getNavDepth() > 0 ? router.back() : router.replace(fallbackHref));
}
```

`nav-depth.ts` records in-app navigation depth in `sessionStorage` (on path change: popstate → -1, otherwise +1; first entry 0). `sessionStorage` access follows the guard in 11-1.

---

## 8. SEO and metadata

### 8-1. What is exposed to search

04 Policy POL-A-9 (changed 2026-10-29): since this is a social service, **developer profiles, posts and recruit posts that guests can read are exposed to search engines**. Metadata and OG go on every page (link previews in KakaoTalk, Slack, Discord).

| Page | Search exposure | Sitemap |
| --- | --- | --- |
| 01 `/`, 03 `/legal/[slug]` | Indexed | Included |
| 24 `/feed`, 19 `/recruits` | Indexed | Included |
| 23 `/posts/[id]` | Indexed | Included (`lastModified` = updated time) |
| 21 `/recruits/[id]` | Indexed (closed posts too; 404 when deleted) | Open posts only |
| 04 `/u/[login]` — developer | Indexed | Included |
| 04 `/u/[login]` — recruiter | `noindex` | Excluded |
| 10 `/invite/[code]` | `noindex` (invite codes must not spread through search) | Excluded |
| Callback, recruiter signup and login in `(auth)` | `noindex` | Excluded |
| All of `(member)`, `(developer)`, `(recruiter)` | `noindex` | Excluded |
| `/admin/*` | `noindex, nofollow` + `X-Robots-Tag` header | Excluded |
| Content not viewable due to hide/delete/suspension/pending withdrawal/block | `notFound()` → 404 | Excluded |

- The rules live in one place: `INDEXABLE` in `src/lib/seo/seo-flags.ts`. The root default is `noindex`; only the "Indexed" pages above turn it on with `buildMetadata({ indexable: true })`. New pages are hidden by default, so private screens can't be exposed by mistake.
- `robots.ts`: allow all crawlers, `Disallow: /admin`, `/api/`, and list the `Sitemap:` URL. Don't `Disallow` any other path (that would stop crawlers from reading `noindex`, and block link-preview bots).
- `sitemap.ts`: split by type with `generateSitemaps()` (`/sitemap/posts/0.xml`, `/sitemap/recruits/0.xml`, `/sitemap/users/0.xml`, up to 50,000 per file). Data comes from the backend's sitemap list API, cached once a day (`revalidate: 86400`) (ch. 15).
- canonical and `og:url`: the URL without query params (also strip the `?from=share` that copy-link adds, so share-marked URLs don't pile up separately in search and preview caches). Old profile URLs of a changed GitHub login get a **308 permanent redirect** to the new URL (same as the 90-day forwarding in 07 TODO 04).
- OG images for link previews are 1200×630. Posts use the cover photo; if none, `opengraph-image.tsx` draws a repo card (repo name, language, stars). Recruit posts: `opengraph-image.tsx` draws title, remaining roles and deadline (D-n). Developer profiles: `opengraph-image.tsx` draws avatar, name and tech stack. All other pages use the default image (`/og-default.png`, service name + one-line intro).

### 8-2. Root metadata

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: { default: 'Linker — 개발자 팀 찾기와 협업', template: '%s | Linker' },
  description: '팀을 찾고, GitHub 조직으로 함께 일하고, 완성한 작업물을 보여주는 개발자 소셜 서비스',
  applicationName: 'Linker',
  openGraph: { type: 'website', siteName: 'Linker', locale: 'ko_KR', images: ['/og-default.png'] },
  twitter: { card: 'summary_large_image' },
  robots: { index: false, follow: true },                        // hidden by default. Indexed pages use buildMetadata({ indexable: true })
  formatDetection: { telephone: false, email: false, address: false },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' },
               { media: '(prefers-color-scheme: dark)', color: '#0b0b0f' }],
};
```

The default title means "Linker — find developer teams and collaborate"; the description means "A developer social service to find teams, work together through GitHub orgs, and show finished work". Keep the Korean strings in code.

### 8-3. Metadata per page

| Page | Method | title | description | OG image |
| --- | --- | --- | --- | --- |
| 01 `/` | static | default | default | default |
| 23 `/posts/[id]` | `generateMetadata` | One-line intro | First 120 chars of body | Cover photo (if none, `opengraph-image.tsx` draws a repo card) |
| 21 `/recruits/[id]` | `generateMetadata` | Recruit post title | "Remaining spots per role · closes D-n" | `opengraph-image.tsx` (title, remaining roles, D-n) |
| 04 `/u/[login]` — developer | `generateMetadata` | "Display name (@login) · first 3 tech stack items" | Bio, 160 chars (if none, "완주 N회 · 작업물 N개" = N completions · N works) | `opengraph-image.tsx` (avatar, name, stack) |
| 04 `/u/[login]` — recruiter | static (default) | default | default | default (name and company never go into previews) |
| 19 `/recruits`, 24 `/feed` | static | "팀 찾기" (Find Team), "홈" (Home) | fixed text | default |
| 03 `/legal/[slug]` | `generateMetadata` + `generateStaticParams` | Document name | Effective date | none |
| 10 `/invite/[code]` | `generateMetadata` | "OO 팀 초대" (Invite to OO team) | Team intro | Org avatar |
| Logged-in screens (member, developer, recruiter) | static `title` only, OG = root default | "채팅" (Chat), "이슈" (Issues), etc. | default | default |
| Admin screens | static `title` | "운영 · 신고 처리" (Admin · Reports) | none | none |

- **OG principle**: previews built from content exist only on post detail (23), recruit post detail (21) and developer profile (04), which guests can read, and on the invite link (10), whose purpose is sharing. Everything else uses the root default (service name "Linker" + one-line intro + default image).
- Screens that require login (chat, issues, workspace, team settings, my stats, etc.) NEVER put team names, issue titles or chat content into `title` or OG, even when the URL is shared. Preview bots don't log in, so read no data on the server and use only static values.
- Hidden, deleted or blocked content doesn't emit its title in `generateMetadata` either; use the default (same decision as `notFound()`).
- Metadata is built through one function, `buildMetadata({ title, description, image, path, indexable })` in `src/lib/seo/metadata.ts` (removes `overlay`, `oid` and filter params from canonical).
- Add JSON-LD on indexed pages: profile `ProfilePage` + `Person` (`sameAs` with GitHub and blog), post `CreativeWork` (`author`, `image`, `datePublished`, `codeRepository`). Recruit posts are not jobs, so use `CreativeWork`, not `JobPosting`. Render `<script type="application/ld+json">` in a server component and replace `<` in strings with `<`.
- The guest view is the first screen from search results, so indexed pages must render their full body on the server without cookies (only logged-in-only info is added on the client).

---

## 9. Caching — screens with a once-a-day policy

### 9-1. Where to cache

| Data | Policy | On the web | Why |
| --- | --- | --- | --- |
| 03 legal documents | Only when the version changes | Next fetch cache `revalidate: 86400`, tag `legal` + `generateStaticParams` | Same for everyone |
| Tech stack tag list | Rarely changes | Next fetch cache 1 day, tag `tech-tags` | Same for everyone |
| 28 plans and prices | Rarely changes | Next fetch cache 1 day, tag `plans:{developer|recruiter}` | Same per account type |
| Job category list | Rarely changes | Next fetch cache 1 day, tag `job-categories` | Same for everyone |
| 04 contribution graph (A-4) | Server fetches **once a day** | Server: Next fetch cache 1 hour, tag `contrib:{login}` / month navigation: TanStack `staleTime 1h` | Same for everyone, doesn't change within a day |
| 23 README | Server cache 1 hour | TanStack `staleTime 1h` (loaded when expanded) | Same cycle as server cache |
| 30 My stats | Views and recruiter views aggregated once a day | TanStack `staleTime 1h` | Differs per person → no Next cache |
| 11 Progress | Snapshots once a day, today's values from issue status | TanStack `staleTime 60s`; `invalidateQueries` when issue status changes (12, 14) | Differs per team |
| 17 AI summaries left | 10 per person per day | TanStack, `invalidateQueries` after a successful summary | Server is the source |
| 04/33 Recruiting offers left today | 10 per day (Scout 50) | TanStack, invalidated after sending an offer | Server is the source |
| 11 Pull-to-refresh issues | Once a minute | Button disabled for the remaining time (`aria-disabled` + seconds remaining) | Matches the server limit |
| Feed, posts, recruit posts, chat, notifications | Change often | TanStack defaults (`staleTime 30s`); realtime STOMP updates the cache | Differs per person |
| Feed job ads | Server counts 3 per person per day, same ad once a day | Arrives only inside the feed response, so not cached separately. Close/hide removes the item from the feed cache immediately (optimistic); undo puts it back | Differs per person |

### 9-2. Next cache only for "cookie-less public data"

```ts
// src/lib/api/public-cached.ts — server only
import 'server-only';
export function getContributions(login: string, month: string) {
  return fetch(`${API_BASE_URL}/api/v1/public/users/${login}/contributions?month=${month}`, {
    cache: 'force-cache',
    next: { revalidate: 60 * 60, tags: [`contrib:${login}`] },   // no cookie → same response for everyone
  }).then(parseJson<ContributionMonth>);
}
```

- Requests with cookies (responses that differ per viewer) never go into the Next cache. TanStack Query handles that data.
- This project does NOT enable `cacheComponents` (`'use cache'`) in the MVP. Enabling it adds the rule that every cookie-reading area must be wrapped in `Suspense`, which is a big burden for a 2-week schedule. The fetch-level cache above is enough.
- After actions that change cached public data, like profile edit (05), invalidate the tag through a Route Handler `POST /api/revalidate` (checks a server secret). Follow the installed Next version's docs for the tag invalidation function's arguments (16 uses `revalidateTag(tag, 'max')`).

### 9-3. TanStack Query defaults

```ts
// src/lib/api/query-client.ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true },
  },
  queryCache: new QueryCache({ onError: handleApiError }),
  mutationCache: new MutationCache({ onError: handleApiError }),
});
```

- The server-side `getQueryClient()` is created fresh per request (React `cache()`); the browser reuses one.
- When the app returns from background, the bridge `APP_STATE` calls `focusManager.setFocused(true)` to refetch (11-3).
- Likes, follows and board moves are optimistic updates, rolled back on failure (04 Policy "Network and failures").

---

## 10. Image optimization

### 10-1. Install and config

```bash
pnpm --filter web add sharp
```

- Vercel uses its own image optimization, but sharp is used by local `next start`, self-hosting and build checks. With pnpm 10, `sharp` must be in `onlyBuiltDependencies` from ch. 2.

```ts
// next.config.ts
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [
    { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    { protocol: 'https', hostname: process.env.NEXT_PUBLIC_IMAGE_HOST! },   // upload storage (photos uploaded via presigned URL)
  ],
  deviceSizes: [360, 414, 640, 768, 1024, 1280],
  imageSizes: [24, 32, 40, 48, 64, 96, 128, 256],
},
```

### 10-2. Usage

| Image | Rule |
| --- | --- |
| Post cover photo (feed card) | `sizes="(min-width: 640px) 600px, 100vw"`; only the first card on the first screen gets `preload` (`priority` on Next 15 or lower) |
| Post detail gallery | First image `preload`, rest lazy, fixed ratio (`fill` + parent `aspect-[4/3]`) |
| Avatar | Fixed `width`/`height` (24–96). For GitHub avatars add the `?s=` size param to fetch a small original |
| Chat photo | Thumbnail `sizes="240px"`, large size in the fullscreen viewer |
| GIF | Next doesn't optimize animated GIFs, so render the server-made **first-frame still** with `Image`, play the original on tap (04 Policy) |
| Logo, icons | SVG components (lucide-react). Not `Image` |

- `alt`: describe photos that carry information; avatars with a name text right next to them get `alt=""` (so the same thing isn't read twice). Post photos have no input field; alt is auto-set to `"{project (repo) name} 이미지"` ("image") (e.g. `alt="Linker 이미지"`). With 2+ photos, append the order to tell them apart, like `"Linker 이미지 2"` (decided 2026-10-29).
- To avoid layout shift, images of unknown size use `fill` + a fixed-ratio parent.

### 10-3. Exceptions

- External images inside markdown in issue bodies and READMEs have unknown domains, so they can't go into `remotePatterns`. Render `react-markdown`'s `img` as `<img loading="lazy" decoding="async">` and keep the `alt` as is. `<img>` is allowed only here, with an ESLint exception for that file only.

---

## 11. Hybrid rules on the web (Next.js) side

### 11-1. SSR guards — browser APIs

| Situation | Method |
| --- | --- |
| Inside event handlers | Fine as is (never runs on the server) |
| Once after mount | Inside `useEffect` |
| Render output depends on a browser value (in app or not, screen width, online status) | `useSyncExternalStore` + `getServerSnapshot` (fixed server value), or render after `useIsClient()` |
| Plain functions (utils) | `if (typeof window === 'undefined') return …` guard |
| Module top level | **NEVER** (code like `const ua = navigator.userAgent`) |

```ts
// src/lib/browser/safe-storage.ts
export const safeStorage = {
  get(key: string) {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(key); } catch { return null; }   // private mode, webview restrictions
  },
  set(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};
```

- Rendering different markup by branching on `typeof window` during render causes hydration errors. Branch renders only with the third row's method.
- Stores using Zustand `persist` (draft autosave, etc.) are created with `skipHydration: true` and call `rehydrate()` in `useEffect`.
- Relative time ("N분 전" = N min ago) mismatches on hydration because server and browser clocks differ. `<RelativeTime>` (client) renders an absolute date on the server and switches to relative time after mount.
- **Time zone**: Vercel servers run in UTC. All date display, "today" and calendar calculations use `TZDate(…, 'Asia/Seoul')` from `@date-fns/tz` (`src/lib/format/time.ts`).
- Don't create the STOMP client at module top level; get the singleton in `useEffect`.

### 11-2. Bridge message contract (`packages/bridge`)

Web and app import the same types and zod schemas. A message is a single JSON string.

```ts
// packages/bridge/src/messages.ts
export const BRIDGE_VERSION = 1;

/** web → app */
export type WebToNative =
  | { type: 'READY' }                                                          // the web has attached its listener
  | { type: 'BACK_RESULT'; id: string; handled: boolean }                      // reply to BACK_PRESSED
  | { type: 'EXIT_APP' }
  | { type: 'AUTH_GITHUB_START'; id: string; authorizeUrl: string }            // log in via the system browser
  | { type: 'AUTH_SESSION_SAVE'; session: { userId: string; userType: 'DEVELOPER' | 'RECRUITER' } }
  | { type: 'AUTH_SESSION_CLEAR' }                                             // logout, account deletion
  | { type: 'SHARE'; id: string; title: string; text?: string; url: string }
  | { type: 'PUSH_PERMISSION_REQUEST'; id: string }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'HAPTIC'; style: 'light' | 'success' | 'error' };

/** app → web */
export type NativeToWeb =
  | { type: 'BACK_PRESSED'; id: string }
  | { type: 'RESULT'; id: string; ok: true; payload?: unknown }
  | { type: 'RESULT'; id: string; ok: false; error: string }
  | { type: 'PUSH_TOKEN'; token: string; platform: 'ios' | 'android' }
  | { type: 'DEEP_LINK'; path: string }                                        // when a push notification is tapped
  | { type: 'APP_STATE'; state: 'active' | 'background' };

export type Envelope<T> = { v: typeof BRIDGE_VERSION; source: 'linker'; msg: T };
```

- **Login tokens never cross the bridge.** Per 07 TODO 00, the JWT is an httpOnly cookie that web JS can't read either. The webview's cookie store keeps the session (iOS: `sharedCookiesEnabled`). The app stores only the user id and type from `AUTH_SESSION_SAVE` (to know who the push token is registered to, and to delete the token on logout), in SecureStore. Reasons and alternatives in ch. 15.

### 11-3. Web-side implementation

```ts
// src/lib/bridge/native-bridge.ts
'use client';
declare global { interface Window { ReactNativeWebView?: { postMessage(data: string): void } } }

export const isInApp = () => typeof window !== 'undefined' && !!window.ReactNativeWebView;

/** web → app. Uses window.ReactNativeWebView.postMessage injected by the webview (false in a browser) */
export function postToNative(msg: WebToNative): boolean {
  if (!isInApp()) return false;
  window.ReactNativeWebView!.postMessage(JSON.stringify({ v: BRIDGE_VERSION, source: 'linker', msg }));
  return true;
}

/** Requests that need a reply: wait for RESULT by id (5-second timeout) */
export function requestNative<T>(msg: Omit<Extract<WebToNative, { id: string }>, 'id'>): Promise<T> { /* … */ }
```

- App → web messages are sent by the app running `window.dispatchEvent(new MessageEvent('message', { data }))` through `injectJavaScript`. The web listens only to `window`'s `message` event and handles only messages that pass `source === 'linker'` and zod validation.
- The share button on posts, recruit posts and profiles opens Linker's `ShareSheet` ("링크 복사" Copy link / "채팅방에 공유" Share to chat room) in both app and browser. Copy link uses `navigator.clipboard.writeText`; if the webview blocks it, the bridge `SHARE` opens the device share sheet. Otherwise the bridge `SHARE` is used for sharing team invite links (09).
- In a browser (outside the app) the same features use web APIs instead: invite link sharing → `navigator.share` → copy link if unavailable; external links → new tab + external-link confirm sheet; push → guidance only (no web push).

What `NativeBridgeProvider` (inside `providers.tsx`, client) does:

| Message received | Handling |
| --- | --- |
| `BACK_PRESSED` | ① If an overlay is open, `close()` then `BACK_RESULT handled: true` ② otherwise `handled: false` (the app decides between webview back and exit) |
| `DEEP_LINK` | `router.push(path)` for same-origin paths only |
| `PUSH_TOKEN` | `POST /api/v1/user/push-tokens` (18, Android app only) |
| `APP_STATE` | When `active`: TanStack `focusManager.setFocused(true)`, check STOMP reconnection |

- Send `READY` on mount. Send `AUTH_SESSION_SAVE`/`AUTH_SESSION_CLEAR` on login/logout.
- **GitHub login (in app)**: "GitHub로 시작" (Start with GitHub) → `GET /api/v1/public/auth/github/authorize-url?client=app` → `AUTH_GITHUB_START` → the app opens it in the system browser; when it returns via `linker://auth?code&state`, the app opens `/auth/callback?code&state` in the webview → the web calls `POST /api/v1/public/auth/github/callback` (cookie saved in the webview) → `router.replace(returnTo)`. If the callback page was opened in the system browser with `client=app`, it doesn't exchange the code and immediately hands off to `linker://auth?…`.

---

## 12. App (React Native, Expo) structure

### 12-1. Folders

```
apps/mobile/
├── app.config.ts                 # scheme: 'linker', web URL env var, push config
└── src/
    ├── app/                      # Expo Router — only one screen, index
    │   ├── _layout.tsx
    │   └── index.tsx             # <LinkerWebView />
    ├── webview/
    │   ├── linker-webview.tsx    # WebView config, onMessage → bridge.dispatch
    │   ├── navigation-policy.ts  # only our domain stays in the webview, everything else goes to the system browser
    │   └── use-android-back.ts   # hardware back → BACK_PRESSED
    ├── bridge/
    │   ├── dispatcher.ts         # origin check → zod validation → handler per type
    │   ├── send-to-web.ts        # delivers NativeToWeb via injectJavaScript
    │   └── handlers/
    │       ├── auth.ts           # AUTH_GITHUB_START, AUTH_SESSION_SAVE/CLEAR
    │       ├── share.ts          # SHARE
    │       ├── push.ts           # PUSH_PERMISSION_REQUEST, notification tap → DEEP_LINK
    │       ├── navigation.ts     # BACK_RESULT, EXIT_APP
    │       ├── external.ts       # OPEN_EXTERNAL
    │       └── haptic.ts
    └── lib/
        ├── secure-store.ts       # wraps expo-secure-store
        └── config.ts             # WEB_ORIGIN, allowed origins
```

### 12-2. Handler structure

```ts
// src/bridge/dispatcher.ts
import { envelopeSchema, type WebToNative } from '@linker/bridge';

type Ctx = { send: (msg: NativeToWeb) => void; webview: RefObject<WebView>; state: BridgeState };
type Handlers = { [K in WebToNative['type']]: (msg: Extract<WebToNative, { type: K }>, ctx: Ctx) => void | Promise<void> };

const handlers: Handlers = {
  READY: (_, ctx) => { ctx.state.webReady = true; flushPending(ctx); },     // deliver deep links received during cold start
  BACK_RESULT: navigation.onBackResult,
  EXIT_APP: navigation.exitApp,
  AUTH_GITHUB_START: auth.startGithub,
  AUTH_SESSION_SAVE: auth.saveSession,
  AUTH_SESSION_CLEAR: auth.clearSession,
  SHARE: share.open,
  PUSH_PERMISSION_REQUEST: push.requestPermission,
  OPEN_EXTERNAL: external.open,
  HAPTIC: haptic.play,
};

export function createDispatcher(ctx: Ctx) {
  return async (event: WebViewMessageEvent) => {
    if (!isAllowedOrigin(event.nativeEvent.url)) return;                    // only from our web origin
    const parsed = envelopeSchema.safeParse(safeJson(event.nativeEvent.data));
    if (!parsed.success) return;                                            // ignore unknown messages
    const { msg } = parsed.data;
    try { await handlers[msg.type](msg as never, ctx); }
    catch (e) { if ('id' in msg) ctx.send({ type: 'RESULT', id: msg.id, ok: false, error: String(e) }); }
  };
}
```

```tsx
// src/webview/linker-webview.tsx
<WebView
  ref={webviewRef}
  source={{ uri: initialUrl }}
  onMessage={dispatch}
  originWhitelist={[WEB_ORIGIN]}
  onShouldStartLoadWithRequest={navigationPolicy}     // external domain → Linking.openURL, false
  sharedCookiesEnabled                                 // iOS: keep session cookies
  applicationNameForUserAgent="LinkerApp/1"            // lets the server and proxy recognize app requests
  allowsBackForwardNavigationGestures                  // iOS swipe back
  pullToRefreshEnabled={false}                         // pull-to-refresh is done per screen on the web (11 issue list)
  onContentProcessDidTerminate={() => webviewRef.current?.reload()}
/>
```

### 12-3. What each handler does

| Message | What the app does |
| --- | --- |
| `AUTH_GITHUB_START` | `WebBrowser.openAuthSessionAsync(authorizeUrl, 'linker://auth')` → on success, navigate the webview to `/auth/callback?code&state` → `RESULT ok`. On cancel, `RESULT ok:false 'cancelled'` |
| `AUTH_SESSION_SAVE` | Save `{ userId, userType }` in SecureStore → if push permission is already granted, send the token again as `PUSH_TOKEN` |
| `AUTH_SESSION_CLEAR` | Clear SecureStore; tell the web the registered push token so the server deletes it (`DELETE /push-tokens/{token}`) |
| `SHARE` | `Share.share({ message, url })` → `RESULT` |
| `PUSH_PERMISSION_REQUEST` | `expo-notifications` permission request → if granted, Expo push token → `RESULT { status }` + `PUSH_TOKEN`. iOS needs a paid Apple developer account, so it is out of the MVP; Android app only (07 TODO 18) |
| Notification tap (app listener) | `path` from notification data → if the web hasn't sent `READY` yet, hold it, then `DEEP_LINK` |
| `OPEN_EXTERNAL` | `Linking.openURL` for `https` only |
| Hardware back | Send `BACK_PRESSED` → if `BACK_RESULT handled:false`, then `webview.canGoBack ? goBack() : exit on second press within 2 seconds ("한 번 더 누르면 종료돼요" = press again to exit)`. Same decision if there's no reply within 300ms |
| `EXIT_APP` | Android `BackHandler.exitApp()`; ignored on iOS |
| App state change | `AppState` → `APP_STATE` |

- `canGoBack` uses the stored value from `onNavigationStateChange` (includes the web's pushState history).
- Don't build screens outside the webview. Error and offline screens are drawn by the web too; only when the web can't load at all is there a single native "다시 시도" (Try again) screen.

---

## 13. Folder structure double-check — compared with existing docs

### 13-1. Comparison table for all 33 pages

Each page was matched against the 07 TODO paths, the 04 Policy access table and the 09 WBS controllers, using this doc's groups. **All 33 paths match 07 TODO, and no new URLs were created.**

| # | Path (07) | Group | Guest / Developer / Recruiter / Operator (04) | Controller (09) · orval tag | OK |
| --- | --- | --- | --- | --- | --- |
| 01 | `/`, `/auth/callback` | (auth) | ○ / →feed / →feed / →feed | LoginController · p01 | ✓ |
| 02 | `/onboarding` | (developer) | × / ○ / × / ○ | OnboardingController · p02 | ✓ |
| 03 | `/legal/[slug]` | (public) | ○ everyone | LegalController · p03 | ✓ |
| 04 | `/u/[login]` | (public) + `_views` | view / ○ / view + offer, my page / ○ | ProfileController · p04 | ✓ |
| 05 | `/settings/profile` | (member) + `_views` | × / ○ / ○ / ○ | ProfileEditController · p05 | ✓ |
| 06 | `/settings` | (member) + `_views` | × / ○ / ○ / ○ | SettingsController · p06 | ✓ |
| 07 | `/workspace` | (developer) | prompt / ○ / × / ○ | WorkspaceController · p07 | ✓ |
| 08 | `/teams/new`, `/teams/new/callback` | (developer) | prompt / ○ / × / ○ | TeamCreateController · p08 | ✓ |
| 09 | `/teams/[id]/settings` | (developer) | × / team role / × / ○ | TeamSettingsController · p09 | ✓ ※1 |
| 10 | `/invite/[code]` | (public) | preview / ○ / × message / ○ | InviteController · p10 | ✓ |
| 11 | `/teams/[id]/issues` | (developer) | × / team member / × / ○ | IssueListController · p11 | ✓ ※1 |
| 12 | `/teams/[id]/issues/[issueId]` | (developer) | 〃 | IssueDetailController · p12 | ✓ ※1 |
| 13 | `/teams/[id]/issues/new` | (developer) | 〃 | IssueCreateController · p13 | ✓ ※1 |
| 14 | `/teams/[id]/board` | (developer) | 〃 | BoardController · p14 | ✓ ※1 |
| 15 | `/teams/[id]/calendar` | (developer) | 〃 | CalendarController · p15 | ✓ ※1 |
| 16 | `/chats` | (member) | prompt / ○ / personal tab / ○ | ChatListController · p16 | ✓ |
| 17 | `/chats/[roomId]` | (member) | × / ○ / personal only / ○ | ChatRoomController · p17 | ✓ ※1 |
| 18 | `/notifications` | (member) | prompt / ○ / ○ / ○ | NotificationController · p18 | ✓ |
| 19 | `/recruits` | (public) | view / ○ / view / ○ | RecruitListController · p19 | ✓ |
| 20 | `/recruits/new`, `/recruits/[id]/edit` | (developer) | prompt / ○ / × / ○ | RecruitEditorController · p20 | ✓ |
| 21 | `/recruits/[id]` | (public) | view / ○ / view / ○ | RecruitDetailController · p21 | ✓ |
| 22 | `/posts/new`, `/posts/[id]/edit` | (developer) | prompt / ○ / × / ○ | PostEditorController · p22 | ✓ |
| 23 | `/posts/[id]` | (public) | view / ○ / view + offer / ○ | PostDetailController · p23 | ✓ |
| 24 | `/feed` | (public) | view / ○ / view / ○ | FeedController · p24 | ✓ |
| 25 | `/admin/reports` | (admin) | × / × / × / ○ | AdminReportController · p25 | ✓ ※2 |
| 26 | `/admin/users` | (admin) | 〃 | AdminUserController · p26 | ✓ |
| 27 | `/admin/audit` | (admin) | 〃 | AdminAuditController · p27 | ✓ |
| 28 | `/subscribe`, `/subscribe/success`, `/subscribe/fail` | (member) | prompt / ○ Pro·Flex / ○ Scout / ○ | SubscribeController · p28 | ✓ |
| 29 | `/settings/subscription` | (member) | prompt / ○ / ○ Scout / ○ | SubscriptionManageController · p29 | ✓ |
| 30 | `/me/stats` | (developer) | prompt / ○ / × / ○ | StatsController · p30 | ✓ |
| 31 | `/recruiter/signup` | (auth) | ○ / × / →feed / × | RecruiterSignupController · p31 | ✓ |
| 32 | `/recruiter/login`, `/recruiter/reset` | (auth) | ○ / × / →feed / × | RecruiterLoginController · p32 | ✓ |
| 33 | `/recruiter/offers` | (recruiter) | × / × / ○ / × | RecruiterOfferController · p33 | ✓ ※4 |

("prompt" = login-prompt sheet.)

- ※1 Guest "×" handling: 04 said "URL is blocked" while 07 TODO 00 said "other URLs get the login-prompt sheet + returnTo". A logged-out team member who receives an issue link must return to that issue after login, so **04 Policy was aligned to this handling (2026-10-29).** For logged-in users, "×" sends them to `/feed`.
- ※2 The `/admin` entry OTP has no separate URL; it's a gate screen inside `(admin)/admin/layout.tsx` (same as 07 TODO 25, no new URL).
- ※3 Groups may differ even when URL prefixes are the same (final URLs don't overlap). `/recruits`, `/posts` and `/recruiter` span two groups. 28 and 29 moved from (developer) to (member) because recruiters now also pay for Scout (formerly Recruiter) (2026-10-30).
- ※4 The recruiter my page has no new URL; it's `_views/recruiter-my-page-view.tsx` of `/u/[login]` (same as 07 TODO 04 "recruiter side").

### 13-2. Mismatches (decide whether to fix existing docs)

| # | Where | What | Handling in this doc | Proposal |
| --- | --- | --- | --- | --- |
| ① | 07 TODO 00 "Access guard" | `/recruiter/*` was among URLs guests can open, but 04's table says 33 `/recruiter/offers` is × for guests | Only `/recruiter/signup`, `login`, `reset` are open | **Applied (2026-10-29)**: fixed 07 TODO 00 |
| ② | 04 Policy ch. 2 vs 07 TODO 00 | Guest entering a × URL (09, 11–15, 17) directly: 04 "blocked" / 07 "login prompt + returnTo" | Follows 07 (login prompt) | **Applied (2026-10-29)**: handling rule added above the 04 table |
| ③ | 07 TODO 00, 09 WBS ch. 3 | "Access guard (middleware)" | In Next 16 it's `proxy.ts` (rename only) | **Applied (2026-10-29)**: wording fixed in 07 and 09 |
| ④ | 07 TODO 22, 04 Policy ch. 4, 08 ERD | No **alt text** input for post photos (accessibility) | **Decided (2026-10-29)**: no input field, auto text `"{repo name} 이미지"` (10-2) | No change to existing docs |
| ⑤ | 09 WBS 00 `AuthSessionController` | JWT claims for `proxy.ts` (`typ`, `adm`, `onb`, `st`) were not defined | Written in ch. 15 | **Applied (2026-10-29)**: claims and reissue rules added to the 09 WBS 00 A task |
| ⑥ | 04 Policy POL-A-9 | User's "care about SEO" conflicted with the MVP's "noindex on every page" | **Decided (2026-10-29)**: index developer profiles, posts, recruit posts (8-1) | Applied to 04 POL-A-9 and 06 Privacy Policy (third-party provision exception 1). Added `SitemapController` and bot limits to 09 WBS 00 |

---

## 14. Page completion checklist (before a PR)

- [ ] Built in the group and URL from the ch. 13 table. There is a rule in `route-access.ts`
- [ ] No `'use client'` in `page.tsx` or `layout.tsx`. Client components only at the leaves
- [ ] Every split component has one reason from 5-3
- [ ] One each of `header`, `main` and main-menu `nav`; one `h1`; no skipped heading levels
- [ ] Every button and input has an accessible name. Icon buttons have `sr-only` text
- [ ] Overlays open via `useOverlay`. Open → back → stay on the page; open → X → back → previous page (the sheet does not reopen)
- [ ] Completion and callback navigation uses `router.replace`
- [ ] Has `metadata` or `generateMetadata` (unique `title`)
- [ ] Images use `next/image` + `alt` + `sizes`
- [ ] No `window`, `document` or `localStorage` access during render. No hydration warnings in `pnpm build`
- [ ] Opened as a guest: reading works, actions show the login-prompt sheet
- [ ] Also opened with recruiter and developer seed accounts (pages seen by more than one role)
- [ ] No horizontal scroll at 360px width. Every action works with keyboard only
- [ ] Zero violations in Vitest + vitest-axe (components) and Playwright + axe (pages)
- [ ] Numbers come from `policy.ts`

---

## 15. To align with the backend and other docs

- **JWT claims** (applied to the 09 WBS 00 A task; reissue the cookie on onboarding completion, suspension, unsuspension and operator assignment): `sub` (user id), `typ` (`DEVELOPER`/`RECRUITER`), `adm` (is operator), `onb` (onboarding done), `st` (`ACTIVE`/`SUSPENDED`/`PENDING_DELETION`). Signed with an asymmetric key (RS256 etc.); the web holds only the public key. The cookie uses the parent domain (`Domain=.<domain>`) so both `app.` and `api.` can read it, `HttpOnly; Secure; SameSite=Lax`.
- **CORS**: the `api.` domain allows `credentials: true` for the `app.` origin. The STOMP handshake authenticates with the same cookie.
- **orval tags**: `@Tag(name = "pNN-…")` per controller (09 WBS 1-3, item 6). The tag name becomes the frontend file name, so renaming it breaks frontend imports.
- **App login token**: the user's request "save the login token" has a slot in the bridge as `AUTH_SESSION_SAVE`, but **the JWT itself is never passed** (to match the httpOnly cookie decision). If iOS webview cookies actually disappear during a demo, extend it then by adding two "issue/exchange app-only recovery token" APIs to 01 `LoginController` and storing it in SecureStore (not in 09 WBS yet).
- **GitHub App callback URLs**: register two in the GitHub App settings: web (`/auth/callback`) and app (`/auth/callback?client=app` or a separate callback URL).
- **Search exposure (8-1)**: ① Sitemap lists come from `SitemapController` in 09 WBS 00 (`GET /api/v1/public/sitemap/{kind}?page=`, owner B, D10). ② The guest-read limit of 60 per minute per IP has a separate limit for Googlebot and Yeti verified by reverse DNS (09 WBS 00 A task, 04 Policy rate limits).
- **Push tokens**: use 18's `POST/DELETE /api/v1/user/push-tokens` as is.
- **Ad items in the feed response** (09 WBS 24): feed `items` is the union `{ type: 'POST', … } | { type: 'AD', adId, companyName, title, jobCategory, closesOn }`. Ad items carry no URL; on tap, `POST /api/v1/user/ads/{adId}/click` returns the URL (records the click + prevents link scraping). Open the returned URL with the confirm sheet from `features/external-link`.
- **Image storage domain**: `NEXT_PUBLIC_IMAGE_HOST` (ch. 10) and GIF first-frame generation go into the resize/EXIF-strip work of 00 `UploadController`.
