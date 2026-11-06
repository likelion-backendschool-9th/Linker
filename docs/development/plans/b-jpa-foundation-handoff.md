# B → C: 2단계 팀 JPA 선행 기반

기준: `docs/improvements/02-jpa-migration.md`와 2026-11-06 공유 순서(B 팀 기반 → C 이슈 기반).
이 문서는 B 변경 범위와 소비 방법을 기록한다. Policy·ERD·WBS의 정책이나 API를 변경하지 않는다.

## 1. 적용 순서

- B는 **V20__team_foundation.sql 하나만** 사용한다. 기존 V1–V19는 수정하지 않는다.
- V20은 기존 준비 SQL의 7개 테이블과 `chat_rooms.team_id` FK를 정식 편입한다.
  `github_installations`, `teams`, `team_members`, `team_repos`, `team_project_boards`,
  `board_status_mappings`, `pull_requests`다. 설계상 새 테이블을 발명하거나 69개 총계를 늘리지 않는다.
- `github_repos`는 E의 V12와 기존 `entity.github.GithubRepo`를 그대로 재사용한다.
- C는 이 PR이 **dev에 머지된 뒤 최신 dev**에서 이슈 스키마·Entity·쿼리를 전환한다.
  다음 후보 번호는 V21이다. C가 시작할 때 다른 마이그레이션 추가 여부를 다시 확인한다.
- C의 `db/issue-schema/*.sql`은 이번에 정식 편입하지 않는다.
  B/C worker·webhook 플래그의 기본값도 변경하지 않는다.

## 2. C가 재사용할 코드

| 용도 | 위치·호출 |
| --- | --- |
| 팀·현재 멤버·저장소 연결·보드·상태 매핑 Entity | `entity/team/` |
| 설치·PR Entity | `entity/github/GithubInstallation`, `PullRequest` |
| enum | 각 Entity 업무의 `type/` (`TeamStatus`, `TeamMemberRole`, `BoardStatus` 등) |
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
  보드를 필수로 요구하는 C의 기존 `IssueContextRepository.get()`에서는 그 조건을 유지해야 한다.
- 삭제된 팀은 연결 조회에서 제외한다. 저장소 조회는 연결이 해제되거나 삭제된 저장소를 제외한다.
- `BoardStatus.NONE`은 이슈에 Status 값이 없다는 뜻이다. 매핑 테이블에는 저장하지 않는다(기존 DB CHECK 유지).
- 설치 토큰 공급은 기존 `GithubAppClient.installationReadToken(externalInstallationId)`를 사용한다.
  토큰을 Entity/DTO에 담거나 DB 트랜잭션 중 외부 HTTP를 호출하지 않는다.

현재 C 조회와 B의 새 JPA 연결 조회를 동일한 실제 스키마 데이터로 대조한다.
C의 이슈 업무 로직·트랜잭션·동기화 락은 이 PR에서 바꾸지 않는다.

## 3. 이번 PR과 후속 작업의 경계

- 기존 `OwnedTeamLookup` 계약은 `OwnedTeamRepository`가 유지한다. 실제 조회는
  `TeamRepositoryCustom` + `TeamRepositoryImpl`의 JPQL이며, 탈퇴 검사 동작은 유지한다.
- B의 `MembershipTeamAccess`는 JPA Repository를 사용하되, 기존 역할·회원 상태·탈퇴 이력 조건은 유지한다.
- `TeamSetupRepository`, `WorkspaceTeamRepository`, `TeamSyncService`, `TeamSetupLock`의 나머지 전환은 후속 B PR이다.
- D의 `TeamChatAccess`는 수정하지 않았다. D와 조회 책임·조건을 맞춘 후 같은 팀 Repository를 활용한다.
  채팅 쓰기 권한과 일반 팀 멤버십 권한을 같다고 가정하지 않는다.
- A의 프로필 서비스/URL은 수정하지 않는다. A는 머지된 팀 Entity를 재사용할 수 있다.
- 기존 테스트에서 가짜 팀 테이블을 만들던 부분과 고아 chat team ID만 실제 V20 픽스처로 바꾼다.
  C/D의 업무 규칙·기대 결과를 완화하지 않는다.

## 4. DB와 로컬 검증 도구

- 새 로컬 DB: 기존대로 Flyway를 실행하면 V20까지 자동 적용된다.
- 기존 V19 DB: V20이 팀 테이블·FK를 추가한다. 고아 `chat_rooms.team_id`가 있으면 실패하며,
  행을 삭제하거나 FK를 우회하지 않는다. 기존 데이터를 먼저 검토해야 한다.
- 과거 준비 SQL을 수동 적용한 DB: V20과 테이블이 중복되므로 **자동 적용 대상이 아니다**.
  이 PR은 공유/개인 DB를 수정하거나 baseline/repair로 이력을 덮어쓰지 않는다.
  실제 DB 관리자가 데이터·스키마·이력을 확인해 전환 방법을 정해야 한다.
- `db/team-schema/*.sql`은 역사적 비교용으로 남긴다. V20 이후 재실행하지 않는다.
- 공동 GitHub 검증 도구의 `schema`는 이제 정식 V20 기반 위에 **C 준비 SQL 2개만** 적용한다.
  예전 `schema.json`이 있는 환경은 자동 덮어쓰지 않는다. 기존 환경을 보존하고 별도
  `--state-dir`와 포트의 새 격리 환경을 쓰거나, 관리자와 전환을 검토한다.

## 5. 검증 범위

- 변경 전 B·C·공통 기반 통합 테스트 192개 통과.
- V19 → V20 업그레이드, 재실행 무변경, 기존 repo/이전 Flyway 이력 보존 확인.
- 고아 채팅 FK 발견 시 V20 원자적 실패와 기존 데이터 보존 확인.
- 새 Entity 7개의 실제 PostgreSQL 매핑, Custom/Impl 실제 연결·호출,
  B/C 연결 식별자·보드 필드·저장소·매핑의 동등성 확인.
- 역할별 멤버십, COMPLETED/READ_ONLY/ARCHIVED/DELETED, 탈퇴 이력 및 계정 상태 회귀 확인.
- 전체 백엔드 테스트 459개, 로컬 도구·PR 규칙 테스트 27개 통과.
- 실제 GitHub 조직/보드 변경, 공유 DB·운영 DB 배포 검증은 이번에 실행하지 않는다.
