# B: 2단계 팀 JPA 전환과 C 인계

기준: `docs/improvements/02-jpa-migration.md`와 2026-11-06 공유 순서(B 팀 기반 → C 이슈 기반).
이 문서는 B 변경 범위와 소비 방법을 기록한다. Policy·ERD·WBS의 정책이나 API를 변경하지 않는다.

## 1. 적용 순서

- B는 **V20__team_foundation.sql 하나만** 사용한다. 기존 V1–V19는 수정하지 않는다.
- V20은 기존 준비 SQL의 7개 테이블과 `chat_rooms.team_id` FK를 정식 편입한다.
  `github_installations`, `teams`, `team_members`, `team_repos`, `team_project_boards`,
  `board_status_mappings`, `pull_requests`다. 설계상 새 테이블을 발명하거나 69개 총계를 늘리지 않는다.
- `github_repos`는 E의 V12와 기존 `entity.github.GithubRepo`를 그대로 재사용한다.
- B #248의 V20 이후 D의 V21, C #253의 **V22__issues.sql**이 머지됐다. C는 팀 연결 조회를 그대로 재사용한다.
- C의 `db/issue-schema/*.sql`은 V22가 대체한다. 준비 SQL을 다시 실행하지 않는다.
  B/C worker·webhook 플래그의 기본값도 변경하지 않는다.

## 2. C가 재사용할 코드

| 용도 | 위치·호출 |
| --- | --- |
| 팀·현재 멤버·저장소 연결·보드·상태 매핑 Entity | `entity/team/` |
| 설치·PR Entity | `entity/github/GithubInstallation`, `PullRequest` |
| enum | 각 Entity 업무의 `type/` (`TeamStatus`, `TeamRole`, `BoardStatus` 등). 보안 어노테이션 `global.security.TeamRole`과 구분 |
| 팀·설치·보드 연결 조회 | `repository/team/TeamRepository.findConnection(teamId)` |
| 연결된 미삭제 저장소 | `TeamRepository.findLinkedRepos(teamId)` (Linker repo ID 순) |
| 상태 매핑 | `TeamRepository.findBoardStatusMappings(boardId)` (GitHub option ID 순) |
| 현재 멤버 조회 | `TeamMemberRepository.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId)` |
| 기존 팀 역할 검사 | `global.security.TeamAccess` / `@TeamRole`, 기존 인터페이스 유지 |

조회 결과는 `dto/team/response/TeamConnectionView`와 내부 `LinkedRepo`, `StatusMapping`이다.
HTTP API나 공개 DTO 필드를 추가한 것이 아니다. 조회는 권한을 부여하지 않으며 호출자가
기존 회원·팀·저장소 권한 검사를 유지해야 한다.

식별자 주의:

- `findConnection().installationId()`는 **외부 GitHub 설치 ID**다. `GithubInstallation.id`는 내부 PK다.
- `LinkedRepo.repoId`는 내부 PK, `githubRepoId`는 GitHub ID다.
- `boardId`는 내부 PK, `projectNodeId`와 필드·option ID는 GitHub 식별자다.
- 설정 중 보드가 없으면 `findConnection`은 팀과 `boardId=null`을 반환한다.
  보드를 필수로 요구하는 C의 `IssueRepository.context()`에서는 그 조건을 유지해야 한다.
- 삭제된 팀은 연결 조회에서 제외한다. 저장소 조회는 연결이 해제되거나 삭제된 저장소를 제외한다.
- `BoardStatus.NONE`은 이슈에 Status 값이 없다는 뜻이다. 매핑 테이블에는 저장하지 않는다(기존 DB CHECK 유지).
- 설치 토큰 공급은 기존 `GithubAppClient.installationReadToken(externalInstallationId)`를 사용한다.
  토큰을 Entity/DTO에 담거나 DB 트랜잭션 중 외부 HTTP를 호출하지 않는다.

현재 C 조회와 B의 새 JPA 연결 조회를 동일한 실제 스키마 데이터로 대조한다.
C의 이슈 업무 로직·트랜잭션·동기화 락은 이 PR에서 바꾸지 않는다.

## 3. B 전환 범위와 다른 담당 경계

- 기존 `OwnedTeamLookup` 계약은 `OwnedTeamRepository`가 유지한다. 실제 조회는
  `TeamRepositoryCustom` + `TeamRepositoryImpl`의 JPQL이며, 탈퇴 검사 동작은 유지한다.
- B의 `MembershipTeamAccess`는 JPA Repository를 사용하되, 기존 역할·회원 상태·탈퇴 이력 조건은 유지한다.
- `TeamSetupRepository`와 `WorkspaceTeamRepository`의 조회·저장은 `TeamRepositoryCustom` + `TeamRepositoryImpl`으로 통합했다. 이전 클래스는 제거했다.
- `TeamSyncService`의 SQL은 같은 팀 Repository로 옮겼다. 서비스는 역할별 권한·동기화 순서·알림 생성을 계속 담당한다.
- `TeamSetupLock`은 `TeamRepository.withTeamSetupLock` / `withOrganizationSetupLock`으로 옮겼다.
  별도 Hibernate Session이 같은 물리 연결을 유지해 PostgreSQL 세션 락을 잡고, 외부 HTTP 동안 DB 트랜잭션을 열지 않는다.
  짧은 쓰기 트랜잭션은 기존대로 서비스가 열고, 팀/사용자 행 잠금은 JPA `PESSIMISTIC_WRITE`로 처리한다.
- 일반 조회·변경은 JPQL/Entity를 사용한다. `ON CONFLICT`/`RETURNING`, 세션 advisory 락,
  PostgreSQL 메타데이터·기존 Redis 작업 revision 문자열은 이유를 적고 네이티브 쿼리를 유지한다.
- C #253의 `Issue` Entity를 재사용해 워크스페이스 열린 이슈 집계까지 하나의 JPQL로 합쳤다.
  Repository는 팀 수와 무관하게 2쿼리(스키마 확인 1 + 목록 1), 서비스 확인까지 총 3쿼리다.
  #248의 3/4쿼리에서 각각 1개 줄었다. 연결된 미삭제 저장소·OPEN·미삭제 이슈 조건,
  미확인/0건 null 및 이슈 스키마가 없을 때 팀 목록을 유지하는 동작은 같다.
- D의 채팅 조회 JPA 전환 #249를 먼저 병합했다. D의 `TeamChatAccess`는 수정하지 않았다. D와 조회 책임·조건을 맞춘 후 같은 팀 Repository를 활용한다.
  채팅 쓰기 권한과 일반 팀 멤버십 권한을 같다고 가정하지 않는다.
- A의 프로필 서비스/URL은 수정하지 않는다. A는 머지된 팀 Entity를 재사용할 수 있다.
- 기존 테스트에서 가짜 팀 테이블을 만들던 부분과 고아 chat team ID만 실제 V20 픽스처로 바꾼다.
  C/D의 업무 규칙·기대 결과를 완화하지 않는다.

## 4. DB와 로컬 검증 도구

- 새 로컬 DB: Flyway가 현재 마이그레이션 전체를 적용한다(V20 팀·V22 이슈 포함).
- 기존 V19 DB: V20이 팀 테이블·FK를 추가한다. 고아 `chat_rooms.team_id`가 있으면 실패하며,
  행을 삭제하거나 FK를 우회하지 않는다. 기존 데이터를 먼저 검토해야 한다.
- 과거 준비 SQL을 수동 적용한 DB: V20과 테이블이 중복되므로 **자동 적용 대상이 아니다**.
  이 PR은 공유/개인 DB를 수정하거나 baseline/repair로 이력을 덮어쓰지 않는다.
  실제 DB 관리자가 데이터·스키마·이력을 확인해 전환 방법을 정해야 한다.
- `db/team-schema/*.sql`은 역사적 비교용으로 남긴다. V20 이후 재실행하지 않는다.
- 공동 GitHub 검증 도구의 `schema`는 #253 이후 준비 SQL을 적용하지 않고 Flyway 상태(V20·V22 포함)만 확인한다.
  과거 준비 SQL을 수동 적용한 환경은 자동 덮어쓰지 않는다. 기존 환경을 보존하고 별도
  `--state-dir`와 포트의 새 격리 환경을 쓰거나 관리자와 전환을 검토한다.

## 5. #248 검증 기록

- 변경 전 B·C·공통 기반 통합 테스트 192개 통과.
- V19 → V20 업그레이드, 재실행 무변경, 기존 repo/이전 Flyway 이력 보존 확인.
- 고아 채팅 FK 발견 시 V20 원자적 실패와 기존 데이터 보존 확인.
- 새 Entity 7개의 실제 PostgreSQL 매핑, Custom/Impl 실제 연결·호출,
  B/C 연결 식별자·보드 필드·저장소·매핑의 동등성 확인.
- 역할별 멤버십, COMPLETED/READ_ONLY/ARCHIVED/DELETED, 탈퇴 이력 및 계정 상태 회귀 확인.
- 추가 확인: 설정 락의 동시 진입 거절·짧은 커밋 뒤 유지·예외 후 해제·기존 트랜잭션 진입 금지,
  PR 캐시의 오래된 갱신 거절·호출자 롤백, 팀 수 증가 시 목록 쿼리 수 일정.
- 최종 전체 백엔드 테스트 473개, 로컬 도구·PR 규칙 테스트 27개 통과.
- 실제 GitHub 조직/보드 변경, 공유 DB·운영 DB 배포 검증은 이번에 실행하지 않는다.

## 6. #253 연동 리뷰와 웹훅 락 후속 (2026-11-07)

- V22의 팀·저장소 FK는 기존 V20/V12를 참조한다. 기존 V1–V22 이력과 SQL을 수정하지 않는다.
- `IssueRepository.context()`가 `TeamRepository.findConnection/findLinkedRepos/findBoardStatusMappings`를 사용하며,
  외부 설치 ID·내부 repo/board PK·삭제 조건·보드 필수 조건이 기존 계약과 같다.
- B 팀 설정 → C 최초 동기화, 서명된 웹훅 → C 캐시 반영, 연결 변경 시 재검증과 V21→V22 업그레이드를 격리 DB로 확인한다.
- 누락됐던 `GithubWebhookDispatchLock`을 제거하고 `GithubWebhookDeliveryRepositoryCustom` + Impl의
  `withDispatchLock`으로 옮겼다. B 웹훅 서비스가 그 메서드를 사용한다. API·페이로드·큐·재시도 계약은 바꾸지 않는다.
- 기존 음수 bigint 키(-delivery PK)를 유지해 이전 워커와도 동일한 잠금에 참여한다.
  독립 Hibernate Session이 동일 물리 연결을 유지하고, 핸들러/외부 HTTP는 트랜잭션 밖에서 실행한다.
  동일 delivery 경합은 건너뛰고 서로 다른 delivery는 병렬 처리한다.
- 락 획득 결과가 불확실하거나 해제에 실패하면 연결을 폐기한다. 작업이 이미 실패했다면 원래 예외를 유지한다.
- 공통 문서 변경은 `docs/improvements/02-jpa-migration.md`의 누락 항목·이름 정리 개수와 선행 상태 안내다.
  ERD·WBS·청사진·API·스키마는 변경하지 않는다. 저장소 밖 원본에도 이 누락 항목을 반영해야 한다.
- 전체 검사에서 기존 채팅 테스트가 수신자 프레임만 기다리고 송신자·목록 프레임을 즉시 검사하는 경합을 확인했다.
  독립 STOMP 목적지의 도착 순서는 보장되지 않으므로 해당 테스트의 대기 조건만 세 결과로 맞췄다. D main 코드·기대 결과·타임아웃은 바꾸지 않았다.
- 최종 전체 `./gradlew build` 578개, GitHub 도구·PR 규칙 28개 테스트 통과. 실제 GitHub App·공용/운영 DB에는 쓰지 않는다.
