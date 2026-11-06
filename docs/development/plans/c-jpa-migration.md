# C: 2단계 이슈 JPA 전환 기록

> 2026-11-06 · `chore/issue-jpa` · 기준 `origin/dev aa418f0` (#248 B 팀 기반, #249·#250 D, #251·#252 A 포함)
> 계획: [docs/improvements/02-jpa-migration.md](../../improvements/02-jpa-migration.md) 5절 C, 6절 `IssueSyncLock`

## 범위

02 문서 5절 C 표의 9개 파일과 이름 정리 1개(`IssueSyncLock`)를 모두 처리했다. API(URL·응답), 권한, OpenAPI 태그·operationId, 화면은 바꾸지 않았다. 테이블 수는 69개 그대로다(ERD에 이미 있는 5개 테이블을 정식 마이그레이션으로 옮긴 것).

| 전환 전 | 전환 후 |
| --- | --- |
| `repository/issue/IssueContextRepository` | `IssueRepository.context/syncTeams/webhookTeams`. 팀·설치·보드·저장소는 B의 `TeamRepository.findConnection/findBoardStatusMappings/findLinkedRepos`로 읽는다 |
| `repository/issue/IssueSyncLock` (이름 규칙 위반) | `IssueRepository.withTeamLock` (B의 `withTeamSetupLock`과 같은 방식) |
| `repository/issue/IssueCacheRepository` | `IssueRepository.cached/apply/failedAdd` |
| `repository/issue/IssueReadRepository` | `IssueRepository.list/board/calendar/options` |
| `repository/issue/IssueDetailRepository` | `IssueRepository.detail/assignees/labels/author/assigneeCandidates/linkedId/actor/subIssues` |
| `repository/issue/IssueReminderRepository` | `IssueRepository.reminderCandidates/reminderEligible/reminderClaimed` |
| `repository/issue/IssueEditJobRepository` | `IssueSyncJobRepository.queueEdit/edit/dueEdits/startEdit/finishEdit/failEdit` |
| `repository/issue/IssueCreateJobRepository` | `IssueSyncJobRepository.creation/existingCreation/queueCreation/dueCreations/startCreation/checkpointCreation/finishCreation/failCreation`, 이슈 쪽 갱신은 `IssueRepository.markCreatedViaLinker/assigneeRecipients` |
| `service/user/IssueProgressService` 안의 SQL | `IssueRepository.subscriptionsReady/flexActive/progressCounts/openWorkloads/overdueCount/dueSoonCount`, `TeamProgressSnapshotRepository.findHistory/insertDaily/deleteOlderThan` |
| `integration/github/GithubIssueWebhookHandler` 안의 SQL | `IssueRepository.webhookTeams` |

결과: main 코드에서 C 영역의 `JdbcTemplate`/`NamedParameterJdbcTemplate`은 0개다. 남은 3개는 D(`TeamChatAccess`)와 A(`PublicProfileQuery`, `AdService`) 영역이다.

## 마이그레이션과 Entity

- **V22__issues.sql**: `db/issue-schema/issue-cache.sql`·`issue-sync-jobs.sql`의 5개 테이블(`issues`, `issue_assignees`, `issue_labels`, `team_progress_snapshots`, `issue_sync_jobs`)을 정식 편입했다. V20(B)·V21(D) 다음 번호다. 컬럼·CHECK·인덱스·부분 유니크 인덱스는 준비 SQL과 같다.
  - ERD 공통 컬럼 규칙에 맞춰 준비 SQL에 없던 `created_at`/`updated_at`을 `issue_assignees`, `issue_labels`, `team_progress_snapshots`, `issue_sync_jobs(updated_at)`에 추가했다. 집계 배치의 네이티브 INSERT와 테스트 픽스처를 위해 `DEFAULT now()`를 유지한다.
  - 준비 SQL 두 파일은 B와 같은 방식으로 "V22로 대체됨, 적용 금지" 머리말을 달아 기록용으로 남겼다.
- **Entity** `entity/issue/`: `Issue`, `IssueAssignee`, `IssueLabel`, `IssueSyncJob`, `TeamProgressSnapshot` (5개 = 테이블 5개). FK는 B와 같이 `Long` ID 필드다.
- **enum** `entity/issue/type/`: `IssueState`, `IssueSyncStatus`, `IssueSyncStep`, `IssueSyncJobStatus`. `board_status`는 B의 `entity/team/type/BoardStatus`를 재사용한다.
- `IssueSyncJob.createdAt`만 `@CreationTimestamp`가 아니다. 작성자별 KST 하루 생성 한도가 애플리케이션 Clock 기준 `created_at`으로 행을 세기 때문이다(기존 동작 유지, Entity 주석에 이유 기록).
- 서비스가 쓰던 내부 조회 결과(record)는 B의 `TeamPersistenceView`처럼 `dto/issue/response/IssuePersistenceView`로 옮겼다. HTTP 응답 계약이 아니다.

## 쿼리 전환 방식

- 기본은 JPQL(theta join, B의 `TeamRepositoryImpl`과 같은 방식)이다. 동적 필터(11·14번 필터, 커서)는 Impl에서 JPQL 문자열을 조립하고 값은 모두 파라미터로 바인딩한다.
- `FOR UPDATE`(캐시 저장 시 같은 GitHub 이슈 직렬화)는 `LockModeType.PESSIMISTIC_WRITE`로 바꿨다. Hibernate PostgreSQL 방언이 `FOR NO KEY UPDATE`를 만든다. 같은 이슈를 쓰는 작업끼리는 그대로 직렬화되고, 이 행을 FK로 참조하는 INSERT(담당자·작업 행)는 막지 않는다.
- 네이티브로 남긴 것(모두 이유 주석 있음)
  - `pg_try_advisory_lock`/`pg_advisory_unlock` (팀 이슈 세션 락), `pg_advisory_xact_lock` (생성 한도, 알림 중복 방지)
  - `team_progress_snapshots`의 `INSERT ... SELECT ... ON CONFLICT DO NOTHING` 집계 배치
  - 마감 알림 후보·재확인: `FOR SHARE OF i,u,m,t,r,tr`. JPA 잠금은 루트 Entity 행만 잠그므로(`for share of i1_0`로 확인) 기존 SQL을 그대로 쓰고, 두 쿼리가 같은 조건을 공유한다.
  - D의 `subscriptions`는 아직 마이그레이션·Entity가 없어 존재 확인과 Flex 조회를 네이티브로 둔다. D가 편입하면 JPQL로 바꿀 수 있다.
- `RETURNING id`는 `persist` 후 생성 ID로 대체했다. 그 밖의 `ON CONFLICT`는 C 코드에 없다.
- 조회 결과는 Entity가 아니라 **스칼라 프로젝션**이다. 이슈 서비스는 `@Transactional(propagation = NEVER)`라서 트랜잭션 밖 조회가 하나의 EntityManager를 공유한다. Entity로 읽으면 다른 트랜잭션이 커밋한 값이 보이지 않는다(테스트 3개에서 확인). JDBC와 같이 매번 DB 값을 읽도록 했다. 쓰기는 `flush`·`clear` 후 다시 읽는다.
- 목록 쿼리 수는 전환 전과 같다(개수, 목록, 담당자 일괄, 라벨 일괄 = 4개, N+1 없음).

## 동작 차이와 정리

- **스키마 준비 확인 제거**: `to_regclass`/`pg_attribute`로 이슈·팀 테이블과 `team_members.github_org_state` 컬럼이 있는지 보던 검사(`ready()`)를 지웠다. V20·V22로 항상 있기 때문이다. 이 검사만 확인하던 테스트 `page12MissingCandidateSchemaReturnsReadinessError` 1개를 함께 지웠다. `subscriptions` 확인은 위와 같이 남겼다.
- `webhookTeams`에 `order by t.id`를 붙였다(전에는 순서 미지정).
- 세션 락 해제 실패 시 작업이 이미 예외로 끝났다면 원래 예외를 그대로 던진다(전에는 503으로 덮었다). 락 획득·해제 실패만 503이다.
- `issue_sync_jobs` 대량 UPDATE는 기존 SQL처럼 `updated_at`을 바꾸지 않는다. Entity로 바뀌는 행만 `@UpdateTimestamp`가 갱신한다.
- `linker.issues.sync-enabled`/`webhook-enabled` 기본값(`false`)은 바꾸지 않았다. 실제 GitHub App 확인 뒤 켜는 것은 별도 결정이다.

## 테스트·스크립트

- `IssueReadIntegrationTest`가 `@BeforeAll`에서 준비 SQL을 실행하던 부분을 지웠다(Flyway V22가 만든다). `TeamSetupIntegrationTest`, `WorkspaceTeamIntegrationTest`의 준비 SQL 실행도 지웠다.
- 테스트의 픽스처용 `JdbcTemplate`은 02 문서 7절 권장대로 그대로 둔다.
- 테스트에서 쓰던 C 저장소 이름을 새 Repository로 바꿨다(`IssueRepository`, `IssueSyncJobRepository`).
- `repository/issue/IssueMigrationIntegrationTest` 추가: B의 `TeamMigrationIntegrationTest`와 같은 방식으로 격리 스키마에서 V21 → V22 업그레이드, 재실행 시 추가 실행 없음, `validate`, 5개 테이블·공통 컬럼·부분 인덱스, V1–V21 이력 유지를 확인한다.
- `scripts/github-integration/run.py`는 이슈 SQL을 직접 적용하지 않고 Flyway 이력(V20·V22 포함)만 확인한다. 예전 준비 SQL을 적용한 격리 DB는 V22와 충돌하므로 새 격리 환경이 필요하다. 스크립트 안전 테스트(`scripts/tests/test_github_integration.py`, CI `github-integration-tools`)도 "SQL을 적용하지 않고 Flyway 상태만 읽는다"에 맞춰 바꿨다(19개 통과).

## 검증

- `IssueReadIntegrationTest` 104개 통과(실패·오류·생략 0). Testcontainers PostgreSQL·Redis, 실제 Security 쿠키, 테스트 GitHub HTTP 서버 사용.
- 백엔드 전체 `./gradlew build` 통과(최신 dev aa418f0 기준 테스트 496개, 실패·오류·생략 0).
- OpenAPI: 컨트롤러·DTO 응답 타입을 바꾸지 않았다. `page14OpenApiTagsTheBoardAndWritesTheClientInput` 등 태그·operationId 테스트가 통과한다.
- 실제 GitHub App·개발/공용 DB에는 쓰지 않았다.

## 후속 (C 외)

- B `TeamRepositoryImpl.findCurrentTeams`의 열린 이슈 수 네이티브 집계는 이제 `Issue` Entity로 JPQL 전환이 가능하다(B 판단).
- D가 `subscriptions`를 편입하면 `IssueRepository.subscriptionsReady/flexActive`를 JPQL로 바꾼다.

## 문서 갱신

- 새 문서: 이 기록.
- `docs/improvements/02-jpa-migration.md` C 상태 줄, `docs/improvements/README.md` 2단계 상태.
- ERD·WBS·합계는 바뀌지 않는다(테이블·컬럼 의미·API 변화 없음, 공통 컬럼은 ERD 규칙대로).
