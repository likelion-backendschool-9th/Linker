# Linker WBS

> Question this document answers: **Who builds which APIs and screens, and when?**
> Page numbers and screen work come from [07 Page TODO](./07-page-todo.md), tables from [08 ERD](./08-erd.md) 7-2, and numbers and exception rules from [04 Policy](./04-policy.md); those are the sources of truth. This document groups them as "one task = one page = one controller" and adds owners and dates.

## 0. At a glance

- **Assumptions**: 5 people, 2 weeks (10 weekdays, D1–D10), two repos: Spring Boot backend (Gradle) and Next.js frontend (pnpm monorepo), Toss Payments test mode, no store release.
- **Work unit**: pages 00–33 of the 07 TODO. One backend controller per page (1:1). Only 00 common foundation is not a page, so it has 7 common controllers.
- **Ownership**: one person owns both frontend and backend of their pages (07 TODO ch. 11 assumption), so "controller owner = page owner". If roles split into frontend/backend, two people pair on a page and the controller owner becomes the backend person.
- **Size**: 40 controllers (33 pages + 7 common), 204 REST endpoints, 5 realtime paths (1 WebSocket connection endpoint + 4 STOMP destinations), 69 tables (2026-10-30: feed job ads added 8 endpoints and 4 tables. The same day's subscription revamp added 3 endpoints for the progress graph and share cards, removed the recruit post bump endpoint, and added 1 table. No new controller).
- **Marks**: `[Required]` / `[Included]` are the same as the 07 TODO. `[Included]` is the first to be deferred if the schedule slips.

### The five owners

| Owner | Area | Pages |
| --- | --- | --- |
| A | Accounts & recruiting | 01, 02, 03, 04, 05, 06, 25, 31, 32, 33 |
| B | GitHub, teams, ops | 07, 08, 09, 10, 26, 27, 30 + PR posting in 17 |
| C | Issues | 11, 12, 13, 14, 15 + my issues in 07 + AI summary (Flex) in 17 + progress card (Flex) in 11 |
| D | Chat, notifications, subscription | 16, 17, 18, 28, 29 |
| E | Find Team & project posts | 19, 20, 21, 22, 23, 24 |

Changes from the initial 07 TODO assignment: 26 Ops: users moved from A, and 30 My stats from E, to B (A and E were each half a day to a day over). 04 second pass stays with A, the 04 controller owner. 07 TODO ch. 11 was updated to match.

---

## 1. API rules

### 1-1. URL shape: `/api/v1/{role}/{resources}`

**The role is "who may call this API".** There are only five, based on login method and member type, so that one role = one access rule line in Spring Security.

| Role | Who calls | Security rule | Example |
| --- | --- | --- | --- |
| `public` | Anyone, including logged-out. Read APIs of read screens (feed, posts, recruit posts, profiles) live here | `permitAll()` + optional auth (read as member if cookie present) + 60/min per IP (verified search engine bots get a separate limit) | `/api/v1/public/posts/{postId}` |
| `user` | Every logged-in member (developers + recruiters) | `authenticated()` | `/api/v1/user/posts/{postId}` |
| `recruiter` | Recruiters only (`user_type = RECRUITER`) | `hasRole("RECRUITER")` | `/api/v1/recruiter/offers` |
| `admin` | Operators only (`admins` table) | `hasRole("ADMIN")` | `/api/v1/admin/report-cases` |
| `webhook` | GitHub (signature verified) | `permitAll()` + signature filter | `/api/v1/webhook/github` |

**Mapping the four roles to URL roles**: from Policy ch. 2 "Access by role": guest → `public`, developer → `user` + `@DeveloperOnly`, recruiter → `user` + `recruiter`, operator → `admin` (developer account + `admins` row + OTP). How they're represented in the DB is in ERD ch. 1 "How roles are represented". Per-page access is defined by the Policy table; the controllers' permission column follows it.

**Guest reads (POL-A-9)**: Read APIs for feed, posts, recruit posts and profiles are `public`. With a cookie, the same API adds member info (my like, follow relation, my application status, block filter). So there are no separate guest APIs; one screen = one API. All writes and reactions are `user` or above; called logged-out they return 401 `LOGIN_REQUIRED` → the frontend shows the login-prompt sheet.

Two permissions the role can't express are checked with annotations, not URLs:

- **Developers only**: writes under `user` (follow, like, comment, posts, teams, recruiting, applying, Pro/Flex subscribing, closing/hiding job ads) are `@DeveloperOnly`. A recruiter calling them gets 403 `DEVELOPER_ONLY`. Built in 00 common foundation. Payments (28, 29) take plain `user` and the service checks that plan and member type match (PRO/FLEX for developers, SCOUT for recruiters).
- **In-team permissions**: `/api/v1/user/teams/{teamId}/...` uses `@TeamRole(MEMBER | ADMIN | OWNER)` to check team membership and role. A team is a resource, not a person's role, so it's not in the role slot of the URL.

### 1-2. Naming

- Role is singular (`user`, `admin`), resources are plural nouns (`posts`, `chat-rooms`), words joined with `-`.
- "Me" is `me`: `/api/v1/user/me/teams`, `/api/v1/recruiter/me/profile`.
- Only state-changing actions that don't fit CRUD get a verb sub-resource: `.../close`, `.../accept`, `.../read-all`.
- IDs are Linker ids. GitHub numbers (issue numbers, etc.) are never in URLs, because numbers collide across repos (07 TODO page 12 URL also changed to `[issueId]`).
- Lists use cursors: `?cursor=&size=20` → `{ items, nextCursor }`.

### 1-3. Page–controller 1:1 rules

1. **One page = one `@RestController`.** Named `{Page}Controller` (e.g. `IssueListController`), package with page number like `api.p11_issuelist`, so screen → code is immediate.
2. **Each endpoint has exactly one owning page.** If another page needs the same feature, it **borrows** the owner page's API instead of making a new one (e.g. board 14 drag calls issue detail 12's status API). Listed under "Borrowed APIs" in this document.
3. **Logic goes in domain services, not controllers.** Controllers only validate the request → call services → assemble the screen response. Services in domain packages (`domain.issue`, `domain.chat` …) such as `IssueService`, `ChatService`, `NotificationService` are shared by several page controllers. Entities and repositories also live in domain packages.
4. **Response DTOs belong to the page.** The same issue needs different fields as a list row (11) and a board card (14), so DTOs are separate. A screen change then doesn't break another page's response.
5. **STOMP goes in the same controller.** Chat room (17) `@MessageMapping` methods live in `ChatRoomController` (`@RestController` is a `@Controller`, so it can hold both).
6. **orval tag = controller name.** Put springdoc `@Tag(name = "p11-issue-list")` on each controller; orval then generates a hook file per page, so on the frontend "the APIs this page calls" sit in one file.

```
backend/src/main/java/com/linker/backend
├── BackendApplication.java
├── api                  # per-page controllers + request/response DTOs (1:1)
│   ├── common           # 00: 7 common controllers
│   ├── p01_login
│   ├── p11_issuelist
│   └── ...
├── domain               # domain services, entities, repositories (shared across pages)
│   ├── user, team, github, issue, chat, notification
│   └── recruit, post, feed, moderation, billing, recruiter
└── global               # security, exceptions, annotations (@DeveloperOnly, @TeamRole), config (PlanLimits)
```

The base package is `com.linker.backend`, matching the existing `BackendApplication`. Keep application packages below this base so Spring's default component and JPA scanning includes them. For example, page 11 uses `com.linker.backend.api.p11_issuelist`. Gradle's `group = 'com.linker'` is a separate build identifier and remains unchanged.

### 1-4. Common responses

- Success: body as-is (no wrapper); 201 for create, 202 for accepted async.
- Failure: `{ "code": "TEAM_MEMBER_LIMIT", "message": "팀 인원이 가득 찼어요", "detail": {...} }`. `code` is a fixed value for frontend copy and branching; `message` is the default Korean copy.
- Common codes: `LOGIN_REQUIRED` (login-prompt sheet), `UNAUTHORIZED`, `DEVELOPER_ONLY`, `TEAM_ROLE_REQUIRED`, `BLOCKED_RELATION`, `RATE_LIMITED` (with time remaining), `PLAN_LIMIT` (with which limit → subscription prompt sheet), `GITHUB_UNAVAILABLE`, `GITHUB_PERMISSION`, `SUSPENDED`.

---

## 2. Schedule

### 2-1. Day by person

Half-day (0.5) units. "→" = morning → afternoon.

| Day | A Accounts & recruiting | B GitHub, teams, ops | C Issues | D Chat, notif., subscription | E Find Team & posts |
| --- | --- | --- | --- | --- | --- |
| D1 | 00 auth, session, permissions → access table, `proxy.ts`, screen frame | 00 GitHub App, webhooks, deploy | 00 Projects spike → frontend `policy.ts`, formatters, SEO, image config | 00 STOMP, Redis | 00 monorepo, orval, API fetch function → `useOverlay` |
| D2 | 00 login-prompt sheet → 03 legal | 00 install callback spike → app bridge, Expo shell | 00 issue cache design → test setup (axe, MSW) | 00 NotificationService → STOMP client | 00 common sheets, uploader → report, block |
| D3 | 01 start/login | 07 → 08 | 11 | 16 → 17 | 19 |
| D4 | 02 → 06 | 08 | 11 → 12 | 17 | 20 |
| D5 | 04 (1st pass) | 09 (1st) → 10 | 12 | 17 | 21 |
| D6 | 05 → 25 | 09 (2nd) | 13 | 18 | 21 → 22 |
| D7 | 25 → 31 | 09 (2nd) → 17 PR posting | 13 | 17 1:1 & recruiting offers | 22 |
| D8 | 31 → 04 (2nd) | 26 | 14 | 28 | 23 |
| D9 | 32 → 33 | 27 → 30 | 15 → 07 my issues | 28 → 29 | 24 |
| D10 | 04/05 recruiter side + `[Included]` job ad server, sheet, job categories → demo, bugs | 00 sitemap API, `sitemap.ts` → sync hardening, demo | 17 AI summary (Flex) → `[Included]` 11 progress card → demo, bugs | `[Included]` 28/29 Scout plan → `[Included]` share sheet (00), 17 share cards and link cards → demo, bugs | `[Included]` 24 job ad card, close, hide → wire share buttons on 23/21/04 → demo, bugs |

### 2-2. Integration checks (milestones)

| When | Flow that must run end to end | Pages needed |
| --- | --- | --- |
| End of D2 | 6 spikes pass (WebView GitHub login, App install return, Projects Blocked + date fields, webhook receipt, STOMP reconnect, Toss confirm/cancel) + frontend foundation "end of D2 check" ([10 frontend blueprint §1-1](../frontend/10-frontend-blueprint.md#1-1-foundation-built-before-pages-the-most-important-work)) | 00 |
| End of D5 | Login → onboarding → create team → issue list/detail (GitHub sync) → team chat | 01, 02, 08, 11, 12, 16, 17 |
| End of D7 | Create issue → assignee notification; recruit → apply → accept → join team → project completion | 13, 18, 19–21, 09 (2nd) |
| End of D8 | Post project → detail like/comment → 1:1 chat, Pro checkout | 22, 23, 17 1:1, 28 |
| End of D9 | Feed; report → hide → action log; pay → cancel; recruiter sign-up → recruiting offer → sent offers list | 24–29, 31–33 |
| D10 | Whole 07 TODO demo checklist (including logged-out shared link → login prompt → return, `[Included]` Scout payment → job ad → feed showing → external posting, close, hide, `[Included]` post share → team chat room card, Flex progress card), mobile browsers and WebView app | All |

### 2-3. Heavy dependencies

- **If 08 Create team (B, D3–D4) is late**, 11–17 and 21 only run on seed data without a real team. That's why the install callback is finished first in the D1–D2 spike.
- **00 `NotificationService`, report and block (D, E, D2)** are called by almost every page, so their interfaces are frozen by end of D2.
- **17 team chat (D, D3–D5)** is awaited by 21 accept (joining team chat) and 12 "채팅에 공유" (Share to chat).
- **Before 31 recruiter sign-up (A, D7–D8)**, 17 recruiting offers and 33 are built with a seed account (`user_type = RECRUITER`) and wired to real sign-up on D9.
- **Job ads (A, D, E on D10)** land on the same day for three people. A freezes the `recruiter_ads` migration and the shape of the feed's ad item (`type: "AD"`) by end of D9; E builds the card against an MSW mock until then.

---

## 3. Common foundation 00 `[Required]` · D1–D2 · everyone

Not a page; 7 common controllers. Other pages borrow these APIs.

| Controller | Owner | Method | Path | Does | Permission |
| --- | --- | --- | --- | --- | --- |
| `AuthSessionController` | A | GET | `/api/v1/user/me` | Session member (type, status, onboarding step, suspension info) | user |
| | | POST | `/api/v1/public/auth/refresh` | Extend session cookie | public |
| `TechTagController` | A | GET | `/api/v1/public/tech-tags` | Tech stack tag list (sheets in 02, 05, 19, 20, 22) | public |
| | | GET | `/api/v1/public/job-categories` | `[Included]` Job category list (05 job categories of interest, 04 job ad sheet) | public |
| `UploadController` | E | POST | `/api/v1/user/uploads` | Issue presigned upload URL (type, 10MB check) | user |
| | | POST | `/api/v1/user/uploads/{fileId}/complete` | Upload complete → resize, strip EXIF | user |
| `ReportController` | E | POST | `/api/v1/user/reports` | Report (target type, id, reason; for chat, copy 10 before/after) | user |
| `BlockController` | E | GET | `/api/v1/user/me/blocks` | Blocked users list (06) | user |
| | | POST | `/api/v1/user/blocks` | Open a blocking period (idempotent while active) | user |
| | | DELETE | `/api/v1/user/blocks/{userId}` | Close the active blocking period; retain history for DM filtering | user |
| `GithubWebhookController` | B | POST | `/api/v1/webhook/github` | Verify signature → save `github_webhook_deliveries` → Redis queue | webhook |
| `SitemapController` | B | GET | `/api/v1/public/sitemap/{kind}?page=` | Search-indexable list (`kind` = `posts` / `recruits` / `users`, 50k per page, only id, URL values, updated time). Excludes hidden, deleted, suspended, pending withdrawal and recruiters; recruit posts only while open (04 Policy POL-A-9) | public |

**Tables (new)**: users, auth_identities, github_tokens, user_sessions, uploaded_files, notifications, user_blocks, report_cases, reports, github_webhook_deliveries, admins (seed)

**Tasks by person**

- [ ] **A** Separate members from login methods, `user_type`, JWT httpOnly cookie, GitHub token encryption, `@DeveloperOnly`, user status filter (block writes while suspended), activity log, configure the 5 Security roles
- [ ] **A** JWT claims: `sub` (member id), `typ` (`DEVELOPER`/`RECRUITER`), `adm` (is operator), `onb` (onboarding done), `st` (`ACTIVE`/`SUSPENDED`/`WITHDRAWING`). The frontend `proxy.ts` routes screens by these, so sign with an asymmetric key (RS256 etc.) and provide the public key to the frontend. Reissue the cookie on onboarding completion, suspension, unsuspension and operator assignment (so the next request sees the new values). Cookie on the parent domain so both `app.` and `api.` read it, `HttpOnly; Secure; SameSite=Lax`. Claims are only for screen routing; permissions are still checked by the server against the DB ([10 frontend blueprint](../frontend/10-frontend-blueprint.md) ch. 4 and ch. 15)
- [ ] **A** Frontend (D1): access table `route-access.ts`, `session.ts`, access guard `proxy.ts` (Next.js 16's former middleware; guests only on read URLs, POL-A-9), 6 role route groups and group `layout.tsx`, screen frame (`PageFrame`, 3 shells, bottom tab arrays, "본문 바로가기" skip link), header "로그인" (Log in) button, suspension banner — blueprint ch. 3, ch. 4, 6-1
- [ ] **A** Login-prompt sheet + `useRequireLogin()` hook (blocks guest actions in one place and stores `returnTo`), common handling of API 401 `LOGIN_REQUIRED`
- [ ] **A** Server: optional-auth filter on `public` paths, guest 60/min per IP. Googlebot and Naver Yeti get a separate limit only after reverse DNS confirms they're real bots (never trust User-Agent alone)
- [ ] **B** Register GitHub App (PRD ch. 8 permissions + Email addresses: read), webhook signature verification and queue, backend deploy (server, Postgres, Redis), smee tunnel
- [ ] **B** Spike: App install → return via Setup URL → verify with `GET /user/installations`
- [ ] **B** Frontend (D2): `packages/bridge` message types, web `NativeBridgeProvider`, Expo WebView shell (deep link `linker://auth`, `onMessage` handler, Android back) — blueprint ch. 11, ch. 12. App GitHub login return is aligned with A's 01
- [ ] **B** (D10) `SitemapController` + frontend `sitemap.ts` (split by kind, cached daily), sitemap URL in `robots.ts`. Exposure scope is 04 Policy POL-A-9; frontend rules are [10 frontend blueprint](../frontend/10-frontend-blueprint.md) ch. 8
- [ ] **C** Spike: create Projects board, Status Blocked, write start/due date fields, `projects_v2_item` webhook
- [ ] **C** Frontend (D1–D2): `policy.ts` (04 Policy numbers), formatters (KST, numbers, character counts), SSR guards (`safeStorage`, `useIsClient`), shared SEO helpers and `robots.ts`, `next/image` config + sharp, test setup (Vitest + vitest-axe, Playwright + axe, MSW) — blueprint ch. 8, ch. 10, 11-1, ch. 14
- [ ] **D** STOMP config, auth interceptor, reconnect, `NotificationService.create()`, Redis rate limit (`@RateLimit`), `PlanLimits`
- [ ] **D** Spike: Toss test-key checkout → confirm → cancel
- [ ] **D** Frontend (D2): STOMP client singleton and subscription hooks (`lib/realtime`) — blueprint 11-1
- [ ] **E** Common components (bottom sheet, confirm modal, toast, empty state, skeleton, `error.tsx`, `not-found.tsx`), sheet/modal open-close `useOverlay()` and `useAppBack()` (D1, blueprint ch. 7), common sheets (report, block, external link, delete confirm, limit notice, draft restore), image uploader
- [ ] **E** Report rules (one per person per target, temp hide at 5 distinct reporters), block filter for queries (shared by feed, profile, comments, 1:1 chat, applications). Store blocking periods in `user_blocks` (ERD ch. 4-8); unblock closes the period without deleting it. Current block lists use active rows; D uses all periods for DM visibility.
- [ ] **E** Frontend monorepo, orval, TanStack Query, Zustand, nuqs, API fetch function `api-fetch.ts` and shared error-code handling (D1 morning, others wait on it; blueprint ch. 2, 5-4), Vercel deploy
- [ ] **Everyone** Sentry; agree on OpenAPI tag rule (rule 6 in 1-3)
- [ ] **Everyone** Frontend mock data (until the backend is live): each page owner keeps their page's endpoints in `frontend/apps/web/src/mocks/pages/` in step with the endpoint list above, and compares field names with the real OpenAPI before removing the mock file (blueprint §1-2)

---

## 4. Work by page

Each page follows the same order: owner, schedule, prerequisites → controller and APIs → borrowed APIs → tables → backend (work outside endpoints) → frontend.

## 4-1. Login and my profile

### 01. Start / login `[Required]` · `/`, `/auth/callback`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D3 (1 day) | 00 | A-1 |

**`LoginController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/auth/github/authorize-url` | GitHub authorize URL + issue `state` (`client=web\|app`, `returnTo`) | public |
| POST | `/api/v1/public/auth/github/callback` | Exchange code → find/create member, refresh username → cookie. Response `{ isNew, restored, returnTo }` | public |

- Borrowed: `GET /api/v1/user/me` (if logged in, go to `/feed`)
- Tables: new banned_github_ids · shared users, auth_identities, github_tokens, user_sessions
- [ ] Server: auto-restore if within 30-day pending withdrawal, reject permanently banned GitHub ids, extend session 30 days
- [ ] Frontend: 3 intro blocks, "둘러보기" (Browse, `/feed` without login), "GitHub로 시작" (Start with GitHub; system browser in WebView), callback loading, `state` check, failure screen, "계정을 복구했어요" (Account restored) toast, `[Included]` "채용 담당자이신가요?" (Are you a recruiter?) link (after 31)

### 02. Onboarding `[Required]` · `/onboarding`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D4 morning (0.5 day) | 01 | A-1, A-2, A-3, H-4 |

**`OnboardingController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/onboarding` | Remaining steps + defaults loaded from GitHub | user |
| POST | `/api/v1/user/onboarding/agreements` | Age 14+, terms, privacy (required), marketing (optional) consent; store terms version | user |
| PUT | `/api/v1/user/onboarding/profile` | Save name, bio, blog, tech stack, looking for team, job-seeking status, then finish onboarding | user |
| PUT | `/api/v1/user/onboarding/email` | `[Included]` Entered only when no email came from GitHub | user |

- Borrowed: `GET /api/v1/public/tech-tags`, `GET /api/v1/public/legal-documents/{slug}` (03)
- Tables: new user_agreements, tech_tags (seed), user_tech_tags · shared users
- [ ] Server: store GitHub verified email (not shown), tech stack seed
- [ ] Frontend: stepped (terms → profile), resume where left off, tech stack sheet (max 10), job-seeking status picker component (reused in 05)

### 03. Legal documents `[Required]` · `/legal/[slug]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D2 afternoon (0.5 day) | 00 | MVP launch condition |

**`LegalController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/legal-documents` | Document list and current versions | public |
| GET | `/api/v1/public/legal-documents/{slug}` | `terms`, `privacy`, `community`, `recruiter-terms` body (Markdown), version, effective date | public |

- Tables: none (documents are server resource files; version compared at consent)
- [ ] Frontend: Markdown rendering, table of contents, effective date and version, contact email link

### 04. Profile `[Required]` · `/u/[login]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | 1st pass D5 (1 day), 2nd pass D8 afternoon (0.5 day), recruiter side D10 morning (incl. job ad sheet) | 02; 2nd pass 22; recruiter side 31; job ad 28 | A-2, A-4, A-5, A-6, P-5, P-7, C-4, H-7, S-10 |

**`ProfileController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/users/{login}` | Header (layout per member type), completion record, new username if changed. If logged in: follow relation, block check; "제안만 받기" (Offers only) shown to recruiters only | public |
| GET | `/api/v1/user/users/{login}/followers` | Followers sheet (people list, so login only) | user |
| GET | `/api/v1/user/users/{login}/followings` | Following sheet | user |
| POST | `/api/v1/user/users/{login}/follow` | Follow (200/day, notification) | user · developers only |
| DELETE | `/api/v1/user/users/{login}/follow` | Unfollow | user · developers only |
| GET | `/api/v1/public/users/{login}/contributions?month=` | `[Included]` One month of contribution graph + as-of time | public |
| GET | `/api/v1/public/users/{login}/posts` | 2nd pass: project posts (pinned first) | public |
| GET | `/api/v1/public/users/{login}/teams` | 2nd pass: teams (active, completed) | public |
| PUT | `/api/v1/user/me/pinned-posts` | 2nd pass `[Included]`: pin featured posts and order (free 1, Pro 5) | user · developers only |
| GET | `/api/v1/recruiter/me/ad` | `[Included]` My job ad (status, subscription state). Empty if none | recruiter |
| PUT | `/api/v1/recruiter/me/ad` | `[Included]` Register/edit job ad (job category, title, URL, closing date). Allowed-domain URL check, Scout subscription check, 10/day | recruiter |
| PATCH | `/api/v1/recruiter/me/ad/status` | `[Included]` Turn showing on/off (ACTIVE ↔ PAUSED) | recruiter |

- Borrowed: block/report (00), "메시지" (Message) / "채용 제안 보내기" (Send recruiting offer) → `POST /api/v1/user/chat-rooms/direct` / `POST /api/v1/recruiter/chat-requests` (17), recruiter my page summary → `GET /api/v1/recruiter/offers/summary` (33)
- Tables: new follows, 🟡 contribution_days, 🟡 username_redirects, 🟡 pinned_posts (2nd pass), 🟡 profile_visits (2nd pass), 🟡 recruiter_ads (recruiter side) · shared users, user_tech_tags, user_blocks, notifications, completion_records, posts, team_members, recruiter_profiles (after 31)
- [ ] Server: daily contribution scheduler, recruiter view logging (only when a recruiter views, once per recruiter per day, recorded by the server on profile read, kept 90 days), Pro weekly view-count notice (Mondays 09:00), 90-day old-username redirect
- [ ] Frontend 1st pass: guests tapping follow/message/more → login-prompt sheet, header and badges (looking for team, job seeking, "제안 받는 중" (Open to offers) for recruiters only), optimistic follow, followers sheet, completion record, contribution calendar, `generateMetadata` + `opengraph-image.tsx` (developer profiles only; recruiters get the default, blueprint 8-3)
- [ ] Frontend 2nd pass: project post list, pin sheet, teams, message button
- [ ] Frontend (after 31): recruiter profile layout and my page (offer status summary + latest 3 → 33)
- [ ] Server `[Included]`: URL check (https; allowed job sites in server config, else `company_email_domain` and its subdomains; reject short URLs and IPs), daily 00:00 closing batch + notification, ENDED on subscription expiry (called by 29's scheduler)
- [ ] Frontend `[Included]`: my-page job ad card (status, switch, edit), register/edit sheet (job category chips, title, URL, closing date, card preview), Scout prompt → 28 when not subscribed, share button (00 share sheet)

### 05. Edit profile `[Required]` · `/settings/profile`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D6 morning (0.5 day), recruiter edit and job categories D10 morning | 04; recruiter edit 31 | A-2, A-3, H-4, H-8 |

**`ProfileEditController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/me/profile` | Edit form values | user |
| PATCH | `/api/v1/user/me/profile` | Name, bio, blog, tech stack, looking for team, job-seeking status, `[Included]` job categories of interest (max 3) | user · developers only |
| POST | `/api/v1/user/me/profile/github-sync` | Reload from GitHub | user · developers only |
| PATCH | `/api/v1/recruiter/me/profile` | `[Included]` Recruiter name, company, job title, website (after 31) | recruiter |

- Tables: new 🟡 user_job_categories · shared users, user_tech_tags, tech_tags, recruiter_profiles (after 31)
- [ ] Server: turn off looking-for-team after 30 days inactive, job-seeking status OFF after 90 days inactive + notify on next visit (same scheduler)
- [ ] Frontend: character count validation (react-hook-form + zod), reuse 02's tech stack sheet and job-seeking status component

### 06. Settings `[Required]` · `/settings`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | Logout D1, rest D4 afternoon (0.5 day), recruiter section included in 32 (D9) | 01 | POL-A, POL-N-1 |

**`SettingsController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/me/settings` | Linked GitHub, notification email, push on/off, current plan summary | user |
| PATCH | `/api/v1/user/me/settings/notifications` | Push on/off (`users.push_enabled`; off stops push only) | user |
| PATCH | `/api/v1/user/me/email` | Change notification email | user |
| POST | `/api/v1/user/auth/logout` | Log out (delete session) | user |
| GET | `/api/v1/user/me/withdrawal-check` | Teams I own (must transfer or delete before next step) | user |
| POST | `/api/v1/user/me/withdrawal` | Pending withdrawal (deleted after 30 days) | user |
| PATCH | `/api/v1/recruiter/me/password` | `[Included]` Recruiter password change → end other sessions (after 32) | recruiter |

- Borrowed: block list / unblock (00 `BlockController`), owner transfer / team delete (09)
- Tables: new none · shared users, user_agreements, user_blocks, user_sessions, team_members, subscriptions (after 28)
- [ ] Server: scheduler that deletes 30 days after pending withdrawal (posts and comments deleted; team chat shows "탈퇴한 사용자" (Withdrawn user))
- [ ] Frontend: sections, "푸시 알림" (Push notifications) switch (in a browser, note that push is Android-app only), withdrawal sheet steps, hide GitHub items for recruiters and show Scout subscription & billing → 29

## 4-2. Creating teams and invites

### 07. Workspace home `[Required]` · `/workspace`, `/workspace/issues`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B (my issues: C) | D3 morning (0.5 day), my issues D9 afternoon (C) | 01 | T-1, I-5 |

**`WorkspaceController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/me/teams` | My teams (grouped active / completed / read-only / archived), also used by the team switcher sheet | user · developers only |
| GET | `/api/v1/user/me/issues` | `[Included]` Issues assigned to me across all teams, by due date (added by C on D9) | user · developers only |

- Tables: new none · shared teams, team_members, issues, issue_assignees
- [ ] Frontend: team cards, empty state ("팀 만들기" (Create team) + "팀 찾으러 가기" (Find a team)), team switcher sheet (header of 11–15), 10-team limit notice
- Note: B owns the 07 controller; C adds one method on D9. No time overlap, so no conflict; B reviews the PR.
- Frontend handoff (PR #35): B's “내 이슈 전체 보기” links to C's `/workspace/issues`; the list's back fallback is `/workspace`. Both URLs belong to page 07; no additional controller or endpoint is introduced.

### 08. Create team `[Required]` · `/teams/new`, `/teams/new/callback`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | D3 afternoon–D4 (1.5 days) | 07, 00 spike | T-1, T-3, POL-T-1, POL-I-1 |

**`TeamCreateController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/team-setup/install-url` | GitHub App install URL + `state` | user · developers only |
| POST | `/api/v1/user/team-setup/installations/verify` | Don't trust the return values; verify via `GET /user/installations` → installed / requested from owner / org already linked | user · developers only |
| POST | `/api/v1/user/teams` | Create team + team chat room + register owner | user · developers only |
| GET | `/api/v1/user/teams/{teamId}/setup/repos` | Repos the app is installed on | team OWNER |
| PUT | `/api/v1/user/teams/{teamId}/setup/repos` | Set initial linked repos | team OWNER |
| GET | `/api/v1/user/teams/{teamId}/setup/boards` | `[Included]` Preview existing org boards (name, card count, status columns) | team OWNER/ADMIN |
| POST | `/api/v1/user/teams/{teamId}/setup/board` | Create new "Linker" board (4 statuses + date fields) or use existing board + status mapping | team OWNER/ADMIN |
| GET | `/api/v1/user/teams/{teamId}/setup/permission-check` | Whether org base repo permission is read | team OWNER |
| POST | `/api/v1/user/teams/{teamId}/setup/complete` | Queue first full sync (issues, PRs, org members) | team OWNER |

- Tables: new github_installations, github_repos, teams, team_members, team_repos, team_project_boards, board_status_mappings, chat_rooms, chat_room_members · shared github_tokens, github_webhook_deliveries
- [ ] Server: handlers (consumers of the 00 webhook queue) for `installation` webhook (app removed → read-only, archived after 30 days) and `organization` webhook (member sync)
- [ ] Frontend: 5-step flow, 3 callback screen states, "조직이 없어요" (No organization) guide, completion screen (invite → 09, recruit post → 20)

### 09. Team settings & members `[Required]` · `/teams/[id]/settings`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | 1st pass D5 morning (0.5 day), 2nd pass D6–D7 morning (1.5 days) | 08 | T-2, T-3, T-4 |

**`TeamSettingsController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/settings` | Team info, my role, which buttons are allowed, plan, board | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/members` | Members, roles, GitHub org status, "N/6" | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/invite-links` | Valid invite links | team ADMIN |
| POST | `/api/v1/user/teams/{teamId}/invite-links` | Create invite link (7 days) | team ADMIN |
| DELETE | `/api/v1/user/teams/{teamId}/invite-links/{linkId}` | Revoke invite link | team ADMIN |
| POST | `/api/v1/user/teams/{teamId}/members/{userId}/github-invitation` | GitHub org invite (org owner only, daily limit error) | team MEMBER + org owner |
| POST | `/api/v1/user/teams/{teamId}/repos` | Add linked repo | team ADMIN |
| DELETE | `/api/v1/user/teams/{teamId}/repos/{repoId}` | Remove linked repo | team ADMIN |
| PATCH | `/api/v1/user/teams/{teamId}` | 2nd pass: name, description | team ADMIN |
| PATCH | `/api/v1/user/teams/{teamId}/members/{userId}/role` | 2nd pass: change role | team OWNER |
| DELETE | `/api/v1/user/teams/{teamId}/members/{userId}` | 2nd pass: remove member (admins can remove members only) | team ADMIN |
| DELETE | `/api/v1/user/teams/{teamId}/members/me` | 2nd pass: leave team (not owner) | team MEMBER |
| POST | `/api/v1/user/teams/{teamId}/ownership-transfers` | 2nd pass: request owner transfer | team OWNER |
| POST | `/api/v1/user/teams/{teamId}/ownership-transfers/{transferId}/accept` | 2nd pass: recipient accepts | team MEMBER (recipient) |
| POST | `/api/v1/user/teams/{teamId}/completion` | 2nd pass: complete project → "작업물 올리기" (Post your project) notification to members | team OWNER/ADMIN |
| DELETE | `/api/v1/user/teams/{teamId}/completion` | 2nd pass: revert within 7 days | team OWNER/ADMIN |
| POST | `/api/v1/user/teams/{teamId}/archive` | 2nd pass: archive | team OWNER |
| DELETE | `/api/v1/user/teams/{teamId}` | 2nd pass: delete (confirm team name) | team OWNER |

- Borrowed: board change `[Included]` → 08's `setup/boards`, `setup/board`. Team plan → 28
- Tables: new team_invite_links, github_org_invitations, team_completions, completion_records, team_ownership_transfers · shared teams, team_members, team_repos, github_repos, team_project_boards, board_status_mappings, chat_room_members, notifications, subscriptions (after 28)
- [ ] Server: completion record calculation (14+ days membership, confirmed after 7 days), auto-remove from team when removed from org + notify, removed members can't apply for 7 days, member limit (`PlanLimits`)
- [ ] Frontend: sections, hide/disable per permission table, invite sharing (Web Share API, copy), confirm sheets, read-only team notice

### 10. Accept invite `[Required]` · `/invite/[code]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | D5 afternoon (0.5 day) | 09 | T-2 |

**`InviteController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/invites/{code}` | Team preview + link status (expired, revoked) | public |
| POST | `/api/v1/user/invites/{code}/accept` | Add team member + join team chat. Already a member, member limit, over 10 teams returned as codes | user · developers only |

- Tables: new none · shared team_invite_links, teams, team_members, chat_room_members
- [ ] Frontend: guest → login → onboarding → return via `returnTo`, screen per status, GitHub org invite guide after accepting, go to 11, `generateMetadata` ("OO 팀 초대", team description, org avatar, `noindex`, blueprint 8-3)

## 4-3. Issues and schedule

### 11. Issue list `[Required]` · `/teams/[id]/issues`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| C | D3–D4 morning (1.5 days) | 08 | I-2, I-3, T-7, S-9 |

**`IssueListController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/issues` | Filters: repo, status, assignee, label, open; cursor | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/issues/unscheduled` | "일정 없음" (Unscheduled) tab (not on board or no due date) | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/issue-filters` | Filter sheet options (repos, labels, members) — also used by 14 and 15 | team MEMBER |
| POST | `/api/v1/user/teams/{teamId}/issues/refresh` | Pull to refresh (once per minute) | team MEMBER |
| POST | `/api/v1/user/teams/{teamId}/issues/{issueId}/project-item` | "프로젝트에 추가" (Add to project) | team MEMBER + repo write |
| GET | `/api/v1/user/teams/{teamId}/progress?days=14` | `[Included]` Progress card: completion rate, 4 status counts, last 14 days of snapshots + today, open issues per assignee, overdue and due within 3 days. Free teams get 403 `PLAN_LIMIT` (after 28) | team MEMBER · Flex |

- Tables: new issues, issue_assignees, issue_labels, 🟡 team_progress_snapshots · shared teams, team_repos, github_repos, board_status_mappings, github_webhook_deliveries, subscriptions (after 28)
- [ ] Server: first full sync with installation token, `issues` and `projects_v2_item` webhook handlers, sync every 15 min for active teams / daily otherwise, later value wins
- [ ] Server: daily 00:00 per-team progress snapshot batch (all teams, kept 1 year). Start it on D4 so data accumulates by D10
- [ ] Frontend: team layout (tabs + team switcher + team chat shortcut, shared by 11–15), issue row, filter sheet (nuqs, reused by 14 and 15), conditions for showing the create-issue button
- [ ] Frontend `[Included]` (C, D10): progress card (completion ring, 4-column bars, 14-day trend, per assignee; summary sentence + "표로 보기", blueprint ch. 6), Flex prompt for free teams

### 12. Issue detail `[Required]` · `/teams/[id]/issues/[issueId]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| C | D4 afternoon–D5 (1.5 days) | 11 | I-2, I-3, C-2 |

**`IssueDetailController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/issues/{issueId}` | Body (sanitized Markdown), assignees, labels, dates, status, my write permission, deleted/moved state | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/assignee-candidates` | Assignee sheet (members with repo access who accepted the org invite) | team MEMBER |
| PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/assignees` | Assignees (max 10) → check GitHub response → notify | team MEMBER + repo write |
| GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/label-options` | Label sheet | team MEMBER |
| PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/labels` | Labels | team MEMBER + repo write |
| PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/schedule` | Start and due date (start ≤ due) | team MEMBER + repo write |
| PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/status` | Todo / In Progress / Blocked / Done (Done = close; reverting reopens) — borrowed by 14 | team MEMBER + repo write |
| GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/sub-issues` | `[Included]` Sub-issue progress | team MEMBER |

- Borrowed: "채팅에 공유" (Share to chat) `[Included]` → 17's send message (issue card type)
- Tables: new issue_sync_jobs · shared issues, issue_assignees, issue_labels, team_members, notifications
- [ ] Server: retry via `issue_sync_jobs` when applying to GitHub fails; show in response when `sync_status = FAILED`
- [ ] Frontend: 4 sheets (assignee, label, date, status) as shared components (reused in 13, 14, 15), disabled + toast without write permission, "일정이 GitHub에 반영되지 않았어요" (Schedule not applied to GitHub)

### 13. Create issue `[Required]` · `/teams/[id]/issues/new`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| C | D6–D7 (2 days) | 12 | I-1, POL-I-1 |

**`IssueCreateController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/issue-templates?repoId=` | Repo templates → org `.github` templates → 3 defaults | team MEMBER |
| GET | `/api/v1/user/teams/{teamId}/issue-templates/{templateKey}?repoId=` | Parsed template (Markdown body or issue form field list + default labels/assignees); falls back to default template on failure | team MEMBER |
| POST | `/api/v1/user/teams/{teamId}/issues` | Create issue → add to project → dates → status, in order; 202 + jobId (100/day) | team MEMBER + repo write |
| GET | `/api/v1/user/teams/{teamId}/issue-sync-jobs/{jobId}` | Creation progress, failed step | team MEMBER |

- Borrowed: 12's assignee and label option APIs, 11's `issue-filters` (repo list)
- Tables: new none · shared issues, issue_assignees, issue_labels, issue_sync_jobs, team_repos, team_project_boards, github_tokens
- [ ] Server: parse issue form YAML, form answers → GitHub body (`### Question`, empty `_No response_`), retry queue for mid-way failures, never create Linker-only issues
- [ ] Frontend: stepped (repo & template → content), dynamic form field rendering (react-hook-form + zod), reuse 12's sheets, on failure save draft on device + resend, enter with body prefilled from 17 "이슈로 만들기" (Make an issue)

### 14. Status board `[Required]` · `/teams/[id]/board`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| C | D8 (1 day) | 12 | I-4 |

**`BoardController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/board` | Cards in 4 columns + "기타" (Other) column (same filters as 11) | team MEMBER |

- Borrowed: status change → 12's `PUT .../issues/{issueId}/status`, filter options → 11's `issue-filters`
- Tables: new none · shared issues, board_status_mappings, issue_sync_jobs
- [ ] Frontend: dnd-kit drag (long-press drag on mobile), optimistic move, revert to original column + notice on failure, horizontally scrolling columns, no drag without write permission

### 15. Calendar `[Required]` · `/teams/[id]/calendar`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| C | D9 morning (0.5 day) | 12 | I-4, N-1 |

**`CalendarController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/teams/{teamId}/calendar?from=&to=&assignee=` | Issues in range (start/due dates, KST) | team MEMBER |

- Tables: new none · shared issues, issue_assignees, notifications
- [ ] Server: 9 AM scheduler notifying assignees the day before the due date
- [ ] Frontend: month/week views, range bars and dots, tap a date → that day's issues sheet → 12, guide for issues without due dates

## 4-4. Team chat and notifications

### 16. Chat list `[Required]` · `/chats`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| D | D3 morning (0.5 day) | 08 | C-1, C-4 |

**`ChatListController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/chat-rooms?tab=TEAM\|DIRECT\|REQUEST` | Room list (last message, unread count, muted), excluding blocked users | user |
| GET | `/api/v1/user/chat-rooms/unread-summary` | Unread count per tab, received request count (bottom tab badge) | user |
| POST | `/api/v1/user/chat-requests/{roomId}/accept` | Accept message request — also borrowed by the top of 17 | user |
| DELETE | `/api/v1/user/chat-requests/{roomId}` | Delete request (reject, sender not notified, blocks re-request for 30 days) | user |

- STOMP: subscribe server → `/user/queue/chat-rooms` (list updates)
- Tables: new none · shared chat_rooms, chat_room_members, user_blocks, recruiter_profiles (after 31)
- [ ] Frontend: 3 tabs, room row, live updates, requests tab, `[Included]` "채용 제안" (Recruiting offer) label + company name (after 31), empty state

### 17. Chat room (team & 1:1) `[Required]` · `/chats/[roomId]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| D (PR posting: B, AI summary: C) | Team chat D3 afternoon–D5 (2.5 days), 1:1 & recruiting offers D7 (1 day), PR posting D7 afternoon (B), `[Included]` AI summary D10 morning (C, 0.5 day + Ollama setup by B on D9), `[Included]` share sheet, share cards, link cards D10 afternoon (D, server and screens) | 16, 12, 28 | C-1, C-2, C-3, C-4, C-5, C-7, P-7, S-6, S-8, H-3 |

**`ChatRoomController`** (REST + `@MessageMapping`)

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/chat-rooms/{roomId}` | Room info, members, my notification setting, request status | room participant |
| GET | `/api/v1/user/chat-rooms/{roomId}/messages?before=&after=` | Infinite load upward, missed messages after reconnect, handles 500+ | room participant |
| POST | `/api/v1/user/chat-rooms/{roomId}/read` | Last read message | room participant |
| GET | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}/unread-members` | Unread-by sheet (team) | room participant |
| PATCH | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}` | Edit (within 24 hours) | author |
| DELETE | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}` | Delete (team owner/admin can delete others') | author / team ADMIN |
| PATCH | `/api/v1/user/chat-rooms/{roomId}/notification` | Mute | room participant |
| DELETE | `/api/v1/user/chat-rooms/{roomId}/members/me` | Leave 1:1 chat | room participant |
| GET | `/api/v1/user/chat-rooms/{roomId}/images` | `[Included]` Photo gallery | room participant |
| GET | `/api/v1/user/chat-rooms/{roomId}/pull-requests?state=` | PR sheet (open, merged) | team MEMBER |
| GET | `/api/v1/user/chat-rooms/{roomId}/mention-candidates` | @mention autocomplete | team MEMBER |
| GET | `/api/v1/user/chat-rooms/{roomId}/issue-cards?number=&repoId=` | #issue number → card (title only without permission) | team MEMBER |
| GET | `/api/v1/user/chat-rooms/{roomId}/link-preview?url=` | `[Included]` First external link preview (1:1 only for mutual follows; server fetches OG tags). Linker URLs skip OG; the server turns them into `payload.linkerCard` when saving the message | room participant |
| GET | `/api/v1/user/chat-rooms/{roomId}/search?q=` | `[Included]` Team chat search (free 60 days, Flex full history). The message list also doesn't return messages older than 60 days for free teams (30-day grace after Flex ends) | team MEMBER |
| GET | `/api/v1/user/me/share-targets?q=` | `[Included]` Chat room list for the share sheet (my team rooms + open 1:1 rooms, most recent first, excluding pending requests, blocks, read-only and archived teams) | user |
| POST | `/api/v1/user/chat-rooms/{roomId}/share-cards` | `[Included]` Share to chat room: `{targetType: POST / RECRUIT_POST / PROFILE, targetId}` → `SHARE_CARD` message + STOMP send (10/min, 100/day) | room participant |
| POST | `/api/v1/user/chat-rooms/direct` | Start 1:1 chat: room if mutual follow / same team, otherwise request | user · developers only |
| POST | `/api/v1/user/chat-rooms/{roomId}/ai-summaries` | `[Included]` Create AI summary (range; checks Flex (incl. trial), team setting on, 10/person/day; free teams get 403 `PLAN_LIMIT` → Flex prompt sheet; 202 if over 30 s) | team MEMBER · Flex |
| GET | `/api/v1/user/chat-rooms/{roomId}/ai-summaries/{summaryId}` | `[Included]` Summary result (own only, 7 days) — borrowed by 13 to prefill from action items | requester |
| POST | `/api/v1/user/chat-rooms/{roomId}/ai-summaries/{summaryId}/share` | `[Included]` Share to chat → `AI_SUMMARY` card message | requester |
| POST | `/api/v1/recruiter/chat-requests` | `[Included]` Recruiting offer request (`request_kind = RECRUITING`, 1,000 chars, no photos, 10/day or 50 with Scout; rejected if job-seeking is OFF, or if a request to the same developer is pending or was rejected within 30 days) | recruiter |

**Shared realtime paths (16–18)**: the overview counts 5 paths: 1 WebSocket connection endpoint + 1 STOMP SEND destination + 3 SUBSCRIBE destinations. `/ws` is the connection endpoint, not a STOMP frame destination. The list-update subscription belongs to 16; the notification subscription is shared with 18.

| STOMP | Destination / connection endpoint | Does |
| --- | --- | --- |
| CONNECT | `/ws` | Cookie auth |
| SEND | `/app/chat-rooms/{roomId}/messages` | Send message (text 2,000 chars, 10 photo fileIds, issue card, 5 per second) |
| SUBSCRIBE | `/topic/chat-rooms/{roomId}` | New message, edit, delete, read |
| SUBSCRIBE | `/user/queue/notifications` | Notification badge (shared with 18) |
| SUBSCRIBE | `/user/queue/chat-rooms` | Chat list and unread summary updates (owned by 16) |

- Borrowed: photo upload (00), message report (00 `ReportController`, copy 10 before/after), accept/delete request (16), "이슈로 만들기" (Make an issue) → 13
- Tables: new chat_messages, chat_message_images, pull_requests, chat_message_mentions, report_message_snapshots, 🟡 ai_chat_summaries (after 28) · shared chat_rooms, chat_room_members, uploaded_files, issues, follows, team_members, user_blocks, report_cases, reports, notifications, subscriptions (after 28), recruiter_profiles (after 31)
- [ ] Server (D): new message notifications (grouped per room), mention notifications (even when muted), @all only for owner/admin, don't deliver messages from blocked users; keep blocked-period DMs invisible after unblocking using retained `user_blocks` intervals (history, catch-up, previews, unread counts, search and notifications; team chat exempt), expire requests after 30 days
- [ ] Server (B): `pull_request` webhook → system messages (undeletable) only for opened, review requested, merged, closed
- [ ] Server (C, reviewed by D): `LlmClient` interface + Ollama implementation (JSON-format response, max 500 messages, excluding deleted, hidden, images and blocked users), 7-day retention batch. B runs Ollama in Docker next to the backend server (D9)
- [ ] Server (D) `[Included]`: share cards and Linker link cards are filled from the original in the message list response (deleted, hidden or blocked → "볼 수 없는 게시물이에요"); post views via a card are logged in 23 with `source = CHAT_SHARE`
- [ ] Frontend (C): AI summary button and range picker, Flex prompt sheet for free teams, summary sheet (jump to original message, N/10), share to chat, action item → 13, "이 팀은 AI 요약을 사용해요" (This team uses AI summary) banner
- [ ] Frontend: STOMP reconnect, TanStack Virtual list, sending/failed/retry, photo viewer, message menu sheet, room info sheet, PR sheet, mentions and #issue cards, request status bar (sender and receiver sides), sender card for recruiting offers

### 18. Notifications `[Required]` · `/notifications`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| D | D6 (1 day) | 12, 17 | N-1, POL-N-1 |

**`NotificationController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/notifications` | Notification list (with target URL) | user |
| GET | `/api/v1/user/notifications/unread-count` | Header bell badge | user |
| PATCH | `/api/v1/user/notifications/{notificationId}/read` | Mark read | user |
| POST | `/api/v1/user/notifications/read-all` | Mark all read | user |
| POST | `/api/v1/user/appeals` | Appeal a sanction (once) | user |
| POST | `/api/v1/user/push-tokens` | Register Expo push token (Android app) | user |
| DELETE | `/api/v1/user/push-tokens/{token}` | Delete token (logout) | user |

- Tables: new push_tokens · shared notifications, users, appeals (after 25 — A creates the table in 25; the appeal API is wired on D7)
- [ ] Server: non-chat notifications between 10 PM and 8 AM batched and sent in the morning, Expo push sending (Android; skipped while `push_enabled` is off)
- [ ] Frontend: list, navigation, read state, live bell badge, appeal sheet, push permission prompt (Android app; iOS out of MVP)

## 4-5. Find Team

### 19. Recruit post list `[Required]` · `/recruits`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D3 (1 day) | 04 | R-2, R-3 |

**`RecruitListController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/recruits?role=&tech=&mode=&sort=` | Open posts, newest / deadline soon; excludes blocked relations if logged in | public |
| GET | `/api/v1/user/me/recruits` | My recruit posts tab | user · developers only |
| GET | `/api/v1/user/me/applications?status=` | My applications tab (in review, accepted, rejected, expired) | user · developers only |
| DELETE | `/api/v1/user/me/applications/{applicationId}` | Cancel an in-review application — also borrowed by 21 | user · developers only |

- Tables: new recruit_posts, recruit_roles, recruit_post_tags · shared tech_tags, user_blocks, applications (after 21)
- [ ] Frontend: 3 tabs (guests see only the All tab; "모집 글 쓰기" (Write recruit post) → login prompt), card (remaining headcount per role, D-day), filter sheet (nuqs), infinite scroll, empty-result copy

### 20. Write/edit recruit post `[Required]` · `/recruits/new`, `/recruits/[id]/edit`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D4 (1 day) | 19 | R-1, S-5 |

**`RecruitEditorController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/recruit-editor/options` | Teams that can be linked (owner/admin), remaining concurrent posts (3/10) | user · developers only |
| POST | `/api/v1/user/recruits` | Create (5/day, concurrent 3 / Pro 10) | user · developers only |
| GET | `/api/v1/user/recruits/{recruitId}/edit-form` | Edit form values + roles that can't be removed, minimum headcounts | author |
| PUT | `/api/v1/user/recruits/{recruitId}` | Edit | author |
| POST | `/api/v1/user/recruits/{recruitId}/close` | Close — also borrowed by 21's menu | author |
| POST | `/api/v1/user/recruits/{recruitId}/reopen` | Reopen | author |
| DELETE | `/api/v1/user/recruits/{recruitId}` | Delete (expire pending applications + notify) | author |

- Tables: new none · shared recruit_posts, recruit_roles, recruit_post_tags, teams, team_members, subscriptions (after 28)
- [ ] Server: scheduler that auto-closes when deadline passes or headcount is full
- [ ] Frontend: form (repeating headcount per role, region required if offline), limit notice sheet, draft restore

### 21. Recruit post detail (apply & manage applicants) `[Required]` · `/recruits/[id]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D5–D6 morning (1.5 days) | 20, 08, 17 | R-3, R-4, P-7 |

**`RecruitDetailController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/recruits/{recruitId}` | Body, remaining headcount per role, author card. If logged in: my application status, whether already a team member, whether I'm the author | public |
| POST | `/api/v1/user/recruits/{recruitId}/applications` | Apply (1 role + 300 chars, 20/day, one re-apply) | user · developers only |
| GET | `/api/v1/user/recruits/{recruitId}/applications?roleId=` | Applicants tab (days left until 14-day expiry) | author |
| GET | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}` | Application sheet (stack, contribution graph, posts, completion record, message) | author |
| POST | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}/accept` | Accept → team member + team chat + notification. No team, role full, team limit returned as codes | author |
| POST | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}/reject` | Reject (reason internal; applicant gets fixed copy) | author |

- Borrowed: GitHub org invite → 09's `members/{userId}/github-invitation`, cancel application → 19, close/delete → 20, report → 00
- Tables: new applications · shared recruit_posts, recruit_roles, users, user_tech_tags, contribution_days, completion_records, posts (after 22), team_members, chat_room_members, github_org_invitations, notifications, reports
- [ ] Server: application-received notification, auto-expire after 14 days unhandled, `[Included]` reminder if org invite not accepted 7 days after acceptance, `[Included]` mark as fake recruiting if team deleted within 7 days after acceptance
- [ ] Frontend: screens for guest / applicant / author (guest "지원하기" (Apply) → login prompt), apply sheet, applicants tab and application sheet, 3 acceptance-exception sheets (team member limit shows a Flex prompt), reject sheet, `[Included]` share button (00 share sheet), `generateMetadata` + `opengraph-image.tsx` (title, remaining roles, D-n, blueprint 8-3)

## 4-6. Project posts and social

### 22. Write/edit project post `[Required]` · `/posts/new`, `/posts/[id]/edit`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D6 afternoon–D7 (1.5 days) | 04 | P-1, P-2 |

**`PostEditorController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/post-editor/repos?q=&teamId=` | Public repos of my account and my orgs, marking already-posted and forks; preselected when coming from a team | user · developers only |
| GET | `/api/v1/user/post-editor/repos/{repoId}/summary` | Repo card (name, language, stars, description), my commit count, issues handled in Linker | user · developers only |
| POST | `/api/v1/user/posts` | Publish (10/day, photos 5 / Pro 10) | user · developers only |
| GET | `/api/v1/user/posts/{postId}/edit-form` | Edit form values | author |
| PUT | `/api/v1/user/posts/{postId}` | Edit ("수정됨" (Edited)) | author |

- Borrowed: photo upload (00), tech tags (00), limit notice → 28
- Tables: new posts, post_images, post_demo_links, post_tags · shared github_repos, uploaded_files, tech_tags, issues, team_members, subscriptions (after 28)
- [ ] Frontend: stepped (repo → content), reorder photos and retry partial failures, optional fields, email registration guide when commits are 0, draft restore

### 23. Project post detail `[Required]` · `/posts/[id]`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D8 (1 day) | 22 | P-3, P-5, P-7, S-4 |

**`PostDetailController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/posts/{postId}?from=` | Post (repo state, commit/issue counts, like count, "검토 중" (Under review) to the author if hidden). If logged in: my like, view logging (traffic source: feed, profile, recruit post, chat share, external link `from=share`) | public |
| GET | `/api/v1/public/posts/{postId}/readme` | `[Included]` README (1-hour cache, sanitized), expand logged if logged in | public |
| POST | `/api/v1/user/posts/{postId}/likes` | Like (notification) | user · developers only |
| DELETE | `/api/v1/user/posts/{postId}/likes` | Unlike | user · developers only |
| GET | `/api/v1/user/posts/{postId}/likes` | Likers sheet (people list, so login only) | user |
| GET | `/api/v1/public/posts/{postId}/comments` | Comments and one-level replies | public |
| POST | `/api/v1/user/posts/{postId}/comments` | Write comment (500 chars, 10/min and 300/day, notification) | user · developers only |
| PATCH | `/api/v1/user/posts/{postId}/comments/{commentId}` | Edit comment | comment author |
| DELETE | `/api/v1/user/posts/{postId}/comments/{commentId}` | Delete comment ("삭제된 댓글입니다" if it has replies) | comment author / post owner |
| DELETE | `/api/v1/user/posts/{postId}` | Delete post | author |
| GET | `/api/v1/public/posts/{postId}/same-repo-posts` | Other posts for this repo | public |

- Borrowed: report (00), "채용 제안 보내기" (Send recruiting offer) → 17's `POST /api/v1/recruiter/chat-requests`, edit → 22
- Tables: new post_likes, comments, 🟡 post_views · shared posts, post_images, github_repos, users, notifications, reports, user_blocks
- [ ] Frontend: photo swipe and viewer, README toggle, guests tapping like / comment input / more → login prompt, optimistic like, comments and replies, more sheet, for recruiters hide input + offer menu (after 31), `[Included]` share button (00 share sheet), `generateMetadata` + OG image (cover photo, otherwise `opengraph-image.tsx` repo card; strip `?from=share` from canonical, blueprint 8-3)

### 24. Home feed `[Required]` · `/feed`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| E | D9 (1 day), job ad card D10 morning | 23; job ad needs the 04 job ad sheet | P-4, H-9 |

**`FeedController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/public/feed?cursor=&offersOnly=` | Guests: this week's popular + newest only. Logged in: 1 recommendation per 4 following posts, one-line "why shown", max 2 in a row from the same author. `offersOnly` = recruiter "제안 받는 개발자만" (Only developers open to offers) | public |
| POST | `/api/v1/user/feed/seen` | Log posts shown on screen (to exclude from recommendations) | user |
| GET | `/api/v1/user/feed/recommended-users` | Empty feed: 5 developers by my tech stack | user |
| POST | `/api/v1/user/ads/{adId}/click` | `[Included]` Record click → return posting URL (frontend opens it via the external link sheet) | user · developers only |
| POST | `/api/v1/user/ads/{adId}/dismiss` | `[Included]` X close (7 days) | user · developers only |
| DELETE | `/api/v1/user/ads/{adId}/dismiss` | `[Included]` Undo close (toast) | user · developers only |
| POST | `/api/v1/user/ads/{adId}/hide` | `[Included]` Hide this ad (permanent) | user · developers only |

- Borrowed: follow → 04, like → 23, ad report → 00 `ReportController` (target RECRUITER_AD)
- Tables: new feed_seen_posts, 🟡 ad_hides, 🟡 ad_daily_stats · shared posts, post_likes, comments, follows, users, user_tech_tags, post_tags, user_blocks, user_job_categories, recruiter_ads, subscriptions
- [ ] Server `[Included]`: mix `type: "AD"` items into the feed response (only for logged-in developers with matching job categories, 1 per 10 posts, not on the first screen, 3 per person per day and same ad once per day via Redis), exclude closed within 7 days / hidden / block relations, impression/click Redis counters → `ad_daily_stats` once a day
- [ ] Server: popularity score (like 1, comment by others 2, time decay, ignore likes from accounts under 7 days old), "why shown" priority, `[Included]` 2nd-degree recommendations
- [ ] Frontend `[Included]`: ad card ("광고" (Ad) label, company, title, job category, closing date, X, more → hide/report), close undo toast, tap → click API → external link sheet
- [ ] Frontend: card (job-seeking badge), infinite + virtual scroll, write button (none for recruiters, login prompt for guests), guests don't send `seen`, empty feed, `[Included]` recruiter toggle (nuqs)

## 4-7. Trust, safety and operations

### 25. Ops: reports `[Required]` · `/admin/reports`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D6 afternoon–D7 morning (1 day) | 00, 23 | O-1, O-2, O-4 |

**`AdminReportController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/report-cases?status=&targetType=&overdue=` | Pending / handled / appealed, target type (`[Included]` incl. RECRUITER_AD), flag over 2 business days | admin |
| GET | `/api/v1/admin/report-cases/{caseId}` | Report reasons, content, the copied 10 before/after for chat | admin |
| POST | `/api/v1/admin/report-cases/{caseId}/actions` | Hide / delete (reason required) / dismiss / restore → notify author and reporters | admin |
| GET | `/api/v1/admin/appeals?status=` | Appeals list | admin |
| POST | `/api/v1/admin/appeals/{appealId}/decision` | Accept (restore + delete record) / reject. Only an operator other than the original handler | admin |
| POST | `/api/v1/admin/otp/verify` | `[Included]` OTP 2FA | admin |

- Tables: new sanctions, admin_actions, appeals (18's appeal API is wired on D7) · shared report_cases, reports, report_message_snapshots, posts, comments, recruit_posts, chat_messages, users, admins, notifications, recruiter_ads (after D10)
- [ ] Server `[Included]`: job ad report detail (company, title, job category, closing date, URL host); hide action = `recruiter_ads.status = HIDDEN` + notify the recruiter
- [ ] Server: log every action to `admin_actions` (27), 5 dismissed reports in 30 days → no reporting for 30 days, log out after 30 min idle
- [ ] Frontend: desktop layout (list + right detail panel, shared by 26 and 27), filters, action confirm sheet

### 26. Ops: users `[Required]` · `/admin/users`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | D8 (1 day) | 25 | O-3 |

**`AdminUserController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/users?q=&status=&userType=&needsReview=` | Search, status and member type, "확인 필요" (Needs review: 3× limits) | admin |
| GET | `/api/v1/admin/users/{userId}` | Basic info (email masked), sanction and report history, subscription and payments; for recruiters: company, domain, job title, 30-day offers sent and accepted | admin |
| POST | `/api/v1/admin/users/{userId}/sanctions` | Sanction (warning → 7 days → 30 days → permanent by lead), reason required, notify | admin |
| DELETE | `/api/v1/admin/users/{userId}/sanctions/{sanctionId}` | Lift sanction (lead) | admin (lead) |
| POST | `/api/v1/admin/users/{userId}/email-reveal` | Reveal full email after entering a reason (logged) | admin |
| POST | `/api/v1/admin/payments/{paymentId}/refund` | `[Included]` Refund (Toss payment cancel) | admin |

- Tables: new none · shared users, sanctions, banned_github_ids, report_cases, admin_actions, subscriptions, payments (after 28), recruiter_profiles (after 31), recruiter_ads (after D10)
- [ ] Server: allowed actions while suspended (login, view, appeal, withdraw), reset step after 1 year without violations, permanent ban → `banned_github_ids`, `[Included]` suspending a recruiter hides their job ad immediately (HIDDEN; stays hidden after the suspension ends until an operator lifts it, 04 policy ch. 3 "Job ads")
- [ ] Frontend: reuse 25's layout, sanction sheet, lift confirmation

### 27. Ops: action log `[Required]` · `/admin/audit`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | D9 morning (0.5 day) | 25, 26 | O-5 |

**`AdminAuditController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/audit-logs?adminId=&actionType=&from=&to=` | Who, when, what, why | admin |
| GET | `/api/v1/admin/audit-logs/filters` | Operator and action type options | admin |

- Tables: new none · shared admin_actions, admins
- [ ] Server: `admin_actions` is append-only (no update/delete API; DB grants INSERT and SELECT only)
- [ ] Frontend: filters + table

## 4-8. Subscription

### 28. Plans & checkout `[Required]` · `/subscribe`, `/subscribe/success`, `/subscribe/fail`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| D | D8–D9 morning (1.5 days), Scout D10 morning | 04, 09, 17, 20, 22 | S-1, S-3, S-7, H-5 |

**`SubscribeController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/plans?reason=` | Developers: Free / Pro / Flex; recruiters: `[Included]` Scout only. Monthly and yearly prices (Flex and Scout monthly only), entry reason, free trial eligibility. Personalized response: `Cache-Control: private, no-store`; frontend server `no-store`, no shared Next cache | user |
| GET | `/api/v1/user/plans/team-candidates` | My teams that can upgrade to Flex (owner / billing owner) with current headcount and price (₩7,900 up to 6, ₩1,900 per member from the 7th) | user · developers only |
| POST | `/api/v1/user/payments/checkout` | Create order (orderId, amount, customerKey). Checks plan matches member type | user |
| POST | `/api/v1/user/payments/confirm` | Success return: activate subscription + apply `PlanLimits` only after Toss confirm API verification (Scout = one job ad, 50 offers per day) | user |
| POST | `/api/v1/user/payments/{orderId}/fail` | Record failure return | user |

- Tables: new subscriptions, payments · shared users, teams, team_members, notifications
- [ ] Server: compare amount with server order value, `[Included]` 7-day free trial + reminder the day before, `[Included]` billing key (first version: one-time payment + expiry date)
- [ ] Frontend: plan comparison, Toss payment widget (test key, "실제로 돈이 나가지 않아요" — no real money is charged), success screen (unlocked benefits), failure screen

### 29. Manage subscription `[Required]` · `/settings/subscription`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| D | D9 afternoon (0.5 day) | 28 | S-2 |

**`SubscriptionManageController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/me/subscriptions` | My subscription and team subscriptions I pay for (Scout for recruiters), next billing / expiry date, next Flex headcount and amount | user |
| GET | `/api/v1/user/me/payments` | Payment history | user |
| POST | `/api/v1/user/me/subscriptions/{subscriptionId}/cancel` | Cancel (kept until period end) | user |
| POST | `/api/v1/user/me/payments/{paymentId}/refund` | Refund (within 7 days + benefits unused) | user |
| POST | `/api/v1/user/me/subscriptions/{subscriptionId}/billing-owner` | `[Included]` Hand over Flex billing owner | user · developers only |

- Tables: new none · shared subscriptions, payments, recruiter_ads (after 04 job ad)
- [ ] Server: expiry → free scheduler (existing content stays; free limits apply to new writes; when Scout ends the job ad becomes ENDED and offers drop to 10), `[Included]` 7-day grace after payment failure
- [ ] Server: Flex 30-day grace after it ends (`grace_ends_at`) and notices, compute `seats` and amount from the billing-date headcount, day-before headcount/amount notice
- [ ] Frontend: current plan, history, cancel/refund confirm sheets

### 30. My stats `[Included]` · `/me/stats`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| B | D9 afternoon (0.5 day) | 04, 23, 28 | S-4, S-10 |

**`StatsController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/user/me/stats/summary` | Free: likes, comments and views per post | user · developers only |
| GET | `/api/v1/user/me/stats/recruiter-views?weeks=8` | Pro: recruiter view count (this week, by week). Count only, never who | user · developers only · Pro |
| GET | `/api/v1/user/me/stats/posts?days=30` | Pro: per-post views by traffic source, 30-day trend, README expands | user · developers only · Pro |

- Tables: new none · shared profile_visits, post_views, posts, post_likes, comments, subscriptions
- [ ] Frontend: free area + blurred Pro area ("Pro로 보기" (View with Pro) → 28), traffic source bars and 30-day trend chart (summary sentence + "표로 보기"), "대표 작업물로 고정" (pin as featured) shortcut

## 4-9. Recruiting (minimal)

### 31. Recruiter sign-up `[Included]` · `/recruiter/signup`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D7 afternoon–D8 morning (1 day) | 03, 04, 06 | H-1, POL-H-1 |

**`RecruiterSignupController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| POST | `/api/v1/public/recruiter-signup/email-codes` | Check company email (reject free domains and existing accounts) → send 6-digit code (once per minute) | public |
| POST | `/api/v1/public/recruiter-signup/email-codes/verify` | Verify code (10 min; new code after 5 wrong) → sign-up token | public |
| POST | `/api/v1/public/recruiter-signup` | Sign-up token + password, name, company, job title, website, consents → create in one transaction + login cookie | public |

- Borrowed: `recruiter-terms` document (03)
- Tables: new 🟡 recruiter_profiles, 🟡 email_verifications · shared users (user_type, job_seeking_status), auth_identities, user_agreements, user_sessions
- [ ] Server: mail service (shared by codes and reset; Mailpit in dev), free-domain list as config, store code hashes, username `r-` + number, bcrypt, age 19+
- [ ] Server: test that `@DeveloperOnly` is on every developer-only API (call all write APIs with a recruiter account → 403)
- [ ] Frontend: stepped (terms → email verification → account & company), resend countdown, done → `/feed` (3 bottom tabs)

### 32. Recruiter login & password reset `[Included]` · `/recruiter/login`, `/recruiter/reset`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D9 morning (0.5 day) | 31 | H-1 |

**`RecruiterLoginController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| POST | `/api/v1/public/recruiter-auth/login` | Email + password (10-min lock after 5 failures), restore if pending withdrawal | public |
| POST | `/api/v1/public/recruiter-auth/password-reset-requests` | Send reset link (same response whether or not registered) | public |
| GET | `/api/v1/public/recruiter-auth/password-reset/{token}` | Whether link is valid (30 min, single use) | public |
| POST | `/api/v1/public/recruiter-auth/password-reset` | New password → end all other sessions | public |

- Borrowed: password change is 06's `PATCH /api/v1/recruiter/me/password`
- Tables: new none · shared auth_identities, email_verifications, user_sessions, users, recruiter_profiles, user_blocks
- [ ] Frontend: login form and lock notice, forgot password, reset screen, 06's recruiter section

### 33. Sent offers list `[Included]` · `/recruiter/offers`

| Owner | Schedule | Prereq | Basis |
| --- | --- | --- | --- |
| A | D9 afternoon (0.5 day) | 31, 17 | H-3 |

**`RecruiterOfferController`**

| Method | Path | Does | Permission |
| --- | --- | --- | --- |
| GET | `/api/v1/recruiter/offers?status=TALKING\|WAITING\|NO_RESPONSE` | Sent offers (rejected shows WAITING for 30 days, then NO_RESPONSE — rejection is never in the response) | recruiter |
| GET | `/api/v1/recruiter/offers/counts` | Count per tab | recruiter |
| GET | `/api/v1/recruiter/offers/summary` | My page summary (in conversation, awaiting reply, offers left today N/10, Scout N/50, latest 3) — borrowed by 04 | recruiter |
| GET | `/api/v1/recruiter/offers/{roomId}/first-message` | Sheet with the first message I sent | recruiter |

- Tables: new none · shared chat_rooms (request_kind = RECRUITING), chat_messages, users, user_tech_tags, user_blocks
- [ ] Frontend: tabs (nuqs), row (first 3 stack tags, job-seeking badge, first message one line), "대화 열기" (Open chat) → 17 when in conversation, "볼 수 없는 사용자" (Unavailable user) for blocked/withdrawn, empty state

---

## 5. Controller list

| # | Controller | Owner | Role | Endpoints |
| --- | --- | --- | --- | --- |
| 00 | `AuthSessionController`, `TechTagController`, `UploadController`, `ReportController`, `BlockController`, `GithubWebhookController`, `SitemapController` | A, A, E, E, E, B, B | user · public · webhook | 12 |
| 01 | `LoginController` | A | public | 2 |
| 02 | `OnboardingController` | A | user | 4 |
| 03 | `LegalController` | A | public | 2 |
| 04 | `ProfileController` | A | public · user · recruiter | 12 |
| 05 | `ProfileEditController` | A | user · recruiter | 4 |
| 06 | `SettingsController` | A | user · recruiter | 7 |
| 07 | `WorkspaceController` | B | user | 2 |
| 08 | `TeamCreateController` | B | user | 9 |
| 09 | `TeamSettingsController` | B | user | 18 |
| 10 | `InviteController` | B | public · user | 2 |
| 11 | `IssueListController` | C | user | 6 |
| 12 | `IssueDetailController` | C | user | 8 |
| 13 | `IssueCreateController` | C | user | 4 |
| 14 | `BoardController` | C | user | 1 |
| 15 | `CalendarController` | C | user | 1 |
| 16 | `ChatListController` | D | user | 4 + 1 STOMP subscription |
| 17 | `ChatRoomController` | D | user · recruiter + STOMP | 21 + 4 realtime paths (plus 16's list-update subscription; 5 shared paths total) |
| 18 | `NotificationController` | D | user | 7 |
| 19 | `RecruitListController` | E | public · user | 4 |
| 20 | `RecruitEditorController` | E | user | 7 |
| 21 | `RecruitDetailController` | E | public · user | 6 |
| 22 | `PostEditorController` | E | user | 5 |
| 23 | `PostDetailController` | E | public · user | 11 |
| 24 | `FeedController` | E | public · user | 7 |
| 25 | `AdminReportController` | A | admin | 6 |
| 26 | `AdminUserController` | B | admin | 6 |
| 27 | `AdminAuditController` | B | admin | 2 |
| 28 | `SubscribeController` | D | user (developers and recruiters) | 5 |
| 29 | `SubscriptionManageController` | D | user (developers and recruiters) | 5 |
| 30 | `StatsController` | B | user | 3 |
| 31 | `RecruiterSignupController` | A | public | 3 |
| 32 | `RecruiterLoginController` | A | public | 4 |
| 33 | `RecruiterOfferController` | A | recruiter | 4 |

Controllers mixing more than one role on one page (04, 05, 06, 10, 17, 19, 21, 23, 24) put only `@RequestMapping("/api/v1")` on the class and start each method path with the role. Others may put `/api/v1/{role}` on the class.

## 6. Risks and deferral order

| Risk | Signal | Response |
| --- | --- | --- |
| GitHub App install or Projects fields blocked in the spike | By end of D2, install return or Blocked status doesn't work | 08 step 4 offers only "새로 만들기" (Create new); Blocked as a separate single-select field (07 TODO 00) |
| 17 team chat not done by D5 | D5 integration check fails | Move photo attachments and unread-by sheet to D7; 21 accept does only chat join first |
| An owner slips a day or more | 1 day behind the day table | Defer `[Included]` first: job ads (the ad items on 04, 05, 24, 25, 28, 29) → 30 → share sheet, share cards, link cards (00, 17) → 11 progress card → 17 AI summary → 31–33 (keep job-seeking status) → 08 existing board → 25 OTP → 24 2nd-degree → 04 contribution graph |
| Toss confirm fails | D8 checkout → no confirmation | One-time payment + expiry only; billing key and trial after launch |
| Controller 1:1 duplicates logic | Two similar queries in code review | Lift into a domain service called by both controllers (rule 3 in 1-3) |

## 7. To be decided

- [ ] Whether roles split into frontend/backend (if so, redo the 2-1 schedule in pairs)
- [ ] Backend host (server, Postgres, Redis, Seoul region) — B must decide on D1 so the webhook and STOMP spikes can run
- [ ] Email sending service (31, 32) — real sending account for the demo
- [ ] AI summary model — whether an Ollama open model runs within the backend server's memory, otherwise a low-cost API (B checks on D9)
- [ ] PR rule: when adding a method to someone else's controller (07 my issues, 17 PR posting), the owner reviews
