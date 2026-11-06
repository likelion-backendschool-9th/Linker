# Linker — agent guide

## Agent entry point (Codex / Cursor)
- This root `AGENTS.md` is the single source for agent working rules. Before backend changes, also read `docs/development/05-backend-blueprint.md` §3–§4 for architecture and examples. WBS owns work/API contracts, not an alternative service layout.
- Cursor's `.cursor/rules/project-guide.mdc` points here. `CLAUDE.md` only imports this file; do not maintain separate copies of these rules there.
- Local notes and proposals are historical/context snapshots, not architecture authority. If `.local-notes/agents/README.md` exists, read it and the active-work/handoff notes before editing; they are local-only and do not replace repository rules.
- If a document still suggests neutral shared business services or contradicts the mandatory service rule below, apply the current rule and report/correct that stale reference. Do not infer a new design from an old example.

## Project and scope
- Developer platform for team recruitment, GitHub collaboration, project posts, and recruiter offers via chat.
- Five-person, two-week MVP: mobile-first web + Expo WebView development build; no store release. Toss Payments is test mode only.
- UI language is Korean. Use documented UI copy verbatim.
- `frontend/`: pnpm/Turborepo, Next.js 16 web, Expo shell, generated API and bridge packages. Read `frontend/AGENTS.md` before frontend work.
- `backend/`: Spring Boot/Gradle, Security, JPA, PostgreSQL, Redis, WebSocket/STOMP, springdoc. Package layout is `docs/development/05-backend-blueprint.md` §3; HTTP controller inventory is §4. Read a local `AGENTS.md` or `CLAUDE.md` if present.
- `CLAUDE.md` files only import the same-folder `AGENTS.md` (`@AGENTS.md`). Put all guidance in `AGENTS.md`, not `CLAUDE.md`.

## Work areas (WBS ch. 0)
One person owns both frontend and backend of their pages. API ownership follows business systems; system maintainers review shared controllers (WBS §1 and §4).

| Owner | Area | Pages |
| --- | --- | --- |
| A | Accounts & recruiting | 01, 02, 03, 04, 05, 06, 25, 31, 32, 33 |
| B | GitHub, teams, ops | 07, 08, 09, 10, 26, 27, 30 + PR posting in 17 |
| C | Issues | 11, 12, 13, 14, 15 + my issues in 07 + AI summary (Flex) in 17 + progress card (Flex) in 11 |
| D | Chat, notifications, subscription | 16, 17, 18, 28, 29 |
| E | Find Team & project posts | 19, 20, 21, 22, 23, 24 |

Foundation page 00 (D1–D2) is split across everyone; see WBS ch. 3.

## Four roles
Guest (read-only on feed, posts, recruit posts, profiles) / Developer (GitHub login) / Recruiter (company email sign-up) / Operator (developer account + `admins` row + OTP). The single role × page/action table is Policy ch. 2.

## Read only the relevant documentation
| Source | Authority |
| --- | --- |
| `docs/planning/01-service-plan.md` | Product direction and architecture |
| `docs/planning/02-prd.md` | Feature IDs and completion conditions |
| `docs/planning/03-mvp-definition.md` | Scope and launch conditions |
| `docs/planning/04-policy.md` | All numbers, limits, states, roles, exceptions, UI copy |
| `docs/planning/05-terms-of-service.md`, `docs/planning/06-privacy-policy.md` | Legal wording |
| `docs/planning/07-page-todo.md` | Pages, URLs, screen contents |
| `docs/development/01-erd.md` | Tables, columns, enums |
| `docs/development/02-wbs.md` | Endpoints, controllers, ownership, permissions, schedule |
| `docs/development/05-backend-blueprint.md` | Backend architecture, packages (§3), Public* at controller root, 29 controllers + paired entry services (§4), webhook under `integration.github`. |
| `docs/development/03-frontend-blueprint.md` | Frontend implementation rules; Policy, Page TODO and WBS take precedence |
| `docs/development/04-design-guide.md` | Colors, type, spacing, shapes, component styles; token values in `frontend/apps/web/src/styles/tokens/` |

- Search for the relevant page number, feature, table, or controller instead of reading every document.
- `[Required]` is essential; `[Included]` may be deferred in the order in WBS ch. 6.
- Complete foundation page 00 before page work; follow pages 01–33. Page ownership stays with A–E; system maintainers and method implementers are defined separately (WBS §1 and §4).
- Page numbers identify screen work, not Java packages or controller boundaries. One business system owns each endpoint; multiple pages may share a controller class. Repositories and entities stay shared by business responsibility; service classes use access-group names and placement, even when their capabilities overlap (WBS §1–2 and §4, backend blueprint §3–§4).
- Guest, Developer, Recruiter, Operator access follows Policy ch. 2. Team owner/admin/member permissions are separate (ch. 6). HTTP access groups (`public` / `user` / `recruiter` / `admin`) are URL and Security paths, not four copies of each business package.

## Fixed decisions
- GitHub App, not OAuth App. GitHub is authoritative for issues, PRs, orgs; read Linker's DB copy maintained by webhooks and periodic sync.
- Chat uses Spring WebSocket + STOMP, with `@stomp/stompjs` on web.
- JWT stays in an httpOnly parent-domain cookie; never expose it to JavaScript or the native bridge.
- Index only developer profiles, posts, and recruitment posts; everything else is `noindex`.
- Backend hosting, email provider, and AI summary model remain open decisions: ask the user before selecting them.

## Backend packages
Follow `docs/development/05-backend-blueprint.md` §3–§4. WBS §4 owns endpoint contracts and method implementers; WBS §1 owns the 18 business-system maintainers. The blueprint owns Java packages and the 29 HTTP controller classes.

- Base package: `com.linker.backend`. Layers: `controller`, `service`, `repository`, `entity`, `dto`, plus `integration`, `async`, and `global`.
- Keep **18 business systems** (WBS S01–S18). Place **Public*** HTTP controllers at `controller` root (no `public` / `public_` package). Place the rest under `controller.user`, `controller.recruiter`, or `controller.admin` as mapped in blueprint §4 (**29** controller classes). Pair each controller with a same-group entry service when adding real endpoints (`PublicAuthService`, `service.user.UserChatService`, …). Class name prefixes (`Public*`, `User*`, `Recruiter*`, `Admin*`) avoid bean-name collisions.
- `controller.user` means **authenticated accounts**, not developers only. Shared login APIs (notifications, uploads, chat, subscription) stay here; developer-only rules use method-level checks (for example `@DeveloperOnly`), not a developer-only package. Recruiter-only and operator-only actions go in `recruiter` and `admin`.
- Put `GithubWebhookController` (and its webhook service) under `integration.github`, not a fifth human access group and not `controller` root. Do not add `controller.multi`, `controller.open`, `controller.public_`, `controller.auth`, `controller.member`, or `/member` URLs. Login, refresh, password, and OTP endpoints live on their access-group controllers.
- Do not create empty controllers or empty paired entry services (PAS) in bulk (for example scaffolding all 29 `*Service` shells). Move or add paired services with real endpoint work; an internal stage-00 role service may be added with a real use case without inventing a controller. Foundation endpoints join their owning systems. Do not add a `service.common` package to the default tree.
- Do not add `api/common`, numbered page packages (`p01_login`), or a `domain` package that holds controllers, entities, and repositories together. Do not give each page or access group its own copy of a repository or entity.
- Put request and response DTOs under `dto`, using `request` and `response` subpackages when a capability has both. Do not place them beside controllers, and do not return entities from controllers.
- Keep HTTP paths, permissions, OpenAPI `@Tag` names (for example `p11-issue-list`), and STOMP destinations when classes move. A Java package does not define a URL. Place the common STOMP SEND on `UserChatController`.
- File placement is backend blueprint §3–§4. Keep `global.error`. Do not add `global.exception`, `global.response`, or `service.support`.

## Mandatory backend service generation rule
- **Even when functionality is common, create separate access-group service classes.** Public APIs use `service.PublicXService`; logged-in APIs use `service.user.UserXService`; recruiter/admin use `service.recruiter.RecruiterXService` / `service.admin.AdminXService`. `user` still includes shared authenticated APIs; it is not developer-only.
- A controller calls its same-group paired entry service (Controller → Service, same name stem). Internal stage-00 use cases may have a real role-specific service before any HTTP controller exists; do not create an empty controller to satisfy the pairing.
- Do not consolidate role business implementations in a neutral `XService`, a shared business base class, `service.common` / `service.shared`, or another role's service. Same-group services may call same-group services for real internal use cases.
- **Allowed to share:** DTO/command contracts, entities, repositories, policy constants and technical infrastructure/adapters (for example `PaymentGateway` and GitHub HTTP clients). Shared infrastructure must not become a hidden neutral business service. Keep limits in Policy/PlanLimits and test equivalent cases across role implementations.
- Narrow exception: report auto-hide is a system-generated operator alert. `UserModerationService` may call `AdminNotificationService.create` only when `auto_hidden_at` is first set, using `REPORT_AUTO_HIDDEN` for each active operator. This does not authorize other cross-role delegation; see backend blueprint §4.
- Concrete example: UserNotificationService / RecruiterNotificationService / AdminNotificationService each implements create; no neutral NotificationService or cross-role delegation. Share CreateNotificationCommand, NotificationTypes, NotificationRepository and Notification Entity.
- GitHub webhook is the documented external-ingress exception: controller and service stay in `integration.github`. Do not create unused Public/Recruiter/Admin service copies, new API routes, tables or access rights just to complete a role matrix.

## Keep code and documents consistent
- Table/column/enum changes: update ERD diagrams, notes, enum list, page mapping, counts, and WBS page tables.
- Endpoint changes: update WBS system contracts, page work references, controller counts, and totals. Each endpoint has one owning system and a tracked implementation page; others reuse it.
- Page/URL/screen changes: update TODO and page list, WBS, Policy access matrix, and backend blueprint when architecture or access contracts change.
- Number/rule changes: update Policy first, then TODO and code. Centralize values in `frontend/apps/web/src/lib/policy.ts` and backend `PlanLimits`/server config, never DB or scattered literals.
- Keep documented totals consistent (baseline: 33 pages plus foundation 00, 18 business systems, 29 HTTP controllers, 205 REST endpoints, 5 realtime paths (1 WebSocket connection + 1 STOMP SEND + 3 SUBSCRIBE), 69 tables).
- `docs/` translates Korean originals maintained outside this repo. Report doc changes so the user can update those originals.

## Git workflow
### Branches
- `main`: stable, release-ready version.
- `dev`: integration and testing branch for the team's work.
- Work branches: feature, bug fix, configuration, and documentation work. Created per type:

| Type | Purpose | Branch example |
| --- | --- | --- |
| `feat` | New feature | `feat/login-implementation` |
| `fix` | Bug fix | `fix/login-error` |
| `chore` | Configuration and other maintenance | `chore/eslint-config` |
| `docs` | Writing or editing documents | `docs/git-convention` |

### Workflow
1. Switch to the latest `dev` and pull.
2. Create a work branch of the matching type.
3. Do the work and commit following the commit convention.
4. Push the work branch to the remote.
5. Open a PR from the work branch into `dev`.
6. Review and test the changes, then merge into `dev`.
7. When development is complete, merge `dev` into `main`.

### Rules
- Never commit directly to `main` or `dev`.
- Pick the branch type that matches the work; one main task per branch (separate unrelated scope into another branch).
- Every work branch opens its PR into `dev`. Review and test before merging.
- Delete a work branch after it is merged. (Agents: only with explicit user approval.)
- No `release` or `hotfix` branches; this is a two-week project.
- Prefer matching branch type and commit type.

### Branch naming
Format: `<type>/<description>`
- Type is lowercase: `feat`, `fix`, `chore`, `docs` only. Use `feat`, never `feature`.
- Description is short and clear, with words joined by hyphens (kebab-case).

### Commit messages
Format: `<type>: <description>` (one space after the colon).
- Type is one of `feat`, `fix`, `chore`, `docs`.

| Type | Purpose | Commit example |
| --- | --- | --- |
| `feat` | New feature | `feat: implement login` |
| `fix` | Bug fix | `fix: fix login error` |
| `chore` | Configuration and other maintenance | `chore: configure ESLint` |
| `docs` | Writing or editing documents | `docs: write Git convention` |

- Write the description short and clear. One main change per commit.
- Never use vague messages such as "fix", "work", or "update".
- Never add `Co-authored-by: Cursor`, `Made-with: Cursor`, or similar agent attribution trailers. Commits must stay under the human author only so Cursor is not listed as a GitHub contributor. Repo `commit-msg` hook strips those lines when hooks are installed (`bash scripts/setup-git-hooks.sh`).

### Agent safety
- Destructive operations (`reset --hard`, force-push, branch deletion) require explicit user approval.
- Inspect branch and status before Git operations; clarify unclear state before potentially destructive commands.
