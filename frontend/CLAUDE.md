@10-frontend-blueprint.md

# Linker frontend

The blueprint above is the full rulebook (`MUST` / `NEVER` are absolute, `RECOMMENDED` needs judgment). This file is the short version to check every time, plus where to look before starting. Project overview and doc consistency rules are in the root `../CLAUDE.md`.

## Before working on a page

1. Find the page's route group, folder and orval tag in blueprint ch. 13.
2. Read the same page number in `../docs/07-page-todo.md` (screen contents, `[Required]` / `[Included]`, sheets).
3. Read the matching rules in `../docs/04-policy.md`: ch. 2 "Access by role" for who can open it, the feature chapter for limits, states and exceptions, ch. 12 for UI copy.
4. Read the feature's completion conditions in `../docs/02-prd.md` ch. 5 (feature IDs are listed on the 07 page).
5. Check the page's controller and endpoints in `../docs/09-wbs.md` ch. 4 (same page number). The orval hook file is named after that controller's tag.
6. Before any page: the foundation in blueprint §1-1 must exist and the "end-of-D2 check" must pass. If the foundation lacks something, add it there, never an ad-hoc version in the page.
7. Finish with the blueprint ch. 14 checklist.

## Core rules (summary of the blueprint)

**App Router & colocation (ch. 2, 3)**
- Next.js 16 App Router, React 19, TypeScript strict. Pages live in role groups: `(auth)` `(public)` `(member)` `(developer)` `(recruiter)` `(admin)`. Same URL for several roles → `_views/` per role.
- Code used by one page sits in that page's `_components` / `_hooks` / `_lib` / `_views`. Two pages → nearest common folder. Across role groups → `src/features/<domain>/`. `src/components/` is domain-free only (`ui/`, `layout/`, `overlay/`).
- kebab-case file names, one exported PascalCase component per file, tests next to the target (`*.test.tsx`).
- Access rules live only in `src/lib/auth/route-access.ts` (read by `proxy.ts` and group layouts). The Spring API does the real permission check.

**Server components are the parent (ch. 5)**
- `page.tsx` and `layout.tsx` are server components; `'use client'` is NEVER in them. Client components are the smallest leaves that need state, events, browser APIs or realtime.
- Prefetch on the server, client TanStack Query hooks take over. Props to client components are serializable (dates as ISO strings).
- Split a component only for a reason listed in §5-3.
- Call APIs only through orval hooks/functions (`packages/api`, never edited by hand). No direct `fetch('/api/v1/...')` outside `src/lib/api/`.
- State: server data = TanStack Query, URL state (tabs, filters, overlays) = nuqs, other UI state = Zustand.

**Accessibility & semantic markup (ch. 6)** — WCAG 2.2 AA / KWCAG 2.2
- Per page: one `header`, one `main`, one main-menu `nav` (via `PageFrame`), exactly one `h1`, no skipped heading levels, "본문 바로가기" skip link. Other `nav`s need an `aria-label`.
- `<button>` for actions, `<Link>` for navigation; `div onClick` is NEVER allowed. Lists are `ul > li > article`; times are `<time>`; follow the element table in §6-2.
- Every input has a visible `<label>`; errors use `aria-invalid` + `aria-describedby`; focus the first invalid field on submit failure.
- Icon-only buttons get `sr-only` text. Toggles use `aria-pressed`. Never signal state by color alone.
- Contrast 4.5:1 (text) / 3:1 (large text, icons). Never remove the `focus-visible` ring. Touch targets ≥ 44×44px. Drag actions have a button alternative. `MotionConfig reducedMotion="user"`. Never block zoom.

**Mobile first (§6-6)**
- Base classes target 360px; widen with `sm:` `md:` `lg:`. App screens keep `max-w-screen-sm`; only admin goes two-column at `lg`.
- `100dvh`, safe-area padding on bottom tabs and input bars, inputs ≥ 16px font, no hover-only UI.

**Overlays never trap back navigation (ch. 7)**
- Bottom sheets, modals, drawers and the photo viewer open only through `useOverlay()`; never a sheet opened with plain `useState`.
- One URL param `overlay` (+ `oid`). Push only on first open; opening another overlay replaces; closing undoes our push with `history.back()`, or removes the param with `replace` if it came from a URL. NEVER push while closing.
- Navigating out of an overlay uses `closeThen(href)`. No Intercepting/Parallel Routes for modals.
- Callback and completion screens (login callback, onboarding done, team creation callback, payment success/fail, finished writing) move on with `router.replace`. The top-bar back uses `useAppBack()`.

**Images (ch. 10)**
- `next/image` only, with `alt` and `sizes`; `<img>` is NEVER allowed except external images inside user markdown (§10-3). `sharp` is installed and listed in `onlyBuiltDependencies`.
- Post photos get auto alt `"{repo name} 이미지"` (+ number when 2+). Avatars next to a visible name get `alt=""`. Unknown sizes use `fill` + a fixed-ratio parent.

**RN WebView environment (ch. 11, 12)**
- Browser APIs (`window`, `document`, `localStorage`) only in event handlers, `useEffect`, or behind a `typeof window` guard; never during render or at module top level. Use `safeStorage`, `useIsClient`, `useSyncExternalStore` for render-dependent browser values.
- Dates in KST via `@date-fns/tz` (`src/lib/format/time.ts`); Vercel servers run in UTC. `<RelativeTime>` avoids hydration mismatches.
- Web↔app messages use the shared types in `packages/bridge` (`postToNative`, `requestNative`, `NativeBridgeProvider`). The JWT never crosses the bridge; the app stores only `userId` / `userType`.
- Every screen is web. Native handles only GitHub login return, push (Android only in MVP), share, back button and external links.

**SEO & OG (ch. 8)**
- Every page has `metadata` or `generateMetadata` with a unique `title`, built with `buildMetadata()`. Default is `noindex`; only the pages in §8-1 pass `indexable: true`.
- Content-based previews exist only on post detail (23), recruit post detail (21), developer profile (04) and invite link (10). Everything else uses the root default (Linker + one-line intro + `/og-default.png`).
- Login-only screens NEVER put team names, issue titles or chat content into `title` or OG. Hidden, deleted or blocked content uses the default too.
- Canonical and `og:url` drop query params (`overlay`, `oid`, filters, `?from=share`).

**Caching (ch. 9)** — Next fetch cache only for cookie-less public data (legal, tech tags, plans, job categories, contribution graph); per-user data uses TanStack Query `staleTime` as in §9-1.

**Numbers** — character counts, limits and plan values come from `src/lib/policy.ts` (values from 04 Policy), never hard-coded.

## Doc links

The blueprint was written next to the other docs, so its links point to `./04-policy.md`, `./07-page-todo.md`, `./09-wbs.md`. In this repo those files are in `../docs/`. Read them there.
