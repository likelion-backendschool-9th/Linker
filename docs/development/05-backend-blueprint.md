# Linker Backend Blueprint — Public Controllers at Root, Controller/Service 1:1


> 2026-11-04 · Official architecture. Start from [AGENTS.md](../../AGENTS.md), then §3–§4 here. Public controllers/services are at root; business services remain role-specific even for common capabilities; GitHub webhook lives in integration.github.
>
> Local notes and translated drafts may be absent or outdated. They are supplementary snapshots, not the source of current generation rules.

## 1. Sources and scope

| Source | Owns |
| --- | --- |
| This blueprint §3–§4 | Current package placement, controller/service inventory and mandatory role-service rules |
| Local WBS PDF, when available | Supplementary date/collaboration snapshot; not required for architecture rules |
| [Official WBS](02-wbs.md) | API behavior, permissions, pages and work contracts |
| [Policy](../planning/04-policy.md) | Numbers, roles, states, exceptions and UI copy |
| [Existing ERD](01-erd.md) | Tables, columns and relationships |
| [MVP](../planning/03-mvp-definition.md) | Required/Included scope and launch conditions |

**Target:** 18 business systems, **29 HTTP controllers + 29 planned paired entry services**, 205 REST endpoints, 5 realtime paths, 69 tables (56 required + 13 included), and 33 pages plus foundation 00. Controller count ≠ business-system count. These are design totals, not implementation progress; implemented internal role services may exist in addition to the planned controller pairs.

AGENTS follows this layout. Implemented controllers already use paired entry services under `service` / `service.user`; helpers for those features live in the same access packages (not legacy `service.catalog`-style folders).

**Forbidden:** creating the full set of empty paired entry services (PAS) or empty controllers “for structure” (for example scaffolding all 29 `Public*Service` / `User*Service` classes with no endpoints). Add a paired entry service with real endpoint work; a role-specific internal stage-00 service may be added with its actual use case without creating a controller. Neither case permits empty scaffolding.


## 2. Architecture and layer boundaries

One Spring Boot application serves the mobile-first Next.js web and Expo WebView. Spring owns authentication, authorization, state, limits, transactions and entitlements. GitHub is authoritative for orgs/repos/issues/PRs; Linker reads its synchronized cache and owns chat, applications, posts, payments and moderation.

Keep `com.linker.backend`, Java 21 and the existing Gradle project. The inspected build uses Spring Boot 4.1.2; this document does not request an upgrade. No microservice split or new schema is implied.

| Layer | Responsibility | Avoid |
| --- | --- | --- |
| controller | HTTP validation, access declarations, calls to the paired entry service, DTO responses | Direct repository queries, business-rule copies, entity responses |
| service | Access-group-specific use cases and role-named service classes | Servlet coupling; borrowing a different role’s service or neutral shared business service |
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
- Do not add `controller.member`, a member account role, `/member` URLs, or `controller.auth`. Login, refresh, password and OTP stay on their access-group controllers; authentication service classes follow the same access-group naming rule; DTOs, repositories and entities remain shared.
- **GitHub webhook** lives under `integration.github` (not a fifth human access group and not `controller` root). It still accepts `POST /api/v1/webhook/github`, verifies signatures and delivery IDs, then hands off to async/business processing.
- Repositories/entities stay **business-owned**, not role-owned. DTOs follow business request/response packages.


## 4. Controller ↔ service 1:1

**1:1 means each HTTP controller calls its same-group paired entry service.** Services with overlapping capabilities still use role-specific classes (`UserXService`, `RecruiterXService`, `AdminXService`). Do not route them through a neutral shared `XService` or through another role’s service. Repositories, entities, input contracts and policy constants remain shared.

```text
UserSubscriptionController  → UserSubscriptionService  → PaymentGateway
AdminSubscriptionController → AdminSubscriptionService → PaymentGateway
```

- The authoritative generation rule is in [AGENTS.md](../../AGENTS.md#mandatory-backend-service-generation-rule). Public/role business services must be independently named and implemented even when capabilities overlap. Do not use neutral shared business base classes or another role’s service. Same-group internal services may collaborate.
- Shared DTOs/entities/repositories, policy constants and technical adapters are allowed; they are not shared business-service implementations.
- Add role services only with real work, never empty placeholders for all planned controllers.
- Keep access checks and business transactions explicit. When rules repeat across roles, cover all implementations with the same policy cases so they cannot silently diverge.
- Notification creation is a stage-00 internal use case, so it does not require an empty notification controller or a new REST API. The implemented producers are `service.user.UserNotificationService`, `service.recruiter.RecruiterNotificationService`, and `service.admin.AdminNotificationService`.
- Each exposes `create(dto.notification.request.CreateNotificationCommand)`, validates recipient/optional actor, calculates quiet hours from PlanLimits, and saves through the existing NotificationRepository in the caller’s transaction.
- The service prefix identifies the producing use-case boundary, **not the recipient’s account type**. A logged-in user flow calls `UserNotificationService` (team invite is this case). A recruiter flow calls `RecruiterNotificationService`. An operator flow calls `AdminNotificationService`. Role notification services do not delegate to each other; the report auto-hide producer exception below is explicit. Anonymous creation has no use case, so there is no `PublicNotificationService`.
- Callers check their own use-case permission and, for `MARKETING`, marketing consent before building the command. The service does not grant permission by name. `create` does not suppress senders the recipient has blocked; that filter stays at the call site (DM and notification suppression are still to be wired with chat).
- `CreateNotificationCommand` requires `recipientUserId` and `notificationType`. Optional fields are `actorUserId`, `targetType`, `targetId`, `linkPath`, `payloadJson`, and `groupKey`. A blank `notificationType` throws `IllegalArgumentException`. Blank optional strings are stored as null. `NotificationTypes` holds known strings (`CHAT`, `ISSUE_ASSIGNED`, `DUE_SOON`, `APPLICATION_RECEIVED`, `APPLICATION_ACCEPTED`, `APPLICATION_REJECTED`, `COMMENT`, `FOLLOW`, `MESSAGE_REQUEST`, `TEAM_INVITE`, `REPORT_AUTO_HIDDEN`, `MARKETING`); producers may pass another string. These strings are not a database enum.
- A missing or deleted recipient, or a present but missing or deleted actor, throws `404 NOT_FOUND` with message `사용자를 찾을 수 없어요`. Deleted means `UserStatus.DELETED` or `deletedAt` set.
- `create` is `@Transactional` and joins the caller’s transaction, so a rollback of that use case removes the notification row. It does not send push or publish STOMP. List, read, badge, push, and the morning flush of `deliver_after` are page 18, not this contract.
- Quiet hours are calculated inside each role service from `PlanLimits` (KST). `CHAT` stores `deliver_after` null. `MARKETING` waits from 21:00 to 08:00. Every other type waits from 22:00 to 08:00. Outside those windows `deliver_after` is null.
### Report auto-hide notification — frozen contract

- **Recipient:** each active operator backed by `admins` and an active, non-deleted account. No notification to the reported user or reporters; the reported user sees only the existing 「검토 중」 UI.
- **Trigger:** the first transition of `auto_hidden_at` from null to a timestamp at `PlanLimits.REPORT_AUTO_HIDE_REPORTERS` distinct eligible reporters (currently 5). Do not create on every report or on later reports against an already hidden case. E owns the atomic transition/concurrency guard in Moderation.
- **Type:** `NotificationTypes.REPORT_AUTO_HIDDEN` = `"REPORT_AUTO_HIDDEN"`. `notification_type` remains String/varchar, not a DB enum.
- **Producer:** E's `UserModerationService` calls `AdminNotificationService.create(CreateNotificationCommand)` once per active operator in the auto-hide transaction. This system-generated operator alert is the narrow exception to the cross-role service-call prohibition; it does not move Moderation business logic into the notification service.
- **Recommended command:** `recipientUserId = operator.userId`, `actorUserId = null` (system event), `targetType = null`, `targetId = null`, `linkPath = "/admin/reports"`, `payloadJson = null`, `groupKey = "report-auto-hidden:" + caseId`. The case ID is `report_cases.id`. `groupKey` is a grouping hint, **not** an idempotency guarantee. E resolves recipients and prevents duplicate production; create only validates and persists each recipient's row.
- Creation joins the existing transaction; it adds no REST, migration, push or STOMP delivery. Existing non-CHAT/non-MARKETING quiet hours still apply (22:00–08:00 KST); auto-hide triggers row creation, not immediate external delivery.
- Chat ±10 report snapshots, reporter outcome notifications, and sanctions notifications are outside this contract. D freezes the constant/contract; E wires the auto-hide call site.


```java
userNotifications.create(new CreateNotificationCommand(
        recipientUserId,
        NotificationTypes.TEAM_INVITE,
        actorUserId,
        null,
        null,
        "/invite/" + code,
        null,
        null));
```

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
| Account payments / operator refunds | UserSubscription / AdminSubscription | Separate role implementations; shared PaymentGateway/repositories; distinct payer/target and admin checks |

Apply authorization in `global.security` and services. Package names do not grant access. Operator privileges never bypass ordinary team/chat membership.

The session cookie is an RS256 JWT after #176; its SHA-256 hash remains linked to the DB session. Keep secrets in httpOnly cookies only. Screen claims do not replace current DB authorization. GitHub App JWT keys are separate from these session keys.

Responses keep unwrapped success bodies, cursor `{items, nextCursor}`, create/async statuses and `global.error` `{code, message, detail}`. Do not expose entities. Preserve per-endpoint `p00`/`pNN` OpenAPI tags at method level when classes split.


## 6. Realtime and consistent role-specific business rules

| Kind | Path |
| --- | --- |
| WebSocket | `/ws` |
| STOMP SEND | `/app/chat-rooms/{roomId}/messages` |
| SUBSCRIBE | `/topic/chat-rooms/{roomId}` |
| SUBSCRIBE | `/user/queue/chat-rooms` |
| SUBSCRIBE | `/user/queue/notifications` |

Place the single STOMP SEND on `UserChatController` → `UserChatService`. Recruiter offer actions use `RecruiterChatService`; role services implement their own business handling against the same chat data model/repositories, not a shared neutral ChatMessageService. Authenticate CONNECT; authorize SEND/SUBSCRIBE; protect personal queues. Persist, commit, then publish; reconnect catches up via REST. Do not add destinations or a ticket API. These five paths are separate from the 205 REST endpoints.

| Business | Shared rule |
| --- | --- |
| Recruitment acceptance | UserRecruitmentService coordinates same-group team/chat/notification services and the transaction; GitHub org invite stays separate |
| GitHub/issues | Distinct user vs installation tokens; verify signatures; dedupe delivery IDs; refresh caches; reconcile misses |
| Chat | Dedupe by sender/client message ID; consistent read pointers; block-period/leave/hidden rules; team-chat exception per Policy |
| Notifications | Role-specific User/Recruiter/AdminNotificationService.create with shared command/data; TEAM_INVITE → `/invite/{code}`. Creation joins the producing transaction; no external delivery here |
| Payments | UserSubscriptionService and AdminSubscriptionService each verify their use case and PG result; share technical PaymentGateway and data contracts, not a neutral PaymentService |
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

Public controllers/services remain at `controller`/`service` roots, authenticated ones under `*.user`, and webhook ingress under `integration.github`. The original seven paired entries now also have `UserGithubController`/`UserGithubService` for the documented installation spike; the role-specific notification creation services remain internal. Session cookies use RS256 JWTs; STOMP scaffolding exists, but `UserChatService` still rejects send until chat persistence lands. The GitHub HTTP adapter requires no ambient DB transaction, webhook outcomes use short transactions, and duplicate dispatch uses a PostgreSQL session advisory lock. See [GitHub App operations](../operations/06-github-app.md) for A token integration and live-spike prerequisites.


## 9. Migration and unresolved decisions

1. Done for existing classes: Public* → `controller` root (no `public_`); webhook → `integration.github` with webhook service; paired entry services for the controllers that already exist. Routes unchanged.
2. Add paired entry services only with real endpoints in the same change; never bulk-scaffold empty PAS. Use role-named services for real use cases and keep shared DTO/repository/entity contracts.
3. Keep routes, permissions, DTOs, OpenAPI tags and STOMP destinations stable. Never register old and new controllers on the same path.
4. Verify build, security, transactions and STOMP after moves.

Still open: JWT/cookie rotation; BFF; payment trial/renewal; AI/mail/storage providers; Included launch gates; remaining paired entry services.

**Status:** Official blueprint and AGENTS match this layout. Paired entry services are added with features, not as empty shells. SQL/Nginx routing unchanged by package moves.


### Source fingerprints

- `.local-notes/backend/fix/BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md` — SHA-256 `55113d5d0196`
- `.local-notes/backend/fix/03-linker-wbs-schedule - 03-linker-wbs-schedule.csv.pdf` — SHA-256 `1d1c17b54d10`
