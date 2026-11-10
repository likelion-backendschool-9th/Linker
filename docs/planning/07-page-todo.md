# Linker Page-by-Page TODO

> Question this document answers: **Which pages do we actually build in the MVP, what goes into each, and in what order?**
> Reasons and completion conditions are in the [PRD](02-prd.md), scope in the [MVP Definition](03-mvp-definition.md), and numbers and exception rules in the [Policy](04-policy.md) (the source). Numbers here are copies for convenience; update them when the Policy changes.
>
> **UI copy in quotes is kept in Korean** (the app's language); use it as-is. English glosses are in parentheses where helpful.

## 0. At a glance

- **The screen map's 73 MVP pages were reduced to 30.** No feature was removed: screens showing the same data became tabs, short inputs became sheets, operations screens became list filters. What moved where is in [ch. 12](#12-screen-map-73--30-mapping).
- **Adding minimal recruiting to the MVP added pages 31–33, for 33 in total.** New pages are recruiter sign-up/login and the sent offers list; job-seeking status and recruiting offers only add items to existing pages (02, 04, 05, 16, 17, 23, 24, 26). Feed job ads (Scout subscription) also add no new page, only items on 04 (job ad sheet), 05 (job categories of interest), 24 (ad card), 25 (report target) and 28/29 (Scout plan). The 2026-10-30 subscription revamp also adds no new page: the post share sheet (00 common sheet; buttons on 23, 21, 04), Linker link cards (17), the project progress graph (11) and the recruiter view alert (04, 30) attach to existing pages. Recruiter-side items on existing pages are marked `(after 31)`.
- **Assumptions**: portfolio project built by 5 people in 2 weeks, Next.js web + Expo WebView app, Spring backend, Toss Payments test mode, no store release.
- **Ordering principle**: pages that create data and sheets used by later pages come first. Login → teams → issues → chat → Find Team → posts → operations → subscription → recruiting, same as MVP Definition ch. 4. Login is first because every write/reaction assumes a logged-in member — it does not gate the entrance. Feed, posts, recruit posts and profiles are readable by guests (Policy POL-A-9).
- **Markers**
  - `[Required]` without it the core flow (find team → collaborate → project post) or an MVP launch condition breaks
  - `[Included]` in scope, but first to be deferred if the schedule slips
  - `(sheet)` bottom sheet/modal over a page; no separate page
  - `Server:` backend work

### Page list and order

| # | Page | Route | Marker | Needs first |
| --- | --- | --- | --- | --- |
| 00 | Common foundation (not a page) | — | Required | None |
| 01 | Start / login | `/`, `/auth/callback` | Required | 00 |
| 02 | Onboarding | `/onboarding` | Required | 01 |
| 03 | Legal documents | `/legal/[slug]` | Required | 00 |
| 04 | Profile | `/user/[login]` | Required | 02 |
| 05 | Edit profile | `/settings/profile` | Required | 04 |
| 06 | Settings | `/settings` | Required | 01 |
| 07 | Workspace home / my issues | `/workspace`, `/workspace/issues` | Required | 01 |
| 08 | Create team | `/teams/new`, `/teams/new/callback` | Required | 07 |
| 09 | Team settings & members | `/teams/[id]/settings` | Required | 08 |
| 10 | Accept invite | `/invite/[code]` | Required | 09 |
| 11 | Issue list | `/teams/[id]/issues` | Required | 08 |
| 12 | Issue detail | `/teams/[id]/issues/[issueId]` | Required | 11 |
| 13 | Create issue | `/teams/[id]/issues/new` | Required | 12 |
| 14 | Status board | `/teams/[id]/board` | Required | 12 |
| 15 | Calendar | `/teams/[id]/calendar` | Required | 12 |
| 16 | Chat list | `/chats` | Required | 08 |
| 17 | Chat room (team & 1:1) | `/chats/[roomId]` | Required | 16, 12 |
| 18 | Notifications | `/notifications` | Required | 12, 17 |
| 19 | Recruit post list | `/recruits` | Required | 04 |
| 20 | Write/edit recruit post | `/recruits/new`, `/recruits/[id]/edit` | Required | 19 |
| 21 | Recruit post detail (apply & manage applicants) | `/recruits/[id]` | Required | 20, 08, 17 |
| 22 | Write/edit project post | `/posts/new`, `/posts/[id]/edit` | Required | 04 |
| 23 | Project post detail | `/posts/[id]` | Required | 22 |
| 24 | Home feed | `/feed` | Required | 23 |
| 25 | Ops: reports | `/admin/reports` | Required | 00 (report sheet), 23 |
| 26 | Ops: users | `/admin/users` | Required | 25 |
| 27 | Ops: action log | `/admin/audit` | Required | 25, 26 |
| 28 | Plans & checkout | `/subscribe` (+ success/fail return) | Required | 04, 09, 17, 20, 22 |
| 29 | Manage subscription | `/settings/subscription` | Required | 28 |
| 30 | My stats | `/me/stats` | Included | 04, 23, 28 |
| 31 | Recruiter sign-up | `/recruiter/signup` | Included | 03, 04, 06 |
| 32 | Recruiter login & password reset | `/recruiter/login`, `/recruiter/reset` | Included | 31 |
| 33 | Sent offers list | `/recruiter/offers` | Included | 31, 17 |

Workspace home (07) comes before Find Team (19) because accepting an applicant means "add team member + join team chat". Without teams and chat rooms, the accept button can't be tested end to end.

---

## 1. Common foundation

### 00. Common foundation `[Required]` · days 1–2, everyone

Not a page, but everything every page relies on. Adding it later means reworking every page, so it's done in the first two days.

**Risky areas to verify first (day 1–2 spikes)**

- [ ] GitHub login in the WebView app: authenticate in system browser → return to app via deep link → hand session to WebView
- [ ] GitHub App install: install screen → return via Setup URL → server confirms with `GET /user/installations`
- [ ] GitHub Projects: create a "Linker" board, add a Blocked value to Status (if impossible, a separate single-select field), write start/due date field values
- [ ] `projects_v2_item`, `issues`, `pull_request` webhooks reach the dev server (local via a tunnel such as smee.io)
- [ ] STOMP connect / disconnect / reconnect
- [ ] Toss Payments test key: checkout → server approval API → payment cancel

**Frontend**

> Foundation used by every page, so built before any page. Build order and the "end-of-D2 check" list are in the [03 frontend blueprint §1-1](../development/03-frontend-blueprint.md#1-1-foundation-built-before-pages-the-most-important-work); code rules in the blueprint chapter noted in parentheses.

- [ ] pnpm monorepo, Next.js App Router, CSS Modules + design tokens + `radix-ui`, orval-generated API hooks, TanStack Query, Zustand, nuqs setup
- [ ] One API call function (`api-fetch.ts`, works on server and browser) and common handling of failure codes (`LOGIN_REQUIRED`, `PLAN_LIMIT`, `RATE_LIMITED`, `SUSPENDED`, `GITHUB_UNAVAILABLE`) (blueprint 5-4)
- [ ] 6 role-based route groups (`(auth)` `(public)` `(member)` `(developer)` `(recruiter)` `(admin)`) and group `layout.tsx` files (blueprint ch. 3)
- [ ] Access table `route-access.ts`: the one place that encodes Policy ch. 2's table; read by both `proxy.ts` and group `layout.tsx` (blueprint ch. 4)
- [ ] Page frame `PageFrame`: one `header`, `main` and bottom `nav` per page, one `h1`, "본문 바로가기" (skip to content) (blueprint 6-1)
- [ ] Sheet/modal open-close `useOverlay()`: one URL param (`overlay`), push a history entry only on first open, closing pops that entry → back navigation never traps. Top-bar back `useAppBack()` (blueprint ch. 7)
- [ ] Policy number constants `policy.ts`, dates in KST (`@date-fns/tz`), browser API guards (`safeStorage`, `useIsClient`) (blueprint 11-1)
- [ ] Common metadata function, `robots.ts`, search exposure table; `next/image` config + install sharp (blueprint ch. 8, 10). Root OG defaults (Linker + one-line intro + `/og-default.png`); content-based OG only on 23, 21, 04 (developers). Strip `?from=share` from canonical and `og:url`
- [ ] Web↔app bridge (`packages/bridge`, `NativeBridgeProvider`): Android back, GitHub login return, share, push permission (blueprint ch. 11, 12)
- [ ] Test setup: Vitest + vitest-axe, Playwright + axe, MSW (orval mocks) (blueprint ch. 14)
- [ ] Mock data mode for frontend work before the backend is live: `pnpm dev:mock`, one mock file per page with the WBS endpoints, role switcher (guest / developer / recruiter / operator) (blueprint §1-2)
- [ ] App layout: 4 bottom tabs (Home / Find Team / Workspace / Chat), top header (bell + unread count + profile icon; "로그인" button and "설정" icon in their place for guests). Keep the tab list as an array switchable by member type (recruiter: Home / Chat, after 31)
- [ ] Access guard (`proxy.ts`, Next.js 16's new name for middleware): pages open per role (guest / developer / recruiter / operator) follow [Policy ch. 2 "Access by role"](04-policy.md#access-by-role) exactly. Guests can open only read URLs (`/`, `/feed`, `/posts/[id]`, `/recruits`, `/recruits/[id]`, `/user/[login]`, `/legal/[slug]`, `/invite/[code]`, `/recruiter/signup`, `/recruiter/login`, `/recruiter/reset`, `/auth/callback`); any other URL shows the login-prompt sheet + `returnTo` (33 `/recruiter/offers` also shows the login prompt). Onboarding incomplete → `/onboarding`; `/admin` operators only (404 for non-operators incl. guests); recruiters can't access team, write-recruit-post or write-post URLs (after 31)
- [ ] Common components: bottom sheet, confirm modal, toast, empty state, error state, skeleton
- [ ] `error.tsx` (unexpected error, retry), `not-found.tsx` ("삭제되었거나 볼 수 없는 콘텐츠예요" — deleted or unavailable content). Replace the screen map's "error" and "unavailable content" pages
- [ ] Common banners: offline ("인터넷 연결이 끊겼어요…"), GitHub unstable ("최신 정보가 아닐 수 있어요"), suspended ("N월 N일까지 이용이 제한됐어요 · 이의 제기하기")
- [ ] Common sheet: login prompt ("로그인한 사용자만 쓸 수 있는 기능이에요" + "GitHub로 시작" + "채용 담당자 로그인"; return to the same screen after login). For guests, like/comment/follow/apply/message/report/block/write buttons and the Workspace/Chat tabs open this sheet. Wrap with a single `useRequireLogin()` hook
- [ ] Common sheets: report (choose reason + other text), block confirm, external site confirm (first time per domain), delete confirm, limit-reached subscription prompt, restore draft
- [ ] `[Included]` Common share sheet (`ShareSheet`): exactly two options, "링크 복사" (Copy link) / "채팅방에 공유" (Share to chat room). Copy link puts the URL with `?from=share` on the clipboard and shows a toast. "Share to chat room" moves to a chat room picker (my team chat rooms + open 1:1 rooms, most recent first, search by name); picking one sends immediately and shows "○○에 공유했어요 · 채팅방으로 가기". Guests tapping "Share to chat room" get the login prompt. Server API is in 17 (connect after 17)
- [ ] Format functions: time ("방금", "N분 전", "10월 16일", "2025. 10. 16."), numbers ("1.2천", "1.2만"), character count (trim leading/trailing whitespace)
- [ ] Image uploader: JPG/PNG/WebP/GIF, 10MB each, upload progress, retry failed
- [ ] Shared hook: on send failure, save draft on device (7 days) + "다시 보내기" (resend)

**Server**

- [ ] Separate member table and login-method table (to attach 31's recruiter email sign-up). Have member type (`user_type`: developer / recruiter) as a column from the start, and create one "developers only" permission annotation for write APIs
- [ ] Register GitHub App: PRD ch. 8 permissions + **account permission "Email addresses: read"** (gets verified email even without a public email, removing the email verification screen)
- [ ] JWT in httpOnly cookie; GitHub tokens stored encrypted, auto-refresh on expiry
- [ ] Webhook endpoint + signature verification + async processing queue (Redis)
- [ ] Image storage (presigned upload), resize long side to 2,048px, strip EXIF
- [ ] Notifications table and `NotificationService.create()` (built first so later pages just call it)
- [ ] Reports table + `POST /reports` (same person & target = 1 report, hidden from reporter immediately, temp-hidden at 5 different reporters)
- [ ] Blocks table + query filter (shared by feed, profile, comments, 1:1 chat, applications)
- [ ] Rate limits (Redis): posts 10/day, comments 10/min & 300/day, follows 200/day, recruit posts 5/day, applications 20/day, chat 5/sec, reports 20/day, issues 100/day, recruiting offers 10/day (Scout 50), share to chat room 10/min & 100/day, `[Included]` job ad edits 10/day and ad impressions 3 per person per day
- [ ] Plan limits in one place (`PlanLimits`): photos 5/10, featured posts 1/5, concurrent recruit posts 3/10, post stats basic/traffic sources, recruiter view alert none/yes (Pro), team members 6/no limit, team chat search & scroll-back 60 days/all, team chat image originals 90 days/all, AI summary none/10 per person per day, progress graph none/yes (Flex), `[Included]` job ads 0/1 and recruiting offers 10/50 per day (Scout). Subscription page (28) only changes the plan value
- [ ] User status (active / suspended / pending deletion / deleted) and a filter blocking writes while suspended
- [ ] Last-seen timestamp: used for 30-day auto-off of "looking for team" and 90-day inactive owner handling
- [ ] Sentry (frontend & backend)

**WebView app (Expo)**

- [ ] Shell that loads the web URL, back handling, external links in the system browser
- [ ] GitHub login deep link (`linker://auth`)
- [ ] Verify photo picking works via the WebView's `<input type="file">`

---

## 2. Login and my profile

### 01. Start / login `[Required]` · `/`, `/auth/callback`

> Basis: A-1 · Needs first: 00 · Merged from the screen map: account recovery page → auto-recovery in the login callback

**Start screen**

- [ ] Service intro in 3 blocks (find a team · work together · show your work)
- [ ] "GitHub로 시작" button (web: same window; WebView app: system browser)
- [ ] `[Included]` Small link at the bottom "채용 담당자이신가요?" (are you a recruiter?) → 31 sign-up / 32 login (after 31)
- [ ] "둘러보기" (browse) button → `/feed` (no login)
- [ ] If already logged in, go to `/feed`
- [ ] Links to Terms and Privacy Policy (03)

**Login callback**

- [ ] Loading screen, `state` validation
- [ ] Server: exchange code → look up member by GitHub user id → create if missing; update handle if changed
- [ ] New member → `/onboarding`; existing → original destination (`returnTo`) or `/feed`
- [ ] Member pending deletion (within 30 days) → auto-restore to active + "계정을 복구했어요" (account restored) toast
- [ ] Permanently suspended GitHub account → notice that sign-up/login isn't possible
- [ ] On failure, show reason and "다시 시도" (retry)
- [ ] Login session 30 days, extended on each use

**Policy & exceptions**

- [ ] Guests land directly via shared links (posts, recruit posts, profiles) and can only read. Scope per Policy POL-A-9

### 02. Onboarding `[Required]` · `/onboarding`

> Basis: A-1, A-2, A-3, POL-A-1 · Needs first: 01 · Merged: terms consent + notification email verification + basic profile setup → one stepper page

**Step 1: Terms consent**

- [ ] Consent to Terms and Privacy Policy (required), marketing (optional)
- [ ] "보기" (view) per item → 03 legal documents
- [ ] Server: store agreed terms version and time

**Step 2: Basic profile**

- [ ] Display name (required, 1–20 characters) and bio (optional, up to 160 characters); start with empty fields
- [ ] Tech stack picker sheet (predefined tags, max 5) → reused in 05
- [ ] Choose job-seeking status (구직 중 / 제안만 받기 / 끔, default 끔) in the picker → reused in 05
- [ ] Done → `/feed` (starts with an empty feed)

**Policy & exceptions**

- [ ] Leaving and returning resumes from the remaining step
- [ ] Server: receive the verified email from GitHub and store it for notifications/account notices (not shown on profile). Show an email input only if it couldn't be fetched `[Included]`
- [ ] Server: seed data for the tech stack tag list

### 03. Legal documents `[Required]` · `/legal/[slug]`

> Basis: MVP launch condition (terms linked from sign-up and settings) · Needs first: 00 · Merged: Terms + Privacy Policy + community policy → one document viewer

- [ ] Render three documents `terms`, `privacy`, `community` from markdown (docs 05, 06, Policy ch. 9; render the Korean originals)
- [ ] Show effective date and version, table of contents
- [ ] Linked from onboarding (02) and settings (06)
- [ ] No contact page; a mail link instead (replaces the screen map's "contact us" page)

### 04. Profile `[Required]` · `/user/[login]`

> Basis: A-2, A-4, A-5, A-6, P-5, P-7, C-4, H-7, S-10 · Needs first: 02 · Merged: followers/following pages → sheet
> Built in two passes. Pass 1 now (header, graph, completion record); pass 2 after 22 (post list, pinned posts, message button).

**Pass 1**

- [ ] Header: avatar, display name, @handle, bio, blog, GitHub link, tech stack chips, "팀 찾는 중" badge, "구직 중" badge ("제안만 받기" shows as "제안 받는 중" only when a recruiter views)
- [ ] Follower/following counts → (sheet) two-tab list (guests see counts only; tapping opens login prompt)
- [ ] Own profile: "프로필 편집" (edit profile), "설정" (settings) buttons
- [ ] Others' profile: follow/unfollow (applied on screen first, reverted on failure), more → (sheet) block/report
- [ ] Completion record: number of completed projects, completion rate of assigned issues. If none yet, "아직 완료한 프로젝트가 없어요"
- [ ] `[Included]` Contribution graph: monthly calendar, swipe through the last 12 months, monthly total, help text ("커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 잔디에 잡혀요")
- [ ] `[Included]` If the graph fails to load, show "N일 전 기준"; if never loaded, hide the graph area
- [ ] Server: fetch GraphQL `contributionCalendar` once a day via scheduler and cache
- [ ] Server: follow API (200/day), create follow notification

**Pass 2 (after 22)**

- [ ] Post list (my post cards)
- [ ] `[Included]` Pin featured posts: (sheet) choose posts, reorder, Free 1 / Pro 5, subscription prompt if over
- [ ] "메시지" (message) button → 17 1:1 chat (direct if mutual follow / same team, otherwise message request)
- [ ] Teams (active / completed)
- [ ] Server: record recruiter profile views (once per recruiter per day, after 31) → for 30 view count and the Pro weekly notice
- [ ] `[Included]` Share button → 00 share sheet (profile URL)
- [ ] `generateMetadata` + `opengraph-image.tsx` (avatar, name, tech stack). Developer profiles only; recruiter profiles use the default (blueprint 8-3)

**Recruiter side (after 31)**

- [ ] Recruiter profile layout: name, company, job title, "회사 메일 인증(@domain)", company website. No graph, completion record, posts or follow area
- [ ] Recruiter my page (own profile): the header above + "프로필 편집", "설정" + offer summary (in conversation N · awaiting reply N · offers left today N/10, Scout N/50) + last 3 offered developers → "전체 보기" (see all) → 33
- [ ] `[Included]` Job ad card (my page): status (showing / off / ended / hidden), posting title, job category, closing date, on/off switch, "수정" (edit) → (sheet). Without Scout: "Scout를 구독하면 관심 직군이 맞는 개발자의 피드에 채용 광고를 띄울 수 있어요" (Subscribe to Scout to show job ads to developers with matching job categories) + button to 28
- [ ] `[Included]` (sheet) Register/edit job ad: one job category (chips), posting title (2–40 chars), posting URL, closing date (today to +90 days). Card preview before saving (exactly as in the feed). URL rejection copy in Policy ch. 12
- [ ] `[Included]` Server: save-ad API (one per recruiter, 10 edits/day), URL check (https; allowed job site list or `recruiter_profiles.company_email_domain` and its subdomains; reject short URLs and IPs), Scout subscription check
- [ ] `[Included]` Server: at 00:00 daily, ads past the closing date → ended + notify the recruiter; stop showing on subscription expiry (called from 29's expiry handling)
- [ ] When a recruiter views a developer profile: "채용 제안 보내기" instead of follow (only if Seeking / Open to offers) → 17 request composer
- [ ] When a developer views a recruiter profile: no follow/message buttons; more → block/report only

**Policy & exceptions**

- [ ] If blocked, show "볼 수 없는 프로필" (unavailable profile) instead
- [ ] Suspension is not shown on profiles
- [ ] `[Included]` If the GitHub handle changed, redirect the old URL to the new one for 90 days

### 05. Edit profile `[Required]` · `/settings/profile`

> Basis: A-2, A-3, H-4, H-8 · Needs first: 04

- [ ] Display name (1–20 chars), bio (160), one blog link (https only)
- [ ] Tech stack (reuse 02's sheet, max 5)
- [ ] Toggle "팀 찾는 중"
- [ ] Job-seeking status (reuse 02's picker)
- [ ] `[Included]` Job categories of interest: job category chips up to 3, empty by default, hint "관심 직군을 고르면 그 직군의 채용 광고만 피드에 보여요. 비워 두면 광고가 뜨지 않아요." Visible only to the developer (not shown on 04 profile)
- [ ] "GitHub에서 다시 불러오기" (reload from GitHub)
- [ ] Avatar comes from GitHub as-is (no upload)
- [ ] Server: auto-off "looking for team" after 30 days without login (scheduler)
- [ ] Server: after 90 days without login set job-seeking to Off (same scheduler), notify on next login
- [ ] `[Included]` Recruiter edit (after 31): name, company, job title, company website. Company email can't change (sign up again to change)

### 06. Settings `[Required]` · `/settings`

> Basis: POL-A, POL-N-1, block & deletion policies · Needs first: 01 · Merged: account management + blocked users + delete account + contact → sections and sheets on one page
> Logout is needed for testing right away, so it goes in on day 1; other sections are filled in as features arrive.

- [ ] Logout (confirm modal) ← first
- [ ] Account: linked GitHub (@handle), view/change notification email
- [ ] Notifications: "푸시 알림" (Push notifications) on/off switch. Off stops push only; the in-app list keeps filling. In a web browser, show "푸시는 Android 앱에서만 받아요" (Push is only received in the Android app)
- [ ] Subscription & billing → 29
- [ ] Blocked users → (sheet) list of active blocks, unblock; server closes the blocking period instead of deleting it (ERD `user_blocks`)
- [ ] 3 legal docs → 03, contact (mail link), app version
- [ ] Delete account → (sheet) show teams I own; must transfer ownership or delete the team to proceed → final confirm → pending deletion (deleted after 30 days)
- [ ] Server: scheduler deleting after 30 days pending (delete posts/comments; team chat messages become "탈퇴한 사용자")

---

## 3. Creating teams and invites

### 07. Workspace home `[Required]` · `/workspace`, `/workspace/issues`

> Basis: T-1, I-5 · Needs first: 01 · Merged: my team list + my issues → one page
> First screen of the Workspace tab. By team decision (PR #35, 2026-11-01), C implements My issues at `/workspace/issues`; B links “내 이슈 전체 보기” from `/workspace`. This remains page 07 with the same access rules; the team list uses `TeamController` and My issues uses `IssueController` (WBS §4-7, §4-8).
> **2026-11-03**: My issues are no longer a cross-team dump. The user picks one of their teams; the list shows only issues assigned to them in that team. Default team = most recently joined (`team_members.joined_at`).
> **2026-11-03 (home preview)**: `/workspace` shows a **short preview** of those issues (UI-limited; roughly a few rows — not a fixed count), ordered by due urgency. The full selected-team list lives on `/workspace/issues` via “내 이슈 전체 보기”. Team-wide issues (everyone’s) remain on 11.

- [ ] My teams: grouped active / completed / read-only / archived; team card (org avatar, team name, member count, status) → tap opens **11** (`/teams/[id]/issues`) for that team’s full issue list
- [ ] "팀 만들기" (create team) button → 08
- [ ] No teams: "팀 만들기" + "팀 찾으러 가기" (go find a team, 19)
- [ ] `[Included]` My issues on `/workspace` (preview): team picker; changing the team reloads the preview. Short preview of open issues assigned to me in the selected team (UI-limited; not a hard N). Sort by due urgency: overdue first (oldest due first), then soonest due date, then no due date last. Overdue in red. Tap → 12. Empty: "배정된 이슈가 없어요"
- [ ] Default selected team = the one I joined most recently (`team_members.joined_at` desc). Prefer non-archived; if every membership is archived, fall back to the newest archived. Keep the choice in the URL (`teamId`, nuqs) so back/refresh keeps it
- [ ] “내 이슈 전체 보기” → `/workspace/issues?teamId=` (same team; **full** list of my assigned issues in that team, same sort, no preview cap); back fallback `/workspace`. B owns the entry link; C owns preview, full list, team picker and data query
- [ ] (sheet) Team switcher: opened from the header inside team pages (used in 11–15). Distinct from the 07 my-issues team picker: switcher navigates into a team; the picker only filters the my-issues list

**Policy & exceptions**

- [ ] Max 10 teams per person (archived excluded); beyond that, show that creating teams / accepting invites isn't possible
- [ ] Picking a `teamId` I'm not in → treat as missing filter and fall back to the default team (do not 404 the page)

### 08. Create team `[Required]` · `/teams/new`, `/teams/new/callback`

> Basis: T-1, T-3, POL-T-1, POL-I-1 (board prep) · Needs first: 07, 00 spikes · Merged: start + install check + board link → one stepper page
> The riskiest page. Issues, chat and recruit acceptance all depend on it working.

**Step 1: Intro**

- [ ] Explain "GitHub 조직 1개 = 팀 1개" (1 GitHub org = 1 team)
- [ ] "GitHub에서 설치하기" (install on GitHub) → GitHub App install screen (org chosen on GitHub)
- [ ] "조직이 없어요" (I have no org) → send to GitHub's create-org page and back (orgs can't be created via API)

**Return (`/teams/new/callback`)**

- [ ] Server: don't trust the installation id in the return URL; verify by calling `GET /user/installations` with the user token
- [ ] If not owner and it ended as an "install request" → status screen "오너에게 설치 요청을 보냈어요" (sent install request to owner)
- [ ] If the org is already linked to another team, explain

**Step 2: Team info**

- [ ] Team name (default: org name), intro

**Step 3: Link repos**

- [ ] Checklist of repos where the app is installed only; others get a "GitHub에서 접근 허용하기" link

**Step 4: Link board**

- [ ] If the org has no board, auto-create a "Linker" board + 4 statuses (Todo / In Progress / Blocked / Done; fixed colors GRAY / BLUE / RED / GREEN) + Start date and Due date fields
- [ ] `[Included]` If boards exist, choose "새로 만들기 / 기존 보드 쓰기"; for existing boards preview name, card count, status columns + option `color` → map to the 4 statuses → persist option colors on `board_status_mappings` → add missing date fields. If the schedule slips, ship with "create new" only
- [ ] One board per team; changing later only in team settings (09)

**Step 5: Permission check and done**

- [ ] If the org's default repo permission is read: "팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요" + GitHub settings link
- [ ] Done screen: "초대 링크 보내기" (send invite link, 09), "모집 글 쓰기" (write recruit post, 20)
- [ ] Server: on team creation, **create the team chat room** and register the owner as a member (16 and 17 use this data)
- [ ] Server: enqueue the first full sync (issues, PRs, org members)
- [ ] Server: `installation` webhook (app removed → team read-only, archived after 30 days), `organization` webhook (sync member add/remove)

### 09. Team settings & members `[Required]` · `/teams/[id]/settings`

> Basis: T-2, T-3, T-4, POL-T permission table · Needs first: 08 · Merged: team members + invite members + linked repo management + team settings + team plan → sections on one page

**Pass 1 (needed to test issues and chat)**

- [ ] Member list: role (owner / admin / member), GitHub org status (member / invited / not a member), count "N/6"
- [ ] Create (7-day valid) / revoke / share (Web Share API, copy) invite links — external recipients open `/invite/[code]` (10)
- [ ] Notify a Linker developer of an invite (pick by @handle / GitHub login who already has a developer account): create `TEAM_INVITE` notification with `link_path` `/invite/[code]` so they see it in 18 without needing the external link. Same invite code as the shareable URL
- [ ] Send GitHub org invite: enabled only for the team owner who is also a GitHub org owner, otherwise disabled + reason. Error copy for daily send limit
- [ ] Add/remove linked repos (owner, admin)
- [ ] Hide/disable buttons per permission table (owner / admin / member)

**Pass 2 (after the flow works)**

- [ ] Edit team name and intro
- [ ] Change role, remove member (confirm sheet). Admins can remove members only
- [ ] Leave team (owner can't until ownership is transferred)
- [ ] Transfer ownership: (sheet) choose member → transfers only when they accept; old owner becomes admin
- [ ] Project complete: confirm sheet → team status "완료", undo within 7 days, notify members "작업물 올리기" (post your project, links to 22)
- [ ] Server: completion record calculation (in team at completion and ≥ 14 days membership → 1 completion; left midway → 1 non-completion; issue completion rate), finalized after 7 days
- [ ] `[Included]` Change board (reuse step 4 of 08, owner/admin)
- [ ] Archive; delete (confirm by typing team name, notify members, delete chat after 30 days, don't touch GitHub)
- [ ] Team plan section: current plan, current headcount and next payment amount, "Flex로 올리기" (upgrade to Flex) → 28
- [ ] `[Included]` AI summary on/off (owner only, visible only on Flex teams, after 28)

**Policy & exceptions**

- [ ] At the free team member limit (6), invite links can't be accepted + reason + Flex prompt (Flex has no limit)
- [ ] Removed members can't apply to the same team's recruit posts for 7 days
- [ ] Removed from the GitHub org (webhook) → automatically removed from the Linker team + notify them and the owner
- [ ] Read-only team: settings view-only, reinstall guidance

### 10. Accept invite `[Required]` · `/invite/[code]`

> Basis: T-2, POL-T-2, POL-N-1 · Needs first: 09
> Thin landing (Discord-style join). No team detail preview and no dedicated status screens.
>
> **Two entry paths**: (1) **External** — opening the shared `/invite/[code]` URL (Kakao, Discord, browser) always shows this page. (2) **In-app** — a logged-in developer who was invited sees a team-invite notification in 18; tapping it opens this same URL. Accept always happens here (or via the same accept API).

**Screen (guest and logged-in share the same layout)**

- [ ] Linker logo
- [ ] Primary: "팀에 합류하기" — logged-in developer: accept → add as team member + join team chat → team issues (11). Guest: start GitHub login with `returnTo` this invite URL (same destination as the button below)
- [ ] Secondary: "GitHub로 빠르게 시작하기" — GitHub login with `returnTo` this invite URL; after login/onboarding return here so they can join
- [ ] Recruiter: keep showing the landing; accept/GitHub start blocked with "개발자 계정만 팀에 참여할 수 있어요"

**Errors & metadata**

- [ ] Expired/revoked link, already a member, team at member limit, over 10 teams → toast or one-line error from accept API codes (no separate status pages). Already a member may go straight to 11
- [ ] Static metadata title "팀 초대", root default OG, `noindex` (not content-based OG; blueprint 8-3)

---

## 4. Issues and schedule

11–15 share one team layout (team name + team switcher sheet + tabs: Issues / Board / Calendar / Settings + team chat shortcut). The layout is built in 11.

### 11. Issue list `[Required]` · `/teams/[id]/issues`

> Basis: I-2, I-3, T-7, S-9, POL-I sync · Needs first: 08 · Skeleton of the issue screens and where GitHub sync is validated

- [ ] Team layout and tabs
- [ ] Issue row: repo, number, title, status (+ shared `statusColor` from board mapping, with the name), assignee avatars, due date, labels, overdue in red
- [ ] (sheet) Filters: repo, status, assignee, label, open/closed. Filters stored in URL (nuqs) → reused in 14, 15
- [ ] Title search box (11 only, POL-I-6), stored in URL as `q`; status chips 전체 / 작업 전 / 진행 / 정지 / 완료 with counts (Figma 11)
- [ ] "일정 없음" (no schedule) tab: issues not on the board or without a due date + "프로젝트에 추가" (add to project)
- [ ] Pull to refresh (that screen's issues only, once per minute)
- [ ] "이슈 작성" (create issue) button (hidden for read-only teams / no write permission)
- [ ] Server: issue cache table, first full sync with installation token
- [ ] Server: refresh cache from `issues` and `projects_v2_item` webhooks; full sync every 15 min for active teams, otherwise daily
- [ ] Server: if the same value changes concurrently, the later arrival wins
- [ ] Server: daily 00:00 KST per-team progress snapshot (counts of the 4 status columns, all teams), delete rows older than 1 year. Start collecting before the progress graph exists
- [ ] `[Included]` Progress card (Flex, after 28): top of the issue list. Completion ring + "12개 중 7개 완료, 58%", bars for the 4 status columns (column names written out), last 14 days trend, open issues per assignee (no ranking), overdue and due-within-3-days counts (tap to filter). Each chart has a summary sentence + "표로 보기" (blueprint ch. 6). Free teams see a Flex prompt in the card's place (owner/billing manager: "Flex 알아보기", members: "오너에게 요청")

### 12. Issue detail `[Required]` · `/teams/[id]/issues/[issueId]`

> Basis: I-2, I-3, C-2 · Needs first: 11 · The 4 sheets built here are reused by 13, 14, 15.
> `[issueId]` in the route is the Linker issue id. GitHub issue numbers collide across repos in a team, so they're never used in URLs.

- [ ] Title, body (markdown rendered, scripts stripped), repo & number, author, "GitHub에서 열기" (open on GitHub)
- [ ] (sheet) Assignees: team members with access to that repo, max 10; members who haven't accepted the org invite are excluded
- [ ] (sheet) Labels
- [ ] (sheet) Start / due date: start ≤ due; past dates confirm once with "이미 지난 날짜예요"
- [ ] (sheet) Change status: 작업 전 / 작업 중 / 작업 중단 / 작업 완료 (option colors from board mapping when available). Moving to Done closes the issue, moving back from Done reopens it; Blocked stays open with a "중단" mark. Detail response includes `statusColor`
- [ ] Without repo write permission, assignee/label/status buttons disabled + toast with reason on tap
- [ ] Server: after saving, verify from GitHub's response that the assignee was actually set
- [ ] Server: assignment → create notification
- [ ] If date/status didn't reach GitHub: "일정이 GitHub에 반영되지 않았어요"
- [ ] `[Included]` Sub-issue progress ("하위 3개 중 1개 완료") view-only
- [ ] `[Included]` "채팅에 공유" (share to chat) → 17's issue card (connected after 17)
- [ ] Deleted issue → unavailable content; transferred issue → new location

### 13. Create issue `[Required]` · `/teams/[id]/issues/new`

> Basis: I-1, POL-I-1 · Needs first: 12 (reuses sheets) · Merged: choose template + content → one stepper page

**Step 1: Repo and template**

- [ ] Choose repo (linked repos with write access)
- [ ] Template list: the repo's `.github/ISSUE_TEMPLATE` on top, 3 defaults (bug / feature / task) below. If the repo has none, the org's public `.github` repo templates

**Step 2: Content**

- [ ] Markdown template: title + body pre-filled with the template
- [ ] Issue form (YAML): input, textarea, dropdown, checkboxes as inputs; markdown as help text; upload hidden with "첨부는 GitHub에서" (attach on GitHub) (react-hook-form + zod)
- [ ] Build the body from form answers in GitHub's format (`### question` then answer, empty = `_No response_`)
- [ ] Assignees, labels, dates, status (reuse 12's sheets); labels/assignees in the form are defaults
- [ ] Template parsing fails → default template
- [ ] Server: with the user token, create issue → add to project → start date → due date → status in sequence; middle failures go to a retry queue
- [ ] On failure, save the content on the device and show the reason + "다시 보내기". Never create Linker-only issues
- [ ] 100/day limit; leaving mid-writing → restore-draft sheet
- [ ] `[Included]` When coming from an AI summary to-do (`?fromSummary=&item=`), after choosing the repo pre-fill title and body (to-do + link to the original message) (after 17's AI summary)

### 14. Status board `[Required]` · `/teams/[id]/board`

> Basis: I-4 · Needs first: 12

- [ ] 4 columns (작업 전 / 작업 중 / 작업 중단 / 작업 완료) + an "기타" (other) column for unmapped values; column/card status color from shared `statusColor` (board mapping, POL-I-3), with the status name
- [ ] Card: title, assignees, due date, labels, "중단" mark, overdue in red
- [ ] Drag to change status (dnd-kit; long-press drag on mobile) + card menu "상태 바꾸기" (12's sheet)
- [ ] Move first; if writing to GitHub fails, move back to the original column and notify
- [ ] No drag without write permission
- [ ] Horizontal scroll of columns on mobile; reuse 11's filters

### 15. Calendar `[Required]` · `/teams/[id]/calendar`

> Basis: I-4, N-1 (due reminders) · Needs first: 12

- [ ] Month/week toggle, KST
- [ ] Period bar from start to due date; dot if only a due date
- [ ] Assignee filter, overdue in red
- [ ] Tapping a date opens a sheet listing that day's issues → 12
- [ ] Issues without a due date don't appear (point to 11's "일정 없음" tab)
- [ ] No drag-to-reschedule (phase 2 I-7)
- [ ] Server: notify assignees at 9 AM one day before due (scheduler)
- [ ] Fill 07's "My issues" section now

---

## 5. Team chat and notifications

### 16. Chat list `[Required]` · `/chats`

> Basis: C-1, C-4 · Needs first: 08 (team chat room data) · Merged: message requests → third tab

- [ ] Figma 16 (247:1019 팀, 321:2336 개인, 321:2417 요청): underline tabs "팀 / 개인 / 요청 N", 75px rows (50px photo, name, time, last message, blue unread count), request rows with a red "삭제" circle and no time. Accepting a request happens in 17's request panel (the list has no 수락 button, Figma has none; user request 2026-11-09). Not in the frame but kept small: the muted bell-off after the name, "대기 중" on a sent request.
- [ ] Tabs: 팀 (team) / 개인 (1:1) / 요청 (requests, with count)
- [ ] Room row: name/photo, last message, time, unread count, muted icon
- [ ] Realtime updates (STOMP user queue), bottom tab badge
- [ ] Requests tab: accept / delete; disappears after 30 days
- [ ] Row menu sheet (right-click, keyboard menu key or long press; user reference 2026-11-10, same look as the 19 select sheet): title "{팀}의 채팅방" / "{이름}님과의 채팅방", "완료". 팀 → "팀 나가기" (to 09 team settings, Policy ch. 6 leaving), 개인 → "방 나가기" (17's leave confirm), received request → "방 나가기" (= delete request), all → "읽음 처리" (read up to the row's last message). Sent requests have no menu. No "상단 고정" (pinning has no policy or API)
- [ ] `[Included]` Recruiting offer requests show a "채용 제안" label + company name (after 31). Recruiters see their sent offers as "대기 중" (pending) in the 1:1 tab
- [ ] Rooms with blocked people hidden; after unblocking, messages from blocked periods stay invisible. Use retained `user_blocks` intervals for DM history, catch-up, previews and unread counts; team chat is exempt (Policy ch. 9, ERD ch. 4-8)
- [ ] Empty-state copy

### 17. Chat room (team & 1:1) `[Required]` · `/chats/[roomId]`

> Basis: C-1, C-2, C-3, C-4, C-5, C-7, P-7, S-6, S-8, H-3 · Needs first: 16, 12 · Merged: team chat room + 1:1 chat room + room info + PR list + team chat search → one page (features toggled by team/1:1)
> Complete team chat first; 1:1 chat adds only start rules and request status on the same screen (during the posts/social stage).

**Common (team chat first)**

- [ ] STOMP connection; on disconnect auto-reconnect and load missed messages; over 500 → "안 읽은 메시지 500개+" and jump to last read position
- [ ] Virtualized message list (TanStack Virtual), infinite load upward, date dividers
- [ ] Sending = dimmed; on failure resend/delete buttons; auto-retry 3 times; over 5/sec → send delayed
- [ ] Text 2,000 chars, photo attachments (10 at once, 10MB each) + full-screen photo viewer
- [ ] Read: only when actually visible. Team: unread count (tap → unread-members sheet); 1:1: read/unread
- [ ] (sheet) Message menu: copy, edit (within 24h, "수정됨"), delete ("삭제된 메시지입니다"), report. Team owner/admin can delete others' messages
- [ ] Display states: left member, deleted user, "운영 정책에 따라 숨겨진 메시지예요"
- [ ] Room info (full screen from the header ☰, Figma 351:580): team card (photo, name, "멤버 N명" → 11), members with team role (오너/관리자/멤버, owner first), mute, PR list, bottom "팀 나가기" → 09 team settings (team) / "대화 나가기" (1:1), `[Included]` photo gallery
- [ ] Server: rooms, participants (last read message), messages tables shared by team and 1:1
- [ ] Server: STOMP auth, new message notifications (bundled per room)

**Team chat only**

- [ ] PR system messages: only opened / review requested / merged / closed from `pull_request` webhooks, not deletable, GitHub icon
- [ ] (sheet) PR list: open / merged; tap → GitHub (replaces the screen map's PR list page)
- [ ] @mention autocomplete (mentions notify even if muted); @전체 (@all) owner/admin only
- [ ] #issue-number → converted to a card; repo picker sheet if multiple repos
- [ ] `[Included]` Send issue cards: show latest status, tap → 12, title only for repos without permission
- [ ] `[Included]` Long-press a message → "이슈로 만들기" (make an issue) → open 13 with body pre-filled
- [ ] Header search icon and "AI 채팅 요약" button (Figma 92:768; between the input and the send button) are shown before their features exist; tapping says "미구현 기능입니다." (user decision 2026-11-09)
- [ ] `[Included]` Team chat search & scroll-back: keyword; free teams last 60 days, Flex all history; deleted/hidden excluded. Free teams don't load messages older than 60 days when scrolling up and see "무료 팀은 최근 60일 대화만 볼 수 있어요" + Flex prompt (nothing deleted)

**AI chat summary (Flex, after 28)** `[Included]`

- [ ] "AI 요약" button at the top of team chat rooms; range choice (마지막으로 읽은 뒤 / 오늘 / 최근 24시간 / 마지막 요약 이후). Fewer than 20 messages → "직접 읽는 게 더 빨라요"; over 500 → summarize the latest 500 and say so
- [ ] Free teams: tap → (sheet) "Flex 구독 팀만 쓸 수 있어요". Owner/billing manager get "Flex 알아보기" (7-day free trial if not used yet) → 28; members get "오너에게 Flex를 요청해 보세요"
- [ ] (sheet) Summary result: one-line summary, decisions, to-dos, open questions; tap an item to scroll to the original message; "AI가 만든 요약이라 틀릴 수 있어요"; remaining N/10
- [ ] "채팅에 공유" → minutes card message; "이슈 만들기" per to-do → 13 with title/body pre-filled
- [ ] Over 30 seconds → "요약하는 중이에요" + notify when done; on failure "요약하지 못했어요"
- [ ] While a team has AI summary on, top banner "이 팀은 AI 요약을 사용해요" (first 7 days)
- [ ] Server: messages in range (excluding deleted, hidden, images, blocked users; max 500) → `LlmClient` (default Ollama, JSON response) → keep result 7 days, 10/day per person (Redis), Flex check via `PlanLimits`

**1:1 chat only (with 22–24)**

- [ ] Start rules: direct if mutual follow or same team; otherwise only 1 first message goes to requests
- [ ] Sender sees "상대가 수락하면 대화가 열려요"; recipient sees a bottom panel in place of the composer (Figma 350:123): "{name}님이 메시지 요청을 보냈어요" / "수락 버튼을 누르시면 대화하실 수 있습니다" + 수락 · 거절 (= delete) · 차단
- [ ] Delete (reject) isn't disclosed, and blocks new requests from the same person for 30 days
- [ ] Blocking hides the room from my list and the other's messages aren't delivered to me
- [ ] `[Included]` First external link preview (OG; 1:1 only when mutual follow)

**Share cards and Linker link cards (team and 1:1, with 22–24)** `[Included]`

- [ ] Server: share-to-chat-room API (post / recruit post / profile → `message_type = SHARE_CARD`, storing only target type and id). Only team rooms I belong to and open 1:1 rooms; 10/min, 100/day
- [ ] Server: shareable chat room list API (most recent first; excludes pending requests, blocks, read-only and archived teams)
- [ ] If a message contains a Linker post, recruit post or profile URL, show the first one as the same card (no mutual-follow condition). Separate from the external link preview
- [ ] Cards read the latest state when shown: deleted, hidden or blocked → "볼 수 없는 게시물이에요". Tapping opens the screen; post views via a card are logged with traffic source "chat share"

**Recruiting offers (after 31)** `[Included]`

- [ ] Recruiters always start with a request. Server rejects if the recipient's job-seeking status is Off
- [ ] First message 1,000 chars, no photos, input hint "회사, 직무, 연락하는 이유를 적어 주세요" (write company, role and reason for contact)
- [ ] Sender card at the top of the recipient's request screen (company, job title, "회사 메일 인증")
- [ ] Server: store request kind (`request_kind = RECRUITING`), 10/day limit (Scout 50, `PlanLimits`); 30-day no-re-request after rejection reuses the normal request rule

### 18. Notifications `[Required]` · `/notifications`

> Basis: N-1, POL-N-1 · Needs first: 12, 17 (destination screens must exist) · Marked "not in docs" on the screen map, but the web demo needs this list before push, so Required

- [ ] Notification list: chat, issue assignment, 1 day before due, application received/accepted/rejected, comments, follows, message requests, **team invite (`TEAM_INVITE`)**, sanctions
- [ ] Tabs: 전체 (all) / 읽지 않음 (unread, server `unread=true`; empty → "읽지 않은 알림이 없어요."), kept in the URL (nuqs). Rows grouped by day ("11월 5일" + "오늘" / "N일 전"); each row is a dot (unread dark, read muted) + the title only (Figma 248:1243)
- [ ] Tap → navigate to the screen + mark read; "전체 읽기" (mark all read). Team invite → `/invite/[code]` (10)
- [ ] Header bell badge updates in realtime
- [ ] Sanction notification → (sheet) one-time appeal (replaces the screen map's appeal page)
- [ ] Server: bundle per room; 10 PM–8 AM hold non-chat notifications and send in the morning
- [ ] Push (Android app only): register Expo push tokens and send; tapping opens the app at that URL. iOS push needs a paid Apple developer account, so it is out of the MVP. Not sent while the "푸시 알림" switch in 06 is off
- [ ] Push permission prompt sheet on first launch (Android app)

---

## 6. Find Team

### 19. Recruit post list `[Required]` · `/recruits`

> Basis: R-2, R-3 · Needs first: 04 · Merged: my applications → tab

- [ ] Tabs: 전체 (all) / 내 모집 글 (my posts) / 내 지원 (my applications) (guests: All tab only; other tabs and "모집 글 쓰기" show login prompt)
- [ ] Recruit card: title, remaining slots per role, tech stack, format, deadline D-day
- [ ] (sheet) Filters: role, tech stack, online/offline. Stored in URL (nuqs)
- [ ] Sort: newest / closing soon; infinite scroll; open posts only
- [ ] My applications tab: 검토 중 (under review) / accepted ("팀 채팅 바로가기") / rejected ("이번엔 함께하지 못하게 됐어요") / expired ("모집이 끝났어요"); cancel while under review
- [ ] "모집 글 쓰기" (write recruit post) button → 20
- [ ] Exclude posts by blocked people; no results → "필터를 줄여 보세요"

### 20. Write/edit recruit post `[Required]` · `/recruits/new`, `/recruits/[id]/edit`

> Basis: R-1, S-5 · Needs first: 19

- [ ] Required: title (40 chars), intro (1,000), headcount per role (1–10 per role), format (online / offline / hybrid), deadline (within 60 days from today)
- [ ] Optional: tech stack (max 10), expected duration, region (required if offline), goal (contest / hackathon / launch / learning)
- [ ] "팀 선택" (required; active teams where I'm owner/admin only — cannot publish without a team), placed right under 프로젝트 소개 (Figma 600:715). Notice always shown under the field: "팀이 없으면 모집글을 작성할 수 없습니다."; with no linkable team the select is disabled ("연결할 수 있는 팀이 없어요") and the post can't be saved. Server rejects a missing team (400) or one I can't link (403); on edit, the already-linked team may stay
- [ ] Over 3 concurrent (Pro 10) → subscription prompt; 5/day
- [ ] Edit limits: roles with applicants can't be deleted, headcount can't go below current acceptances
- [ ] Close / reopen (confirm sheet), delete (pending applications become expired with notification)
- [ ] Server: auto-close when deadline passes or all slots fill
- [ ] Leaving mid-writing → restore draft

### 21. Recruit post detail (apply & manage applicants) `[Required]` · `/recruits/[id]`

> Basis: R-3, R-4, P-7 · Needs first: 20, 08 (teams), 17 (team chat) · Merged: received applications → author bottom CTA + applicants drawer

**What applicants see**

- [ ] Body, remaining slots per role, author profile card (visible to guests; "지원하기" shows login prompt)
- [ ] (sheet) Apply: choose one open role only (no "하고 싶은 말")
- [ ] Once per post (one re-apply after cancelling); not on own post or with block relationship
- [ ] Already a member of that team → hide apply CTA (same as author)
- [ ] Show my application status + cancel; more → report
- [ ] Server: application-received notification

**What the author sees**

- [ ] Bottom CTA "지원자 N명 보기" → applicants drawer (filter by role; days left until 14-day auto-expiry)
- [ ] Row: radio (pending only) + avatar/name → public profile (04); pending → row "거절"; after invite → "대기" (stays in list). Rejected/expired leave the list (done). Bottom "초대하기" for the selected inviteable pending applicant. Role remaining 0 → invite disabled
- [ ] Invite: add team member + team chat + notification; when author is team owner and GitHub org owner, also send the GitHub org invite to the applicant
- [ ] Capacity: role full → disable invite (optional "인원 늘리고 초대"); free team at member limit (6) → reason only — no Flex/BM upsell from recruit detail (upgrade lives on team/plan surfaces). No "팀 없음" path — posts require a linked team on 20
- [ ] Reject: row "거절" + (sheet) optional reason; applicant only sees the fixed copy
- [ ] Invite/reject still possible after closing; edit / close / delete menu
- [ ] `[Included]` Share button → 00 share sheet
- [ ] `generateMetadata` (title, "remaining slots per role · closes D-n") + `opengraph-image.tsx` (title, remaining roles, D-n). Defaults if deleted or hidden
- [ ] Server: auto-expire applications unhandled for 14 days + notify
- [ ] `[Included]` Server: if the applicant hasn't accepted the GitHub org invite 7 days after invite, remind applicant and owner
- [ ] `[Included]` Server: if the team is deleted within 7 days after invite, flag for fake-recruitment review

---

## 7. Project posts and social

### 22. Write/edit project post `[Required]` · `/posts/new`, `/posts/[id]/edit`

> Basis: P-1, P-2 · Needs first: 04 · Merged: choose repo + content → one stepper page

**Step 1: Choose repo**

- [ ] Only public repos from my account and orgs I belong to, with search
- [ ] Already-posted repos disabled; forks show "포크" + original
- [ ] Coming from a project-completion notification (09) pre-selects the team repo

**Step 2: Content**

- [ ] Repo card automatic (name, language, stars, URL); body pre-filled with repo description
- [ ] Required: one-line intro (1–60 chars)
- [ ] Body (2,000 chars, line breaks and links only)
- [ ] Photos: Free 5 / Pro 10, reorder, first is the cover, retry partial failures, publish only after all uploaded, subscription prompt if over the limit
- [ ] Optional: my role (40 chars), up to 3 demo links (https), period (start/end month), team size (1–50), up to 5 tags (sheet)
- [ ] Auto-shown: my commit count in this repo, issues handled in Linker. If 0 or low, commit email registration guidance + GitHub email settings link
- [ ] Edited posts show "수정됨"; 10/day; leaving mid-writing → restore draft

### 23. Project post detail `[Required]` · `/posts/[id]`

> Basis: P-3, P-5, P-7, S-4 · Needs first: 22

- [ ] Author (→ 04), photo swipe + full-screen viewer
- [ ] Repo card ("레포를 볼 수 없음" if made private/deleted), one-line intro, body, optional fields, commit and issue counts
- [ ] `[Included]` README toggle: collapsed by default, 1-hour cache, scripts/HTML stripped, wide tables and code scroll horizontally
- [ ] Like (applied first, reverted on failure), (sheet) people who liked (logged-in users only)
- [ ] Guests: body, README, comment list and like count visible; like, comment input and more show login prompt
- [ ] Comments with one level of replies (500 chars); author can edit/delete, post owner can delete only; deleting a comment with replies shows "삭제된 댓글입니다"
- [ ] (sheet) Post more: edit/delete (own), report (others'). (sheet) Comment more works the same way
- [ ] When a recruiter views (after 31): like and comment input hidden (lists visible); if the author is Seeking / Open to offers, "채용 제안 보내기" in the author menu
- [ ] Other posts for this repo (teammates posting the same repo)
- [ ] Hidden by reports → author sees "검토 중", others see unavailable content
- [ ] `[Included]` Share button → 00 share sheet (share to chat room after 17)
- [ ] `generateMetadata` (summary line, first 120 chars of body) + OG image (cover photo, otherwise `opengraph-image.tsx` repo card). Default when deleted/hidden; strip `?from=share` from canonical (blueprint 8-3)
- [ ] Server: comment and like notifications, view logging with traffic source (feed, profile, recruit post, chat share, external link `?from=share`) → for 30 stats; start collecting early
- [ ] Do 04 profile pass 2 (post list, pinned posts) now

### 24. Home feed `[Required]` · `/feed`

> Basis: P-4, H-9 · Needs first: 23 (posts must exist to test)

- [ ] Post card: cover photo (repo card if none), author (small badge if Seeking), one-line intro, like and comment counts, one-line "why shown"
- [ ] Infinite scroll + virtualization
- [ ] Write button → 22
- [ ] Empty feed: 5 developers recommended by my tech stack (with follow buttons) + popular posts
- [ ] Guest feed: popular this week + latest only (no following, 2nd-degree or same-stack), write button shows login prompt, seen posts not recorded
- [ ] Server: 1 recommendation per 4 following posts, only recommendations if following nobody, max 2 consecutive by the same author
- [ ] Server: recommendation exclusions (already seen, own posts, blocked people, hidden posts)
- [ ] Server: popularity score (like 1, comment by others 2, decays with age, likes from accounts < 7 days old excluded)
- [ ] "Why shown" copy (one, by priority): "OO님이 좋아해요" > "OO님과 아는 사이" > "React를 쓰는 사람들의 인기 글" > "이번 주 인기"
- [ ] `[Included]` 2nd-degree (mutual follows of mutual follows) recommendations. If the schedule slips, pass 1 is "popular this week + same stack" only
- [ ] `[Included]` Recruiter feed (after 31): no follows so recommendations only, no write button, top toggle "제안 받는 개발자만" (only posts whose author is Seeking / Open to offers; filter kept in URL)

**Job ads (after the 04 job ad sheet)** `[Included]`

- [ ] Ad card: "광고" (Ad) label at top, company, posting title, job category, closing date, "외부 공고 보기" (view external posting), X at top right, more (⋯). Different background from regular posts. Screen readers read "광고" first
- [ ] Tapping the card → click API → returned URL opens via 00's external link sheet (confirm on first-time domain) → external browser
- [ ] X close: collapse the card and toast "광고를 닫았어요. 7일 동안 보이지 않아요. · 되돌리기" (undo cancels the close)
- [ ] More → (sheet) "이 광고 숨기기" (hide this ad, never shown again, toast "이 광고는 다시 보이지 않아요."), "신고" (00 report sheet, target type job ad)
- [ ] No ad slot at all for guests, recruiters, and developers with empty job categories
- [ ] Server: mix ad items into the feed response (1 per 10 posts, not on the first screen, 3 per person per day and same ad once per day via Redis counters). Eligible = job category matches, showing, not closed within 7 days, not hidden, no block relation. Rotate among multiple matches
- [ ] Server: collect impressions/clicks in Redis, write `ad_daily_stats` once a day (who saw it is not stored)

---

## 8. Trust, safety and operations

Operations screens are desktop-oriented and use a list-left + detail-panel-right layout to reduce the page count. The user-side report/block sheets were already built in 00, so this section only builds the screens that process that data.

### 25. Ops: reports `[Required]` · `/admin/reports`

> Basis: O-1, O-2, O-4, Policy ch. 9 & 10 · Needs first: 00 (report data), 23 · Merged: ops home + report list + report detail + hidden/deleted content + appeals → filters and detail panel

- [ ] Entry: only Linker accounts with operator permission; logged out after 30 min of inactivity. `/admin` goes to this page
- [ ] `[Included]` OTP 2FA on every entry. If the schedule slips, permission check only and OTP right after launch
- [ ] List filters: pending / handled / appealed; target type (user, post, comment, recruit post, team chat, 1:1 chat, job ad); grouping by target; flag items past the handling target (2 business days)
- [ ] `[Included]` Job ad report detail: company, posting title, job category, closing date, posting URL (tap → external confirm), advertising recruiter → 26. Action = hide the ad (notify the recruiter with the reason)
- [ ] Detail panel: report reasons, reported content; chat reports show only the 10 messages before/after copied at report time
- [ ] Actions: hide, delete (reason required), dismiss, restore handled content, "이 사용자 제재하기" (sanction this user) → 26
- [ ] Notify the author with the reason; notify reporters of the result only
- [ ] Appeals: reviewed by an operator other than the original handler (permanent suspension: lead operator); if accepted, restore content + erase sanction history
- [ ] Server: 5 dismissed reports in the last 30 days → can't report for 30 days, and their reports excluded from auto-hide counts

### 26. Ops: users `[Required]` · `/admin/users`

> Basis: O-3 · Needs first: 25 · Merged: user list + user detail + accounts needing review + subscription/payment history → filters and detail panel

- [ ] Search (handle, name), status filter (active / suspended / pending deletion / needs review), member type filter (developer / recruiter)
- [ ] "Needs review": accounts exceeding 3× a daily limit flagged automatically
- [ ] Detail panel: basic info, sanction history, reports received, subscription status and payment history. For recruiters: company, email domain, job title, offers sent and accepted in the last 30 days
- [ ] (sheet) Sanction: warning → 7 days → 30 days → permanent (lead operator only), reason required, notify the user
- [ ] Lift sanction (lead operator, confirm sheet)
- [ ] Emails masked (jun\*\*\*@gmail.com); full view after entering a reason
- [ ] `[Included]` Refund button (Toss Payments payment cancel)
- [ ] Operator accounts designated via DB seed, no screen (replaces the screen map's operator management page)
- [ ] Server: while suspended only login, view, appeal, delete account; steps reset after 1 year without violations

### 27. Ops: action log `[Required]` · `/admin/audit`

> Basis: O-5 · Needs first: 25, 26

- [ ] Who · when · what · why (operator, time, target, action, reason)
- [ ] Filters: operator, action type, period
- [ ] Server: record every action from 25 and 26 and every full-email view; no edit/delete (append only)

---

## 9. Subscription

### 28. Plans & checkout `[Required]` · `/subscribe`, `/subscribe/success`, `/subscribe/fail`

> Basis: S-1, S-3, S-7, H-5 · Needs first: screens with benefits (04, 09, 17, 20, 22) · Merged: plan comparison + web checkout + payment complete → one page and two return URLs

- [ ] Plan comparison: Free / Pro / Flex (prices and benefits in PRD ch. 6, Policy ch. 11). Recruiters see only Scout (no free trial, monthly only). Flex is monthly only
- [ ] Figma 28 (288:471 developer, 293:218 recruiter): title "Linker를 구독하고 / 더 좋은 서비스를 경험해 보세요" + subtitle, "월간 결제 / 연간 결제" toggle, plan cards (name, one-line pitch, price + "월간 청구"/"연간 청구", "{plan} 플랜 구독하기", checked benefits), terms/privacy links, blue note "계정 당 Pro, Flex의 무료 체험은 1회만 제공 됩니다". No card for the free plan; Flex picks its team in a "결제할 팀 선택" sheet opened by its button (user decisions 2026-11-09). **The trial note is Figma copy shown by user decision, but the free trial is `[Included]` and not implemented yet**, so no account actually gets a trial. The recruiter frame's Scout card appears once the server sells Scout (the server's recruiter checkout is still `[Included]`); until then recruiters see "지금 결제할 수 있는 요금제가 없어요."
- [ ] Server: plans API includes personal trial eligibility. Return `Cache-Control: private, no-store`; frontend uses server `no-store` and account-scoped TanStack queries, with no shared Next cache
- [ ] Monthly/annual toggle; show the entry reason (`?reason=photo-limit` etc. when coming from a limit prompt sheet)
- [ ] Flex requires choosing a team (where I'm owner or billing manager) + price from current headcount (₩7,900 up to 6, ₩1,900 per member from the 7th), "인원이 바뀌면 다음 결제일부터 반영돼요" (headcount changes apply from the next billing date)
- [ ] Toss Payments payment widget (test key), show "테스트 결제라 실제로 돈이 나가지 않아요" (test payment, no real charge)
- [ ] Success return: unlock benefits only after the server confirms via the approval API → done screen (what was unlocked)
- [ ] Fail return: reason + retry
- [ ] Server: plan change → 00's `PlanLimits` applies immediately (Pro: 10 photos, 5 featured, 10 recruit posts, traffic-source stats, view alert / Flex: no member limit, full chat history, image retention, AI summary, progress graph / Scout: one job ad, 50 offers per day)
- [ ] `[Included]` First-time 7-day free trial, reminder one day before it ends
- [ ] `[Included]` Auto-renewal (billing key). To keep the demo simple, pass 1 is "one-time payment + expiry date", billing key afterwards

### 29. Manage subscription `[Required]` · `/settings/subscription`

> Basis: S-2 · Needs first: 28 · Needed for the MVP launch demo "test payment → benefits → cancel → back to free"

- [ ] Figma 29 (294:306 Pro, 295:459 Flex, 364:1694 cancel modal): grey "현재 사용 중인 요금제" card ("{plan} 요금제", description, "요금제 변경하기" → 28), info box ("다음 결제일" — "이용 만료일"/"혜택 종료일" until auto-renewal exists, "현재 결제 주기", "월 결제 금액 2,900(Pro)", Flex adds "팀 인원 N명", "결제 담당자", "결제 담당자 변경", then "요금제 해지 ›"), "결제 내역" with "전체 보기" (3 rows first; date, "{plan} 월간 결제", "N 원 결제/환불"). Several subscriptions repeat card + info box; no subscription shows a "무료 요금제" card. Refund is a small "환불" button on refundable payment rows, confirmed in the same modal style (user decisions 2026-11-09). **"결제 담당자 변경" is shown but `[Included]` and not built: it toasts "미구현 기능입니다."** Server: subscription items add `amount` (current period price) and `payerName` (Flex billing manager).
- [ ] Current plan, next billing date (or expiry), payment history
- [ ] Cancel (confirm sheet): benefits kept until the paid period ends
- [ ] Refund: within 7 days of payment + benefits unused (its paid period has not started; latest payment only) → full refund via Toss Payments cancel
- [ ] Server: on expiry switch to free. Existing photos/pinned posts/recruit posts stay; free limits apply from new writes/edits; team keeps existing members and only blocks new ones. When Scout ends, the job ad becomes "ended" (content kept) and the offer limit is 10
- [ ] Server: Flex 30-day grace after it ends. Notify the team 7 days before Flex ends and 7 days before grace ends; when grace ends, hide messages older than 60 days (not deleted) and queue image originals older than 90 days for deletion. Pass 1 records `grace_ends_at` on expiry only; notices and hiding come with 17's `[Included]` full chat history (every team sees 60 days until then)
- [ ] Server: on the Flex billing date compute the amount from that day's headcount (`subscriptions.seats`), notify "next payment: N members, amount" the day before. Needs a billing date, so it comes with `[Included]` auto-renewal (28); until then each payment uses the checkout headcount
- [ ] `[Included]` Payment-failure banner and 7-day grace
- [ ] `[Included]` Hand over Flex billing manager

### 30. My stats `[Included]` · `/me/stats`

> Basis: S-4, S-10 · Needs first: recruiter view logs from 04, view and traffic-source logs from 23, 28

- [ ] Free: likes, comments and views per post
- [ ] Pro: free numbers + per-post traffic source bars (feed, profile, recruit post, chat share, external link), 30-day view trend, README expands. Shortcut "대표 작업물로 고정" (pin as featured, → 04 pin sheet)
- [ ] Pro: recruiter view count (this week, last 8 weeks by week). Every Monday 09:00, if 1 or more, notify "이번 주 채용 담당자 N명이 내 프로필을 봤어요"
- [ ] Each chart has a summary sentence + "표로 보기" (blueprint ch. 6)
- [ ] Pro area dimmed for free users + "Pro로 보기" (view with Pro) → 28
- [ ] Visible only to self; never shows who or which company viewed

---

## 10. Recruiting (minimal)

Recruiters get only three new pages: sign-up (31), login (32) and the sent offers list (33). After entering, they share feed (24), posts (23), profiles (04) and chat (16, 17) with developers; only the buttons on screen change. All three are `[Included]`, so they're deferred first if the schedule slips; job-seeking status (02, 04, 05) remains even then. Feed job ads (the `[Included]` items on 04, 05, 24, 25, 28, 29) are deferred before recruiting offers.

### 31. Recruiter sign-up `[Included]` · `/recruiter/signup`

> Basis: H-1, POL-H-1, Policy ch. 3 "Recruiter accounts", Terms ch. 3 Business Member Supplementary Terms · Needs first: 03 (terms viewer), 04 (profile), 06 (settings)

**Step 1: Terms consent**

- [ ] Age 19+ (required), Terms, Business Member Supplementary Terms, business member personal data consent (required), marketing (optional). Copy in Privacy Policy ch. 2
- [ ] Add a `recruiter-terms` document to the 03 viewer

**Step 2: Company email verification**

- [ ] Enter company email → free email domains immediately get "회사 메일로만 가입할 수 있어요" (company email only)
- [ ] 6-digit code: valid 10 min, new code after 5 wrong attempts, resend once per minute (show remaining time)
- [ ] Already registered email → "이미 가입된 이메일이에요" + links to 32 login / password reset

**Step 3: Account and company info**

- [ ] Password (8–64 chars, letters + digits) + confirm, name (1–20), company (2–40), job title (1–30), company website (optional, https)
- [ ] Done → logged in, `/feed` (recruiter's 2 bottom tabs)

**Server**

- [ ] Email sending service (shared by verification codes and reset links). Dev: console or Mailpit; demo: real sending
- [ ] Free email domain list is server config
- [ ] Store codes hashed (`email_verifications`); on verification create `users(user_type = RECRUITER)` + `auth_identities(EMAIL, password_hash)` + `recruiter_profiles` in one transaction
- [ ] Auto-generate handle (`r-` + number), bcrypt passwords
- [ ] Store agreed terms version and time (same table as 02)
- [ ] Verify 00's "developers only" check applies to developer-only APIs (follow, like, comment, posts, teams, recruit posts, applications, Pro/Flex subscriptions; Scout payment and job ad APIs are "recruiters only")

### 32. Recruiter login & password reset `[Included]` · `/recruiter/login`, `/recruiter/reset`

> Basis: H-1, Policy ch. 3 "Recruiter accounts" · Needs first: 31

- [ ] Email + password login; 5 wrong attempts → 10-min lock ("N분 뒤 다시 시도해 주세요")
- [ ] Session uses the same cookie and 30-day rule as developers (reuse 00); suspended / pending-deletion handling same as 01 (pending deletion restores on login)
- [ ] "비밀번호를 잊었어요" (forgot password) → enter email → reset link (30 min, single-use). Same message regardless of whether the email is registered (don't reveal registration)
- [ ] `/recruiter/reset?token=` enter new password → changing it logs out all other devices
- [ ] Recruiter section in 06 settings: change password, blocked users, terms, delete account (GitHub items hidden; subscription & billing is Scout only → 29)

### 33. Sent offers list `[Included]` · `/recruiter/offers`

> Basis: H-3, Policy ch. 8 "Recruiting offer messages" · Needs first: 31, 17 (recruiting offer requests) · Entered via "전체 보기" on the recruiter my page (04)

- [ ] Tabs: 대화 중 (in conversation) / 응답 대기 (awaiting reply) / 응답 없음 (no reply), with counts per tab; tab kept in URL (nuqs)
- [ ] Row: developer avatar, name, @handle, first 3 tech stacks, job-seeking badge, date sent, one-line preview of my first message
- [ ] Tapping a row → developer profile (04); "대화 열기" (open chat) button only when in conversation → 17. Awaiting / no reply → (sheet) view the message I sent
- [ ] Rejections aren't disclosed, so "awaiting reply" for 30 days, then "no reply" exactly like expiry
- [ ] Blocked / deleted counterparts shown as "볼 수 없는 사용자" with no navigation
- [ ] Newest first, infinite scroll; empty state "아직 보낸 채용 제안이 없어요 · 피드에서 찾아보기"
- [ ] Server: query `chat_rooms` where `requester_id = me AND request_kind = RECRUITING` and map to the three statuses above (rejection not included in the response). No new table

---

## 11. Proposed 2-week assignment

Assumes each of the 5 people owns both frontend and server for their pages. If roles are split into frontend/backend, let us know and we'll re-split accordingly. With A taking recruiting (31–33), 26 users, 27 action log and 30 my stats moved to B; 04 profile pass 2 stays with A, the owner of 04. [02 WBS](../development/02-wbs.md) is the source for day-by-day assignment. Recruiter-side `(after 31)` items on existing pages are added by that page's owner after 31 is done.

| Owner | Week 1 | Week 2 |
| --- | --- | --- |
| A. Account & recruiting | 00 auth, access table, page frame; 01, 02, 03, 04 (pass 1), 06 | 05, 25, 31, 04 (pass 2), 32, 33, `[Included]` job ad server, 04 job ad sheet, 05 job categories |
| B. GitHub, teams, ops | 00 GitHub App, webhooks, app bridge; 07, 08, 09 (pass 1), 10 | 09 (pass 2: completion, ownership transfer), 17 PR posting, 26, 27, 30, sync hardening |
| C. Issues | 00 Projects spike, policy numbers, SEO, test setup; 11, 12 | 13, 14, 15, 07 my issues, 17 AI summary (Flex), 11 progress card (Flex) |
| D. Chat & notifications | 00 STOMP, notification service, STOMP client; 16, 17 (team chat) | 18, 17 (1:1 chat, share cards, link cards), 00 share sheet, 28, 29 (incl. Scout plan) |
| E. Find Team & posts | 00 monorepo, API calls, sheet open/close, common sheets, image uploader; 19, 20, 21 | 21 wrap-up, 22, 23, 24, `[Included]` 24 job ad card |

| Days | Goal |
| --- | --- |
| Days 1–2 | 00 common foundation and the 6 risky-area spikes. The frontend foundation "end-of-D2 check" ([03 frontend blueprint §1-1](../development/03-frontend-blueprint.md#1-1-foundation-built-before-pages-the-most-important-work)) must pass before page work starts |
| Days 3–5 | Week-1 pages. End of day 5: verify "login → create team → issue list/detail (GitHub sync) → team chat" (create issue 13 on days 6–7) |
| Days 6–8 | Week-2 pages. End of day 8: verify "recruit → apply → accept → join team → complete project → publish post" |
| Day 9 | Connect ops, subscription, recruiting; tidy remaining `[Included]` items |
| Day 10 | Run the demo checklist below end to end, fix bugs |

### Demo checklist (MVP launch condition)

- [ ] Log in with GitHub → terms consent → profile setup
- [ ] Leader creates a team (install app → link repos → link board) → writes a recruit post
- [ ] Another account applies → leader reviews the application (graph, completion record) and accepts
- [ ] Applicant joins team chat, accepts the GitHub org invite
- [ ] Leader creates an issue from a template → sets assignee and due date → assignee notified
- [ ] Status changed on the board, period bar on the calendar, same values on GitHub
- [ ] PR opened and merged on GitHub → system message in team chat
- [ ] Project completed → completion record updated → project post published
- [ ] Like, comment, follow in the feed → 1:1 chat
- [ ] Report a post → operator hides it → recorded in the action log
- [ ] Pro test payment → can upload 10 photos → cancel → back to free (uploaded photos stay)
- [ ] AI summary on a free team → Flex prompt → Flex test payment → team chat AI summary → share to chat → create an issue from a to-do → check completion rate and 14-day trend on the issue list's progress card, "표로 보기"
- [ ] Post share button → "채팅방에 공유" → pick a team chat room → card appears → the view via the card shows as "chat share" in Pro stats. A URL from "링크 복사" pasted into a 1:1 chat shows as the same card
- [ ] Developer sets job-seeking to "구직 중" → recruiter signs up with company email → finds the post via "제안 받는 개발자만" in the feed → sends a recruiting offer → developer accepts in requests → conversation → recruiter sees "대화 중" in the sent offers list on my page
- [ ] `[Included]` Scout test payment → register a job ad on my page (Backend, a Saramin posting URL) → "광고" (Ad) card in the feed of a developer who picked Backend → opens the external posting → close with X → "이 광고 숨기기" from another account → confirm a URL outside the company domain is rejected
- [ ] Logged out, open a shared post / recruit post link → readable → tapping like shows the login prompt → after login, back on the same screen
- [ ] The flows above work in mobile browsers (iOS Safari, Android Chrome) and the WebView app

---

## 12. Screen map 73 → 30 mapping

Screen-map MVP pages not kept as separate pages here, and where their features went. No feature was removed; only locations changed.

| Screen-map page | Here | Reason |
| --- | --- | --- |
| GitHub login return | Part of 01 | A pass-through URL with only loading |
| Terms consent, notification email verification, basic profile | 02 onboarding, one page | Consecutive sign-up steps. Email is fetched via the GitHub App email permission, removing the verification screen |
| Account recovery | 01 login callback auto-recovery + toast | Policy restores on re-login, so nothing to ask |
| Terms, Privacy Policy, community policy | One 03 document viewer | Same layout |
| Contact us | Mail link in 06 | No form needed at portfolio scale |
| Followers / following | Sheet in 04 | A single list |
| Account management, blocked users, delete account | Sections and sheets in 06 settings | Only a few items |
| Appeal (user), usage restriction notice | 00 suspension banner + 18's appeal sheet | Viewing is allowed while suspended, so no reason to block the whole screen |
| Unavailable content, error screen | 00 `not-found.tsx`, `error.tsx` | Framework default files |
| My team list, my issues (per selected team; default = most recently joined) | 07 workspace home | One tab landing screen |
| Create team: start, install check, board link | 08 one stepper page | Consecutive wizard |
| Team home | Removed; 11 issue list is the team's first screen | Summary info overlaps other tabs |
| Team members, invite, linked repo management, team plan | Sections in 09 team settings | Management screens for owner/admin only |
| PR list | Sheet in 17 | The plan also calls it "the PR tab of team chat" |
| Create issue: template choice + content | 13 one stepper page | Consecutive writing steps |
| Team chat room, 1:1 chat room, room info, team chat search | 17 one page + sheets | Same message structure, features toggled |
| Message requests | Tab in 16 | A single list |
| My applications | Tab in 19 | Same card list |
| Received applications, application detail | Author tab + sheet in 21 | Natural to handle while viewing the recruit post |
| Write post: choose repo + content | 22 one stepper page | Consecutive writing steps |
| Ops home, hidden/deleted content, appeals (ops) | Filters in 25 | Different states of the same report data |
| User list/detail, accounts needing review, subscription/payments (ops) | 26 list + detail panel | Same user data |
| Operator login / OTP | 25 entry handling | GitHub login + operator permission + OTP; no separate login screen needed |
| Operator management | DB seed | Operators are just the 5 team members |
| Web checkout, payment complete | 28 + return URLs | Toss payment widget opens inside the same page |

The screen map's "app update notice" sheet was dropped since there's no store release.

31–33 (recruiter sign-up/login, sent offers list) were added when minimal recruiting entered the MVP after the screen map was made, so they're not in the table above. The screen map's phase-3 recruiting screens (talent search, offer box, etc.) remain out of the MVP.
