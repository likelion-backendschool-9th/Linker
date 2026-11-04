# Linker Backend Blueprint — Public Controllers at Root, Controller/Service 1:1


> 2026-11-04 · Public controllers at `controller` root; paired entry services; GitHub webhook under `integration.github`.
> Local Korean draft (same rules): [`.local-notes/backend/fix/BACKEND_BLUEPRINT.ko.md`](../../.local-notes/backend/fix/BACKEND_BLUEPRINT.ko.md). Prior official draft: [`.local-notes/backend/old/05-backend-blueprint_old.md`](../../.local-notes/backend/old/05-backend-blueprint_old.md).


## 1. Sources and scope

| Source | Owns |
| --- | --- |
| [Local folder proposal](../../.local-notes/backend/fix/BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md) | Target controller/service placement and all 205 API assignments |
| [Local WBS PDF](<../../.local-notes/backend/fix/03-linker-wbs-schedule - 03-linker-wbs-schedule.csv.pdf>) | S01–S18 work, implementers, dates, collaboration and schedule flags |
| [Official WBS](02-wbs.md) | API behavior, permissions, pages and work contracts |
| [Policy](../planning/04-policy.md) | Numbers, roles, states, exceptions and UI copy |
| [Existing ERD](01-erd.md) | Tables, columns and relationships |
| [MVP](../planning/03-mvp-definition.md) | Required/Included scope and launch conditions |

**Target:** 18 business systems, **29 HTTP controllers + 29 paired entry services**, 205 REST endpoints, 5 realtime paths, 69 tables (56 required + 13 included), and 33 pages plus foundation 00. Controller count ≠ business-system count. These are design totals, not implementation progress.

AGENTS follows this layout. Implemented controllers already use paired entry services under `service` / `service.user`; helpers for those features live in the same access packages (not legacy `service.catalog`-style folders).

**Forbidden:** creating the full set of empty paired entry services (PAS) or empty controllers “for structure” (for example scaffolding all 29 `Public*Service` / `User*Service` classes with no endpoints). Add a paired entry service only when that controller gains a real use case in the same change.


## 2. Architecture and layer boundaries

One Spring Boot application serves the mobile-first Next.js web and Expo WebView. Spring owns authentication, authorization, state, limits, transactions and entitlements. GitHub is authoritative for orgs/repos/issues/PRs; Linker reads its synchronized cache and owns chat, applications, posts, payments and moderation.

Keep `com.linker.backend`, Java 21 and the existing Gradle project. The inspected build uses Spring Boot 4.1.2; this document does not request an upgrade. No microservice split or new schema is implied.

| Layer | Responsibility | Avoid |
| --- | --- | --- |
| controller | HTTP validation, access declarations, calls to the paired entry service, DTO responses | Direct repository queries, business-rule copies, entity responses |
| service | Access-boundary use cases (paired entry) and shared business components | Servlet coupling; copying the same rule per role |
| repository | Persistence and query projections | Pricing or access-policy decisions |
| entity | ERD state, relationships and state changes | Acting as API JSON contracts |
| dto | Actual request/response contracts | JPA mappings; duplicate types only because roles differ |
| integration | External adapters **and** the GitHub webhook HTTP entry | Treating unverified provider output as business success |
| async | Queue consumption, post-commit delivery, scheduled entry points | Duplicated rules outside services |
| global | Config, security, errors and JPA infrastructure | Unrelated feature helpers |

Use Controller → (paired) Service → Repository. Keep `global.error`, shared `BaseTimeEntity`, and business-based repositories/entities. Do not create mixed-layer `domain`, page-number packages, `service.support`, `global.exception`, or `global.response`.


## 3. Package structure

```text
com.linker.backend/
├── BackendApplication.java
├── controller/
│   ├── PublicAuthController.java
│   ├── PublicAccountController.java
│   ├── …                         # other public API controllers (no public_ package)
│   ├── user/
│   ├── recruiter/
│   └── admin/
├── service/
│   ├── PublicAuthService.java
│   ├── PublicAccountService.java
│   ├── …                         # paired public entry services
│   ├── user/
│   ├── recruiter/
│   └── admin/
├── integration/
│   ├── github/
│   │   ├── GithubWebhookController.java
│   │   ├── GithubWebhookService.java
│   │   └── …                     # GitHub HTTP/GraphQL adapters
│   └── payment|mail|push|storage|ai/
├── repository/{business}/
├── entity/{business}/
├── dto/{business}/request|response/
├── async/webhook|notification|schedule/
└── global/config|security|error|jpa/
```

- **`public` is an HTTP access label only.** Do not create a Java package named `public` or `public_`. Public controllers and their paired services live at the `controller` / `service` **roots**. Keep the HTTP prefix `/api/v1/public`.
- `user` means **authenticated accounts**, not developers only. Notifications, uploads, chat and subscription may serve developers and recruiters. Apply `@DeveloperOnly` (and team/resource checks) at method level. Never make the whole `user` package developer-only.
- `recruiter` holds recruiter-only actions; `admin` holds operator actions. An operator is a developer with `admins` permissions and follows normal developer rules outside admin APIs.
- Do not add `controller.member`, a member account role, `/member` URLs, or `controller.auth`. Login, refresh, password and OTP stay on their access-group controllers; shared auth helpers may live under shared components once agreed.
- **GitHub webhook** lives under `integration.github` (not a fifth human access group and not `controller` root). It still accepts `POST /api/v1/webhook/github`, verifies signatures and delivery IDs, then hands off to async/business processing.
- Repositories/entities stay **business-owned**, not role-owned. DTOs follow business request/response packages.


## 4. Controller ↔ service 1:1

**1:1 means each HTTP controller calls one paired entry service** (rename `Controller` → `Service` in the same access group). It does **not** forbid that entry service from calling shared business components (for example payment, chat persistence, notification create).

```text
UserSubscriptionController  → UserSubscriptionService  ┐
                                                       ├→ shared payment work → PaymentGateway
AdminSubscriptionController → AdminSubscriptionService ┘
```

- Controllers own input, auth declarations and responses; paired services own that access boundary’s use case.
- Controllers must not call each other or “borrow” another role’s entry service to share behavior—extract shared work instead.
- Do not copy payment cancel, message persist, notification create or permission rules per role. Keep transaction and idempotency boundaries.
- Do not copy the same rule per role; reuse shared business logic behind the paired entry services. The final package home for that shared logic is a separate team decision.
- **Do not generate empty controllers or empty paired entry services (PAS) in bulk.** No skeleton `PublicAuthService`, `UserChatService`, etc. without a real endpoint/use case in the same PR. Prefer calling an existing business service from the controller until the paired entry service is introduced with feature work.


### Inventory (summary)

| Placement | Controllers / entry services | REST |
| --- | ---: | ---: |
| controller / service roots (Public*) | 8 / 8 | 27 |
| controller.user / service.user | 14 / 14 | 153 |
| controller.recruiter / service.recruiter | 4 / 4 | 10 |
| controller.admin / service.admin | 2 / 2 | 14 |
| integration.github (webhook) | 1 / 1 | 1 |
| **Total** | **29 / 29** | **205** |

Full class list and the 205-endpoint assignment live in the [local folder proposal](../../.local-notes/backend/fix/BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md). Keep A–E implementers and S01–S18 maintainers from the WBS; changing a Java package does not transfer ownership.


## 5. HTTP, authentication and authorization

Keep each API’s method, path, query, permission, DTO, status, error code, page tag and operationId. Java packages do not define URLs. `/api/v1/user` still hosts shared authenticated APIs; developer-only rules stay method-specific.

| Action | Controller | Required check |
| --- | --- | --- |
| GitHub/company-email sign-up, login and reset | PublicAuthController | State, verification/reset tokens, allowed return URL, failure limits |
| Refresh | PublicAuthController | Valid session/refresh eligibility despite public URL |
| Current session and logout | UserSessionController | Authenticated account and own session |
| Change recruiter password | RecruiterAuthController | Authenticated recruiter, own account |
| Operator OTP | AdminController | Logged-in registered operator candidate; permit pre-OTP verification |
| Shared notifications/uploads/chat | User* controllers | Login plus owner, participant and account-state checks |
| Teams/issues/recruit writing | User* controllers | Developer, team/resource and GitHub permissions |
| Member payments / operator refunds | UserSubscription / AdminSubscription | Same shared payment path; distinct payer/target and admin checks |

Apply authorization in `global.security` and services. Package names do not grant access. Operator privileges never bypass ordinary team/chat membership.

JWT remains the documented AGENTS target; the inspected code uses a random cookie token with a DB SHA-256 hash. Keep secrets in httpOnly cookies only. JWT migration is separate work.

Responses keep unwrapped success bodies, cursor `{items, nextCursor}`, create/async statuses and `global.error` `{code, message, detail}`. Do not expose entities. Preserve per-endpoint `p00`/`pNN` OpenAPI tags at method level when classes split.


## 6. Realtime and shared business rules

| Kind | Path |
| --- | --- |
| WebSocket | `/ws` |
| STOMP SEND | `/app/chat-rooms/{roomId}/messages` |
| SUBSCRIBE | `/topic/chat-rooms/{roomId}` |
| SUBSCRIBE | `/user/queue/chat-rooms` |
| SUBSCRIBE | `/user/queue/notifications` |

Place the single common SEND on `UserChatController` → `UserChatService` → shared message handling. Recruiter offers reuse the same chat persistence path. Authenticate CONNECT; authorize SEND/SUBSCRIBE; protect personal queues. Persist, commit, then publish; reconnect catches up via REST. Do not add destinations or a ticket API. These five paths are separate from the 205 REST endpoints.

| Business | Shared rule |
| --- | --- |
| Recruitment acceptance | Coordinate application, headcount, team membership, chat membership and in-app notification; GitHub org invite stays separate |
| GitHub/issues | Distinct user vs installation tokens; verify signatures; dedupe delivery IDs; refresh caches; reconcile misses |
| Chat | Dedupe by sender/client message ID; consistent read pointers; block-period/leave/hidden rules; team-chat exception per Policy |
| Notifications | Shared `NotificationService.create`; TEAM_INVITE → `/invite/{code}` |
| Payments | Server verifies price/account/target and PG results; same shared path for user and admin operations |
| Moderation / files / AI·ads·stats | Preserve Policy limits, snapshots, retention and privacy |

Do not hold a DB transaction open across a provider call. PostgreSQL is durable truth; Redis is queue/cache/rate-limit infrastructure. Keep the 69-table ERD and Flyway history; folder moves alone must not change schema or Nginx `/api` routing.


## 7. Webhook under integration

```text
GitHub
  → POST /api/v1/webhook/github
  → integration.github.GithubWebhookController
  → integration.github.GithubWebhookService
  → signature + delivery dedupe + durable receipt
  → async → business services / cache / chat linkage
```

Keep the existing URL and response contract. Do not treat the webhook as a guest “public user” API. Document the exception that an HTTP ingress class may live under `integration`. Align component-scan, security matchers and tests if they currently assume all `@RestController`s sit under `controller`.


## 8. Runtime and current implementation

Preserve the existing Compose/Nginx/main-deployment setup. The proxy routes `/api/v1/` to Spring and `/ws` with upgrade headers; `/api/bff/` is reserved. Follow [Docker](../operations/02-docker.md) and [automatic deployment](../operations/04-automatic-deployment.md). Package moves must not change deployment or provider selection.

Inspected layout after this adoption: Public controllers/services at `controller`/`service` roots; user controllers/services under `*.user`; webhook under `integration.github`. Foundation stage keeps exactly seven paired entry services (`PublicAuthService`, `PublicCatalogService`, `PublicSitemapService`, `UserSessionService`, `UserUploadService`, `UserModerationService`, `UserChatService`) with helper logic inlined into those classes. Session cookies use random tokens; STOMP scaffolding exists, but `UserChatService` still rejects send until chat persistence lands.


## 9. Migration and unresolved decisions

1. Done for existing classes: Public* → `controller` root (no `public_`); webhook → `integration.github` with webhook service; paired entry services for the controllers that already exist. Routes unchanged.
2. Add paired entry services only with real endpoints in the same change; never bulk-scaffold empty PAS. Keep reusing shared business logic without role copies.
3. Keep routes, permissions, DTOs, OpenAPI tags and STOMP destinations stable. Never register old and new controllers on the same path.
4. Verify build, security, transactions and STOMP after moves.

Still open: JWT/cookie rotation; BFF; payment trial/renewal; AI/mail/storage providers; Included launch gates; remaining paired entry services.

**Status:** Official blueprint and AGENTS match this layout. Paired entry services are added with features, not as empty shells. SQL/Nginx routing unchanged by package moves.


### Source fingerprints

- `.local-notes/backend/fix/BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md` — SHA-256 `55113d5d0196`
- `.local-notes/backend/fix/03-linker-wbs-schedule - 03-linker-wbs-schedule.csv.pdf` — SHA-256 `1d1c17b54d10`
