# Linker — agent guide

## Project and scope
- Developer platform for team recruitment, GitHub collaboration, project posts, and recruiter offers via chat.
- Five-person, two-week MVP: mobile-first web + Expo WebView development build; no store release. Toss Payments is test mode only.
- UI language is Korean. Use documented UI copy verbatim.
- `frontend/`: pnpm/Turborepo, Next.js 16 web, Expo shell, generated API and bridge packages. Read `frontend/AGENTS.md` before frontend work.
- `backend/`: Spring Boot/Gradle, Security, JPA, PostgreSQL, Redis, WebSocket/STOMP, springdoc. Read a local `AGENTS.md` or `CLAUDE.md` if present.
- Keep existing `CLAUDE.md` files unchanged unless explicitly asked to edit them.

## Read only the relevant documentation
| Source | Authority |
| --- | --- |
| `docs/01-service-plan.md` | Product direction and architecture |
| `docs/02-prd.md` | Feature IDs and completion conditions |
| `docs/03-mvp-definition.md` | Scope and launch conditions |
| `docs/04-policy.md` | All numbers, limits, states, roles, exceptions, UI copy |
| `docs/05-terms-of-service.md`, `docs/06-privacy-policy.md` | Legal wording |
| `docs/07-page-todo.md` | Pages, URLs, screen contents |
| `docs/08-erd.md` | Tables, columns, enums |
| `docs/09-wbs.md` | Endpoints, controllers, ownership, schedule |
| `frontend/10-frontend-blueprint.md` | Frontend implementation rules; 04/07/09 take precedence |

- Search for the relevant page number, feature, table, or controller instead of reading every document.
- `[Required]` is essential; `[Included]` may be deferred in the order in WBS ch. 6.
- Complete foundation page 00 before page work; follow pages 01–33. Page and controller ownership are the same (WBS ch. 0).
- Guest, Developer, Recruiter, Operator access follows Policy ch. 2. Team owner/admin/member permissions are separate (ch. 6).

## Fixed decisions
- GitHub App, not OAuth App. GitHub is authoritative for issues, PRs, orgs; read Linker's DB copy maintained by webhooks and periodic sync.
- Chat uses Spring WebSocket + STOMP, with `@stomp/stompjs` on web.
- JWT stays in an httpOnly parent-domain cookie; never expose it to JavaScript or the native bridge.
- Index only developer profiles, posts, and recruitment posts; everything else is `noindex`.
- Backend hosting, email provider, and AI summary model remain open decisions: ask the user before selecting them.

## Keep code and documents consistent
- Table/column/enum changes: update ERD diagrams, notes, enum list, page mapping, counts, and WBS page tables.
- Endpoint changes: update WBS page definitions, controller counts, and totals. Each endpoint has one owning page; others borrow it.
- Page/URL/screen changes: update TODO and page list, WBS, Policy access matrix, and blueprint ch. 13.
- Number/rule changes: update Policy first, then TODO and code. Centralize values in `frontend/apps/web/src/lib/policy.ts` and backend `PlanLimits`/server config, never DB or scattered literals.
- Keep documented totals consistent (baseline: 33 pages, 40 controllers, 204 REST endpoints, 5 STOMP destinations, 69 tables).
- `docs/` translates Korean originals maintained outside this repo. Report doc changes so the user can update those originals.

## Git workflow
Follow `AI_GIT_GUIDE.md`; its essential rules are:
- Start work branches from the latest `dev`; one main task per branch. PR work branches into `dev`, then merge `dev` into `main` for release.
- Never commit directly to `main` or `dev`. Do not add release/hotfix branches without a team request.
- Branch: `<type>/<short-kebab-case-description>`. Commit: `<type>: <concise imperative description>` (one space after `:`).
- Allowed types only: `feat`, `fix`, `chore`, `docs`. Prefer matching branch/commit types and small, focused commits; separate unrelated scope into another branch.
- Example: `docs/agent-guides` and `docs: add agent guides`.
- Remove merged work branches only with explicit approval. Destructive operations (`reset --hard`, force-push, branch deletion) require explicit user approval.
- Inspect branch/status before Git operations; clarify unclear state before potentially destructive commands.
