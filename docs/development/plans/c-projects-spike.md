# C foundation stage 3: Projects v2 and issue cache

## Completion boundary (2026-11-04)

The implementation and local verification that C can perform independently are complete for this foundation change. The live GitHub App spike is **not passed**. No production database migration, public REST endpoint, page implementation, team freeze, push or PR is included.

| Team sequence | C status | Evidence or remaining gate |
| --- | --- | --- |
| 2: policy / format / SSR / SEO / images | Previously merged | Frontend verification was completed in the preceding C PR; this change does not modify frontend code |
| 3: Projects and issue-cache implementation | Independent implementation and local tests complete | Clients, authoritative refresh, persistence and the existing B webhook pipeline are connected in isolated tests |
| 3: actual App spike and B integration | Pending | Production token/context adapters, prerequisite schema review and live App/board/webhook checks below |
| 4: C contract handoff | Criteria documented; agreement pending | Share policy keys and B/C mappings; C cannot declare the team's freeze alone |
| 5: pages 01 onward | Not started by this change | Begin after the team's D2 gate; page work is not a missing part of this foundation implementation |

## Implemented code

- `integration.github.GithubGraphqlClient`: shared transport; a token is supplied per call. Reject HTTP/transport failures, GraphQL errors including partial data, malformed data and invalid pagination. Exceptions omit upstream bodies and credentials. Mutations are not retried automatically.
- `GithubProjectsClient`: create a project, list fields, create DATE fields, add an existing issue, write/clear dates and single-select options, and re-read complete item values. Field and option IDs are supplied explicitly; display names are not hardcoded.
- `GithubIssuesClient`: read authoritative issue identifiers, state, text, author and complete paginated assignees/labels. Reject inconsistent snapshots. Re-read current, non-archived project membership instead of trusting stale webhook item values.
- `ProjectsItemChange`: parse identifiers from an already verified Projects webhook. PR/draft items are excluded. Parsing does not authenticate a request.
- `dto.issue.IssueCacheSnapshot` and `CachedIssue`: internal persistence records, not REST request/response contracts.
- `IssueCacheService` / `IssueCacheRepository`: atomic issue and relation refresh; conflict-safe insertion; row locks; identity validation; stale/equal Issues versions ignored; repeatable reads scoped by team. An explicit team predicate does not replace membership authorization.
- `ProjectsRefreshContext`: validated installation, organization, team, repository, project, field and status-option mapping supplied through the B/C boundary.
- `ProjectsCacheRefreshService`: reconcile current Projects status/dates/membership into the cache. Clears removed dates, handles archived/non-member items, rejects start after due, preserves pending/failed write jobs and does not overwrite unrelated cache metadata.
- `ProjectsItemWebhookHandler`: plugs into B's existing signature/storage/dispatch path. Validate installation/context, fetch the full source snapshot, commit the cache refresh, then return so B can mark the delivery processed. Errors propagate so B records FAILED.
- `GithubProjectsRuntimeConfiguration`: opt-in wiring and bounded HTTP timeouts. The consumer is disabled by default, so missing production adapters or draft tables do not activate it accidentally.

### Transactions and ordering

The issue's GitHub timestamp controls Issues-source replacement only; it is not compared with a Projects item's unrelated timestamp. Projects membership and fields are re-read under the issue row lock, so delayed/concurrent hints use current upstream values. An old deletion hint cannot remove a newly re-added item solely from its payload.

Cache refresh uses a separate transaction (`REQUIRES_NEW`, 45-second timeout). A cache failure rolls back its root/relations while allowing B's delivery transaction to persist FAILED. Authoritative Projects reads hold the row lock: this is a deliberate foundation tradeoff, bounded by 5-second connect / 10-second read timeouts. Higher-throughput reconciliation can be assessed later without claiming an unimplemented queue/retry worker here.

## B/C connection contract

| Owner | Responsibility |
| --- | --- |
| B | Approved App installation and permission context; token generation/refresh; verified installation-to-organization/team/repository/board bindings; webhook signature, delivery storage, queue and retry/redelivery |
| C | Projects/Issues clients, field and status interpretation, issue-cache refresh and cache transaction semantics |
| B + C | Implement/review the two adapters below against B's actual schema; agree field/option IDs, schema activation and live verification evidence |

The production connection points are `ProjectsAccessTokenProvider.readToken(installationId)` and `ProjectsRefreshContextResolver.resolve(change)`. No fake/default production implementation is shipped. An empty resolved context means a genuinely unlinked board; permission or lookup failures must not be disguised as an empty result.

Enable only after both adapters and the reviewed schema exist: pass `GITHUB_PROJECTS_CONSUMER_ENABLED=true` into the actual Spring process. `.env.example` documents the flag but a root `.env` file alone does not automatically configure Spring or forward variables into a container; the deployment owner must explicitly wire that environment. The default is false. Never commit tokens or place secrets in handoff evidence.

## ERD and schema gate

| GitHub source | Linker destination / rule |
| --- | --- |
| installation and organization | Verified B installation/team bindings |
| project and field IDs | `team_project_boards` and its Status/Start/Due fields; agree with B |
| status option ID | `board_status_mappings`; TODO / IN_PROGRESS / BLOCKED / DONE; unknown options OTHER |
| issue database ID / node ID / repository number | Separate identifiers in `issues`; never decode node IDs or use an issue number as a global ID |
| item membership | `issues.project_item_id`; null and board state NONE when no active membership |
| DATE values | `issues.start_date` / `due_date`; LocalDate, nullable, start <= due |
| assignees and labels | `issue_assignees` / `issue_labels`; complete authoritative Issues snapshot |
| follow-up user writes | `issue_sync_jobs`; pending/running/failed jobs are preserved by refresh |

`backend/src/main/resources/db/drafts/c-issue-cache.sql` contains the existing ERD's **four** tables: issues, issue_assignees, issue_labels and issue_sync_jobs. It is outside Flyway's `db/migration` directory. V1 and shared databases are untouched. Review B's teams/github_repos prerequisites, foreign keys and next migration version before promotion; do not manually apply this draft to a shared server.

Disposable DB fixtures contain only the prerequisite IDs required by the tests. They are not replacement implementations of B's tables. No new JPA entity is scanned for these draft tables.

## Policy and frontend handoff criteria

These are integration acceptance criteria, not a claim that a REST contract already exists:

- Keep limits in the existing `policy.ts`: ISSUE.createPerDay = 100, assigneesMax = 10, refreshIntervalSeconds = 60. Backend enforcement belongs to the eventual authorized use case; this internal cache is not that endpoint.
- Timestamps represent instants; screen/day boundaries use KST. Projects DATE values remain LocalDate without a UTC day shift. Missing due date is unscheduled, and start after due is invalid.
- Distinguish local Linker issue/team/repository IDs, GitHub database/node IDs, repository issue numbers and project item IDs in every mapping. Never substitute one for another.
- Agree TODO / IN_PROGRESS / BLOCKED / DONE / OTHER / NONE with B. A closed issue in an active board maps to DONE; unknown configured options map to OTHER; no active membership maps to NONE. User actions that close/reopen an issue remain a separate write use case.
- When the real IssueController/OpenAPI response is implemented, compare server fields, nullability, enum values, list envelope/pagination, filters, date serialization and error codes with the frontend query types and mocks. Update frontend/mock types to the server contract. Internal cache records are not automatically the public DTOs.
- Keep the existing method-level OpenAPI tags and Orval contract until the team agrees otherwise. Package changes do not authorize renaming tags, routes or generated imports.
- For joint verification, compare the same test issue across GitHub, stored cache and eventual API/UI; check state, dates, assignees, labels, unscheduled behavior, pagination and permission failures. The API/UI comparison is pending until those page APIs exist.

## Local verification completed

From `backend`, Java 21 and Docker available:

```powershell
.\gradlew.bat build --console=plain
```

Recorded on 2026-11-04: **BUILD SUCCESSFUL; 107 tests in 21 suites; failures 0, errors 0, skipped 0.** This is the full backend build, not only selected new test classes. No frontend code changed in this foundation patch.

PostgreSQL 16 and Redis 7 ran in disposable Testcontainers. GitHub HTTP responses were simulated. Coverage includes source pagination/errors, stale/equal refreshes, repeated simultaneous insertions, rollback, current membership reconciliation, status/date clearing, pending/failed job preservation, consumer default-off wiring and B's real signature/storage/dispatch pipeline connected to C. The pipeline tests verify both PROCESSED success and persisted FAILED after upstream or cache failure.

These tests prove local implementation behavior. They do not prove real App permissions, live GitHub schema acceptance, production adapters or deployment configuration. No real GitHub board or shared database was modified. Remote PR CI has not run for this unpushed work.

## Remaining checks before marking C stage 3 passed

- [ ] B + C connect the production token/context adapters against verified installation/team/repository/board data; agree IDs and status mapping.
- [ ] Review prerequisites and promote the four-table draft into the agreed Flyway migration; verify on the integration environment.
- [ ] On an approved disposable organization/board, record the actual caller/token permissions; create/read the board and inspect actual Status options.
- [ ] Confirm Blocked preparation without overwriting existing options; add a test issue, set Blocked and re-read while the issue stays open.
- [ ] Create/read the start/due DATE fields, write/re-read valid dates and clear a date; confirm unscheduled behavior.
- [ ] Trigger a real signed `projects_v2_item` delivery and verify B delivery status, C cache values and failure/redelivery behavior end to end.
- [ ] Record sanitized results/reproduction steps and share the B/C contract plus C policy keys for the team's D2 freeze.

B's entire feature set does not need to be finished first; only the concrete dependencies above are needed. C's independent foundation implementation is ready for review now. Do not mark the live spike or the team's freeze complete from local tests alone.

Periodic full sync, user-write job execution/retries, permission-protected page APIs, board/calendar screens and verified issue transfers are later use cases, not implemented features of this foundation patch. No claim about their completion is made here.

## References

- Repository WBS section 3 and IssueController contracts; backend blueprint package/layer rules; existing ERD Projects and issue tables.
- GitHub issue #49: C foundation Projects/issue-cache and integration criteria.
- [GitHub Projects API guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Projects GraphQL reference](https://docs.github.com/en/graphql/reference/projects)
- [projects_v2_item webhook](https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item)
