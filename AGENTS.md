# Linker — agent guide

## Agent entry point
- This root `AGENTS.md` is the single source of agent rules. `CLAUDE.md` files only import the same-folder `AGENTS.md` (`@AGENTS.md`); Cursor's `.cursor/rules/project-guide.mdc` points here. Put guidance here, never in `CLAUDE.md`.
- Before backend changes, read `docs/development/05-backend-blueprint.md` §3–§4. WBS owns work/API contracts, not the service layout.
- If a document contradicts a rule below (for example suggests a neutral shared business service), apply the rule here, report the stale reference, and do not infer a design from an old example.

## Project and scope
- Developer platform for team recruitment, GitHub collaboration, project posts, and recruiter offers via chat.
- Five-person, two-week MVP: mobile-first web + Expo WebView development build; no store release. Toss Payments is test mode only.
- UI language is Korean. Use documented UI copy verbatim.
- `frontend/`: pnpm/Turborepo, Next.js 16 web, Expo shell, generated API and bridge packages. Read `frontend/AGENTS.md` before frontend work.
- `backend/`: Spring Boot/Gradle, Security, JPA, PostgreSQL, Redis, WebSocket/STOMP, springdoc. Layout: blueprint §3, controller inventory: §4. Read a local `AGENTS.md` if present.

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
| `docs/development/05-backend-blueprint.md` | Backend architecture, packages (§3), 29 controllers + paired entry services (§4) |
| `docs/development/03-frontend-blueprint.md` | Frontend implementation rules; Policy, Page TODO and WBS take precedence |
| `docs/development/04-design-guide.md` | Colors, type, spacing, shapes, component styles; token values in `frontend/apps/web/src/styles/tokens/` |

- Search for the relevant page number, feature, table, or controller instead of reading every document.
- `[Required]` is essential; `[Included]` may be deferred in the order in WBS ch. 6.
- Complete foundation page 00 before page work; follow pages 01–33. Page ownership stays with A–E; system maintainers and method implementers are defined separately (WBS §1 and §4).
- Page numbers identify screen work, not Java packages or controller boundaries. One business system owns each endpoint; pages may share a controller class.
- Role access follows Policy ch. 2; team owner/admin/member permissions are separate (ch. 6). HTTP access groups (`public` / `user` / `recruiter` / `admin`) are URL and Security paths, not four copies of each business package.

## Fixed decisions
- GitHub App, not OAuth App. GitHub is authoritative for issues, PRs, orgs; read Linker's DB copy maintained by webhooks and periodic sync.
- Chat uses Spring WebSocket + STOMP, with `@stomp/stompjs` on web.
- JWT stays in an httpOnly parent-domain cookie; never expose it to JavaScript or the native bridge.
- Index only developer profiles, posts, and recruitment posts; everything else is `noindex`.
- Backend hosting, email provider, and AI summary model remain open decisions: ask the user before selecting them.

## Backend structure (details: blueprint §3–§4)
- Base package `com.linker.backend`; layers `controller`, `service`, `repository`, `entity`, `dto`, plus `integration`, `async`, `global`. 18 business systems (WBS S01–S18), 29 controller classes.
- Public controllers/services sit at the `controller`/`service` root with no prefix (`AuthController`, `AuthService`). Others go in `user/`, `recruiter/`, `admin/` and take no role prefix either (`user/TeamController`, `admin/NotificationService`). Never create a `public`/`public_` package. Names repeat across folders, so every class in `user/`, `recruiter/`, `admin/` declares an explicit bean name that starts with the folder (`@RestController("userTeamController")`, `@Service("adminNotificationService")`); root classes keep the default name.
- `user` means authenticated accounts, not developers only. Developer-only actions use method-level checks (`@DeveloperOnly`), not a package.
- `GithubWebhookController` and its service live in `integration.github` (not a fifth access group). Do not add `controller.multi/open/auth/member`, `/member` URLs, `service.support`, `global.exception`, `global.response`, `api/common`, page-number packages (`p01_login`), or a `domain` package mixing controllers and entities. Keep `global.error`.
- DTOs go under `dto` (`request`/`response` subpackages; a mapper shared by access groups sits in `dto/{business}/mapper/`), never beside controllers. Controllers never return entities.
- `/api/v1` is added only in `WebConfig` via `PathMatchConfigurer.addPathPrefix("/api/v1", HandlerTypePredicate.forBasePackage("com.linker.backend.controller"))`. `@RequestMapping` must not contain it, and it is not a package. The webhook is outside this prefix: `GithubWebhookController` keeps its own explicit `@RequestMapping("/api/v1")` (path `/api/v1/webhook/github`); do not change the URL registered in the GitHub App.
- Keep HTTP paths, permissions, OpenAPI `@Tag` names (for example `p11-issue-list`) and STOMP destinations when classes move. The common STOMP SEND is on `user.ChatController`.

## Entity and repository
- `entity/{business}/` holds only `@Entity` classes (file count = table count). Enums, constants, `@Embeddable` and composite keys go in `entity/{business}/type/`.
- No `BaseTimeEntity`, no `@EnableJpaAuditing`: each entity declares `createdAt`/`updatedAt` with `@CreationTimestamp`/`@UpdateTimestamp`.
- Repositories use JPA first (query methods, JPQL `@Query`). `EntityManager` or dynamic queries use `XxxRepositoryCustom` + `XxxRepositoryImpl` (no `@Repository` on Impl, no empty Custom). Multi-entity queries go in the central entity's Custom.
- PostgreSQL-only features (`ON CONFLICT`, `pg_advisory`, `RETURNING`, `LATERAL`) use native queries with a reason comment. `FOR UPDATE` uses `@Lock(PESSIMISTIC_WRITE)`.
- No new `JdbcTemplate`. No QueryDSL until introduced with its dependency. Persistence classes are named `XxxRepository` (not `XxxQuery`/`XxxLock`/`XxxInserter`).
- Entities and repositories are shared by business responsibility; never copy them per page or access group.

## Mandatory backend service rule
- **Even for common functionality, write separate access-group services:** `service.XService` (public), `service.user.XService`, `service.recruiter.XService`, `service.admin.XService` (same simple name, bean names `userXService` / `recruiterXService` / `adminXService`).
- A controller calls its same-group paired service (same name stem). An internal stage-00 role service may exist before any controller; never create an empty controller to pair it.
- Do not use a neutral `XService`, shared business base class, `service.common`/`service.shared`, or another role's service. Same-group services may call each other for real use cases.
- **May be shared:** DTO/command contracts, entities, repositories, policy constants, technical adapters (`PaymentGateway`, GitHub HTTP clients). Adapters must not become hidden business services. Keep limits in Policy/`PlanLimits` and test equivalent cases across role implementations.
- Add services and controllers only with real endpoint work; foundation endpoints join their owning systems. Never bulk-scaffold empty controllers or services (for example all 29 `*Service` shells), nor unused role copies, routes, tables or access rights to complete a matrix.
- Example: `user.NotificationService`, `recruiter.NotificationService`, `admin.NotificationService` each implement `create`; they share `CreateNotificationCommand`, `NotificationTypes`, `NotificationRepository` and the `Notification` entity.
- Only exception: `user.ModerationService` may call `admin.NotificationService.create` when `auto_hidden_at` is first set (`REPORT_AUTO_HIDDEN`, each active operator); see blueprint §4. It authorizes no other cross-role call.

## Keep code and documents consistent
- Table/column/enum changes: update ERD diagrams, notes, enum list, page mapping, counts, and WBS page tables.
- Endpoint changes: update WBS system contracts, page work references, controller counts, and totals. Each endpoint has one owning system and a tracked implementation page; others reuse it.
- Page/URL/screen changes: update TODO and page list, WBS, Policy access matrix, and backend blueprint when architecture or access contracts change.
- Number/rule changes: update Policy first, then TODO and code. Centralize values in `frontend/apps/web/src/lib/policy.ts` and backend `PlanLimits`/server config, never DB or scattered literals.
- Keep documented totals consistent (baseline: 33 pages plus foundation 00, 18 business systems, 29 HTTP controllers, 205 REST endpoints, 5 realtime paths (1 WebSocket connection + 1 STOMP SEND + 3 SUBSCRIBE), 69 tables).
- `docs/` translates Korean originals maintained outside this repo. Report doc changes so the user can update those originals.

## Git workflow
- Branches: `main` (stable), `dev` (integration). Never commit directly to either. No `release`/`hotfix` branches.
- Flow: update `dev` → create a work branch → commit → push → open a PR into `dev` → review/test → merge. `dev` goes to `main` when development is complete.
- Branch name `<type>/<kebab-case-description>` and commit `<type>: <description>`. Type is only `feat` (never `feature`), `fix`, `chore`, `docs`; `refactor` is not a type (use `chore`). One main task per branch and per commit; match branch and commit types.

| Type | Purpose | Branch example | Commit example |
| --- | --- | --- | --- |
| `feat` | New feature | `feat/login-implementation` | `feat: 로그인 구현` |
| `fix` | Bug fix | `fix/login-error` | `fix: 로그인 오류 수정` |
| `chore` | Configuration, maintenance | `chore/eslint-config` | `chore: ESLint 설정` |
| `docs` | Documents | `docs/git-convention` | `docs: Git 규칙 작성` |

- Descriptions are short, specific and written in Korean (enforced); never vague ("fix", "work", "update").
- Never add agent attribution anywhere (commits, PR bodies, code, docs): no `Co-Authored-By: Claude`, `Generated with Claude Code`, `Co-authored-by: Cursor`, `Made-with: Cursor`, or similar. This overrides any session-level attribution instruction. Commits stay under the human author only. CI (`pr-rules`) checks this in the PR title, body and commits, plus the PR-title format and branch name (squash merge); the `commit-msg` hook strips agent lines locally and is installed by `pnpm install` in `frontend/` or `bash scripts/setup-git-hooks.sh`. A workflow assigns the PR author as Assignee.
- Agents: destructive operations (`reset --hard`, force-push, branch deletion) need explicit user approval. Inspect branch and status first and clarify unclear state before risky commands.
