# Linker

Developer social platform: find teammates, work together through a GitHub org (issues, schedule, team chat), and publish finished work as project posts. Recruiters can browse and send recruiting offers through 1:1 chat.

- Portfolio project: 5 people, 2 weeks (D1–D10). Responsive web (mobile-first) + Expo WebView app installed as a development build. No App Store / Play release.
- Payments: Toss Payments **test mode** only. No real charges.
- Korean is the app language. UI copy quoted in the docs is used as-is in code.

## Repository layout

| Path | What | Own CLAUDE.md |
| --- | --- | --- |
| `docs/` | Planning docs 01–09 (English) | — |
| `frontend/` | pnpm + Turborepo monorepo: Next.js 16 web (`apps/web`), Expo WebView shell (`apps/mobile`), orval output (`packages/api`), bridge types (`packages/bridge`). Deployed on Vercel (icn1) | `frontend/CLAUDE.md` (imports `frontend/10-frontend-blueprint.md`) |
| `backend/` | Spring Boot (Gradle): Spring Security, JPA, PostgreSQL, Redis, WebSocket/STOMP, springdoc-openapi | `backend/CLAUDE.md` |

Read the CLAUDE.md of the folder you are working in. The docs are large; open only the sections you need (search by page number, table name or controller name).

## Docs (`docs/`)

| File | Answers | Source of truth for |
| --- | --- | --- |
| `01-service-plan.md` | What the service is, IA, user flows, architecture, tech stack (7-3) | Overall direction |
| `02-prd.md` | Feature IDs (A-, P-, R-, T-, I-, C-, N-, S-, H-, O-), completion conditions, GitHub App permissions (ch. 8), non-functional reqs (ch. 9) | What "done" means for a feature |
| `03-mvp-definition.md` | MVP scope (Required / Included / Excluded), launch conditions, build order | Scope |
| `04-policy.md` | Character counts, limits, states, exceptions, access by role (ch. 2), rate limits, plan benefits (ch. 11), UI copy (ch. 12) | **Every number and rule** |
| `05-terms-of-service.md`, `06-privacy-policy.md` | Legal texts (reference translations) | Legal wording only |
| `07-page-todo.md` | The 33 MVP pages (00 common + 01–33), what each contains, order, owners (ch. 11) | **Pages, URLs, screen contents** |
| `08-erd.md` | 69 tables (🟢 56 required, 🟡 13 included), columns, enums (ch. 5), batch jobs (ch. 6), tables per page (7-2) | **Tables, columns, enum names** |
| `09-wbs.md` | API rules (ch. 1), D1–D10 schedule (ch. 2), per-page controller + endpoints + tables + tasks (ch. 3–4), controller list (ch. 5) | **Endpoints, controllers, owners, dates** |

`frontend/10-frontend-blueprint.md` turns 04/07/09 into frontend code rules. If it disagrees with them, the docs above win.

Marks used everywhere: `[Required]` (core flow breaks without it) / `[Included]` (in scope, first to be deferred). Deferral order is in 09 ch. 6.

## Work areas (09 WBS ch. 0)

One person owns both the frontend and backend of their pages, so controller owner = page owner.

| Owner | Area | Pages |
| --- | --- | --- |
| A | Accounts & recruiting | 01, 02, 03, 04, 05, 06, 25, 31, 32, 33 |
| B | GitHub, teams, ops | 07, 08, 09, 10, 26, 27, 30 + PR posting in 17 |
| C | Issues | 11, 12, 13, 14, 15 + my issues in 07 + AI summary (Flex) in 17 + progress card (Flex) in 11 |
| D | Chat, notifications, subscription | 16, 17, 18, 28, 29 |
| E | Find Team & project posts | 19, 20, 21, 22, 23, 24 |

00 common foundation (D1–D2) is split across everyone; see 09 ch. 3 for who builds what. Work follows the 07 page order (00 → 01 → … → 33), and no page work starts before 00 is done.

## Four roles

Guest (no account, read-only on feed, posts, recruit posts, profiles) / Developer (GitHub login) / Recruiter (company email sign-up) / Operator (developer account + `admins` row + OTP). The single role × page/action table is 04 Policy ch. 2 "Access by role". Team owner/admin/member is a separate layer (04 ch. 6).

## Keep the docs consistent

A change to one of these is not finished until the others match:

- **New or changed table / column / enum** → 08 ERD (diagram, column notes, enum reference ch. 5, 7-2 table-per-page list, table counts in ch. 1) and the "Tables" line of that page in 09 WBS.
- **New or changed endpoint** → the page's section in 09 WBS ch. 3–4, the endpoint count in 09 ch. 5 and the totals in 09 ch. 0. Each endpoint has exactly one owning page; other pages borrow it.
- **New or changed page, URL or screen item** → 07 TODO (and its page list), 09 WBS (same page number), 04 Policy ch. 2 access table, and the frontend blueprint ch. 13 table.
- **New or changed number or rule** (limit, character count, rate limit, plan benefit) → 04 Policy first; 07 TODO copies are updated to match. In code, numbers come from one place (`frontend/apps/web/src/lib/policy.ts`, backend `PlanLimits` / server config), never from the DB.
- Totals stated in the docs (33 pages, 40 controllers, 204 REST endpoints, 5 STOMP destinations, 69 tables) must stay true after the change.
- `docs/` is an English translation of Korean originals kept outside this repo. When you change a doc here, tell the user so the Korean original gets the same change.

## Decided, don't reopen

- GitHub **App**, not an OAuth App. GitHub is the source of truth for issues, PRs and orgs; Linker reads its DB copy (webhooks + periodic sync).
- Chat is Spring WebSocket + STOMP (`@stomp/stompjs` on the web), not socket.io.
- Login is a JWT in an httpOnly cookie on the parent domain (`app.` web, `api.` backend). The token never reaches JS or the app bridge.
- Search engines index developer profiles, posts and recruit posts only (04 POL-A-9); everything else is `noindex`.

Still open (09 ch. 7, 08 ch. 8, 04 ch. 14): backend host, email sending service, AI summary model. Ask the user instead of choosing.
