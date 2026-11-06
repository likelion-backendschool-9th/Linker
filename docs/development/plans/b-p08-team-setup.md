# B / 08 팀 생성 백엔드 — 구현과 연결 확인

관련: #80, 선행 #76 / PR #214, C 연결 요청 PR #208.

작업 브랜치 `feat/08-github-app-team-setup`에 최신 dev `a9cc681`을 통합했다. #219의 Flyway·OTP 수정, #220의 mock OTP 복원, #218의 E 공유 테이블, 이후 A/C/D 구현을 보존하고 충돌 5곳을 해결했다.

**현재 범위는 서버 코드·SQL 준비본·격리 자동 검증이다. 정식 마이그레이션 번호·실제 App·웹훅 샘플·브라우저 실연동 완료가 아니다.**

## 공통 변경 범위

- 공통 ERD·WBS·태그 계약·운영 안내와 A/C/D 업무 구현은 최신 dev를 그대로 보존한다. AuthService·FoundationIntegrationTest·WorkspaceTeamIntegrationTest·mock-fetch.ts도 dev와 동일하다.
- TeamAccess SPI의 임시 거절 구현을 DB 멤버십 구현으로 교체한다. 삭제/탈퇴/역할/보관 상태를 검증한다. JWT claim·쿠키·오류 코드·알림 생성 시그니처는 변경하지 않는다.
- PlanLimits에는 기존 Policy의 읽기 전용 30일 보관 값만 추가한다. B worker/webhook 설정만 기본 false로 추가하고 C 플래그는 유지한다.
- 서버 스펙으로 SDK를 재생성한다. 기존 페이지별 SDK와 기존 모델 내보내기는 모두 보존하고 p08·공통 설치 검증 계약을 연결한다. 공용 모델 파일에는 최신 서버 응답 모델도 포함된다.
- 08 테스트는 정식 Flyway V1~V18와 E의 실제 github_repos를 사용한다. 임시 Gradle init script와 복제 저장소 테이블을 제거하고, B/C 준비 SQL만 격리 테스트 DB에 추가한다.
- C의 새 서비스가 구체 GithubIssueClient를 요구하므로 B 테스트의 모의 외부 어댑터도 같은 구체 타입으로 맞췄다. C 제품 코드는 변경하지 않는다.

## API와 권한

기존 p00-common의 install-url/getInstallUrl, installations/verify/verifyInstallation 태그·경로는 유지했다. 설치 검증은 state를 사용자·세션에 묶어 한 번 소비한 뒤 서버 사용자 토큰으로 /user/installations를 확인한다.

- INSTALLED: 검증된 조직·설치 ID. 이 결과만으로 저장하지 않고 POST /teams에서 다시 검증한다.
- REQUESTED_FROM_OWNER: setupAction=request인 경우 App의 실제 대기 요청 중 본인 requester ID를 확인했을 때만 반환한다. URL 값이나 설치 목록에 없다는 이유로 추정하지 않는다. 이 결과로 팀을 만들지 않는다.
- ALREADY_LINKED: 조직에 팀이 이미 존재한다. 본인의 현재 Linker 팀 멤버십이 없으면 teamId를 공개하지 않는다.

신규 p08-team-create API는 WBS의 기존 7개 메서드다. 새 경로를 추가하거나 페이지 09/17 API를 대신 구현하지 않는다.

| 경로 (/api/v1/user 아래) | 동작 |
| --- | --- |
| POST /teams | 사용자 설치 접근 + 현재 App 메타데이터·org membership 재검증, 개인 한도 DB 잠금 검사, 팀·OWNER·TEAM 채팅방·참여자 원자 생성. 재요청은 같은 팀·채팅방 반환 |
| GET/PUT /teams/{teamId}/setup/repos | OWNER. App이 설치되고 본인에게 접근 가능한 해당 조직 저장소만 연결. ID는 GitHub 저장소 ID. 전체 조직 비공개 저장소 수를 알 수 없어 notInstalledCount는 null |
| GET /teams/{teamId}/setup/boards | OWNER/ADMIN. 조직 보드 이름·카드 수·Status 옵션 이름/ID 미리보기 |
| POST /teams/{teamId}/setup/board | OWNER/ADMIN. 새 Linker 보드 또는 기존 보드 ID 검증·매핑, 빠진 날짜 필드 생성, 실제 필드·옵션 ID 저장 |
| GET /teams/{teamId}/setup/permission-check | OWNER. 실제 NONE/READ/WRITE/ADMIN 기본 권한과 GitHub 설정 URL. 없거나 알 수 없는 값을 WRITE로 추측하지 않음 |
| POST /teams/{teamId}/setup/complete | OWNER. 설정 커밋 후 첫 동기화 큐. 재요청은 진행 상태, FAILED에 retry=true면 명시적 재시작. 응답 202 |

MembershipTeamAccess는 DB 현재 소속·역할을 확인한다. OWNER ≥ ADMIN ≥ MEMBER이고 운영자 우회는 없다. 탈퇴·삭제 계정, 탈퇴 멤버, ARCHIVED/DELETED 팀은 팀 리소스 권한이 없다. READ_ONLY는 조회용 멤버십을 유지하며 쓰기는 별도 상태 검사로 차단한다. 보관 팀 목록과 채팅 이력은 기존 B 목록/D 채팅 멤버십 경로를 사용한다.

## 외부 호출·재실행

user.TeamController → user.TeamService → user.TeamSetupService를 사용한다. GitHubTeamClient는 기술 HTTP 어댑터이며 사용자 토큰 복호화·갱신은 A의 GithubUserAccessTokenSource를 재사용한다. 이슈·Projects·PR 설치 읽기 토큰은 기존 GithubAppClient를 그대로 재사용한다. 조직 멤버 조회만 GithubTeamClient에서 members:read 전용 설치 토큰을 발급해 기존 C 토큰의 요청 권한을 넓히지 않는다.

GitHub HTTP 호출은 ambient DB transaction을 거절한다. 설정의 외부 변경은 PostgreSQL session advisory lock으로 직렬화하며 DB 트랜잭션은 짧은 저장·재검증 때만 연다. C 소스의 이슈 저장·동기화·권한 소비 코드는 변경하지 않는다.

개인 한도·기존 팀 OWNER·보관 상태의 판단은 user.TeamSetupService에 두고 저장소는 잠금 조회·저장을 담당한다. 설치 이벤트도 팀 session lock을 얻은 뒤 현재 설치를 조회해 이전 이벤트의 대기 전 조회 결과를 다시 적용하지 않는다.

새 보드는 생성 호출 전 Redis에 결과 불확실 상태를 기록하고, 응답으로 받은 보드 ID를 다음 필드 호출 전에 저장한다. clientMutationId를 멱등 보장으로 간주하지 않는다. 응답 유실 후 NEW를 다시 눌러 새 보드를 만들지 않으며 기존 보드 선택으로 확인·복구한다. 기존 사용자 보드의 옵션 목록을 새 보드 기본값으로 덮어쓰지 않는다. Linker 생성 보드도 연결 후 상태 옵션이나 날짜 필드가 바뀌면 NEW 재시도로 덮어쓰지 않고 409로 기존 보드 재선택을 안내한다. 미매핑 옵션은 OTHER로 저장한다.

## C가 재사용할 연결점

| 요청 | 코드/현재 상태 |
| --- | --- |
| 팀·멤버·저장소 연결 | repository.team.TeamSetupRepository. 팀/멤버 생성과 연결 저장을 담당. C의 기존 IssueContextRepository가 같은 ERD 필드에서 읽음 |
| 보드·상태/날짜 필드 | team_project_boards, board_status_mappings. 실제 GitHub 필드/옵션 ID 저장. C의 기존 context reader로 조회됨 |
| DB TeamAccess | global.security.MembershipTeamAccess. 기존 TeamAccess SPI 구현을 교체해 C requireMember에서도 사용 |
| 설치 토큰 | GithubAppClient.installationReadToken(외부 설치 ID). 내부 github_installations.id와 혼용하지 않음 |
| 최초 이슈 동기화 | user.TeamSetupService.complete의 트랜잭션 반환 후 enqueue → user.TeamSyncService의 worker → C user.IssueSyncService.initialSync(teamId). C 호출을 B DB 트랜잭션으로 감싸지 않음 |
| 첫 PR·조직 멤버 동기화 | 같은 B worker. PR 캐시 upsert, 기존 팀원의 조직 상태 확인. INVITED/NOT_MEMBER를 조직 목록에 없다는 이유로 탈퇴시키지 않음 |
| 웹훅 | 기존 서명 검증·delivery 행 ID 큐·dispatch 재사용. B GithubTeamWebhookHandler는 installation/organization, C 기존 핸들러는 issues/projects_v2_item |

실제 App이 준비되지 않아 실제 수신 샘플은 제공할 수 없다. TeamSetupIntegrationTest의 서명된 합성 payload는 B 생성 데이터·DB TeamAccess → 수신/dispatch → C 캐시 → C 목록 API/B 카드 집계까지 확인하는 근거이며 실제 수신 캡처로 표시하지 않는다.

## 큐·진행 상태와 생명주기

- Redis sorted set과 job hash를 사용한다. QUEUED/RUNNING/COMPLETED/FAILED/STALE, 실패 단계, 기술적 재시도 3회/30초 간격. Redis AOF는 기존 Compose 설정을 재사용한다.
- session lock은 여러 worker의 같은 팀 동시 처리를 막는다. worker가 죽어도 due 항목은 남고 다음 worker가 다시 처리한다. 공급자 호출·저장은 멱등 기준으로 재실행한다.
- 연결 내용과 기존 DB 행의 변경 시각/ID로 job fingerprint를 만든다. 이전 설정의 완료 상태를 새 설정이나 A→B→A 변경에 재사용하지 않는다.
- Redis enqueue 실패 시 완료 성공으로 위장하지 않는다. 설정 데이터는 이미 저장돼 있을 수 있으므로 Redis 복구 후 complete를 재요청한다. 새 DB outbox 테이블을 임의로 추가하지 않았다.
- 설치/조직 이벤트는 현재 GitHub 상태를 재조회한다. 삭제·중지 시 READ_ONLY, 검증된 재설치 시 READ_ONLY→ACTIVE. 교체된 옛 설치의 늦은 삭제 이벤트는 새 연결을 닫지 않는다. ARCHIVED를 자동 복원하지 않는다.
- READ_ONLY가 Policy 30일을 넘으면 기존 archived_at과 함께 ARCHIVED로 전환한다. 조직에서 실제로 제거된 기존 MEMBER는 기간을 닫고 팀 채팅 참여도 종료한다.
- 알림은 기존 user.NotificationService.create만 사용한다. TEAM_APP_REMOVED / TEAM_MEMBER_REMOVED 생산 타입을 사용하며 서명·인자나 D 배달 로직을 변경하지 않는다. D에게 표시/소비 확인이 필요하다.

## SQL 준비 순서와 활성화 조건

#219에서 A/D의 V4 중복을 해결했다. GitHub 로그인은 V4, 채팅 edited_at은 V10이다. E 공유 테이블은 V11~V14로 편입됐으며 최신 공통 Flyway 이력은 V1~V18이다. 이번 작업은 해당 정식 파일이나 checksum을 변경하지 않는다.

B 신규 번호는 아직 확정하지 않는다. 다음 준비본은 자동 적용 경로 밖에 있다.

1. 정식 공통 Flyway V1~V18 적용 (E의 실제 github_repos 포함).
2. 07의 team-foundation.sql (github_installations/teams/team_members, chat_rooms 팀 FK).
3. 07의 team-repositories.sql, 08의 team-setup.sql (보드/매핑/첫 PR 캐시).
4. C의 기존 db/issue-schema/issue-cache.sql.

TEAM_SETUP_WORKER_ENABLED와 TEAM_SETUP_WEBHOOK_ENABLED는 기본 false다. B/C 준비본의 정식 버전 편입·업그레이드·실제 수신 공동 확인 후 활성화한다. 개인 .env나 C의 활성화 설정은 변경하지 않았다.

## 자동 검증 결과 (2026-11-06)

- **일반 ./gradlew build: 430개 전부 통과**, 실패·오류·생략 0. Flyway 비활성화나 임시 Gradle init script 없이 실행했다. B 08 통합 24개와 최신 A/C/D/E 회귀를 포함한다.
- 08은 실제 PostgreSQL 16·Redis 7, 정식 Flyway와 E 실제 테이블을 사용하고 B/C 준비본만 테스트 DB에 추가한다. 이 성공을 B/C SQL의 정식 Flyway 편입 완료로 표시하지 않는다.
- 전체 frontend lint·typecheck·test·프로덕션 빌드 통과. 웹 454개, 브리지 23개, 모바일 33개 및 API 생성 파이프라인을 확인했다.
- Compose 구문·운영 구성 검사 통과. 배포 테스트는 Linux 컨테이너에서 9개 통과했다. git diff --check 통과.
- 실제 테스트 조직/App이 없어 GitHub HTTP는 모의 검증이다. 서명된 합성 웹훅 → 기존 B 수신/dispatch → C 캐시 → C API/B 집계를 검증했다.

외부 API 형식은 [GitHub App REST 문서](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10#list-installation-requests-for-the-authenticated-app)와 [Projects GraphQL 문서](https://docs.github.com/en/graphql/reference/projects)를 함께 확인했다.

## 남은 확인

- B/C 준비 SQL의 정식 Flyway 번호·적용 이력·기존 데이터 업그레이드 확인. 기존 V4 중복과 E 테이블 편입은 이미 dev에서 해결된 상태와 구분한다.
- 실제 테스트 조직·App 준비 후 설치 요청/검증·보드 생성·C와 실제 웹훅 수신/캐시 갱신 샘플 확인.
- 08 프론트 실 API 저장 동선과 실브라우저 왕복은 #79 후속 범위다.
- 기존 보드는 이름이 Status인 SINGLE_SELECT 필드를 기준으로 연결한다. 이름을 바꾼 사용자 정의 필드는 자동 추측하지 않는다.
- D의 팀 채팅·알림 소비, E의 모집 수락/팀·공개 저장소 소비 연결은 각 담당자와 확인한다. A의 실제 OTP 검증 API는 최신 dev 구현을 유지한다.
- 스키마·계약·실수신 확인 전 worker/webhook을 임의 활성화하거나 이슈 전체 완료로 표시하지 않는다.

이번 작업 기록만 갱신하며 기존 공통 ERD·WBS·태그 계약·운영 안내는 최신 dev와 동일하게 유지한다.
