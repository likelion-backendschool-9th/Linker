# B / 08 팀 생성 백엔드 — 구현과 연결 확인

관련: #80, 선행 #76 / PR #214, C 연결 요청 PR #208.

작업 브랜치 `feat/08-github-app-team-setup`에 최신 dev `2251a9f`를 통합했다. 본인의 #214와 A의 #213·#215·#216 머지를 반영했으며, 기존 07 동작과 A가 추가한 정책 상수를 보존했다. 07 의존성은 이제 dev에 머지된 상태다.

**현재 범위는 서버 코드·SQL 준비본·격리 자동 검증이다. 정식 마이그레이션 번호·실제 App·웹훅 샘플·브라우저 실연동 완료가 아니다.**

## 공통 변경 범위

- 기존 공통 ERD·WBS·태그 계약·운영 안내, C/D 업무 코드는 유지한다. 사용자 추가 요청으로 A의 PublicAuthService에서는 기존 정책대로 세션 OTP 이력이 있어야 운영자 API 권한을 부여하도록 보완했다. JWT claim·쿠키·오류 코드·알림 생성 시그니처·C 동기화 플래그는 유지한다.
- TeamAccess의 기존 인터페이스를 유지하면서 항상 거절하던 임시 구현을 DB 멤버십 구현으로 교체한다. 이는 C가 요청한 실제 권한 연결이며, 삭제/탈퇴/역할/보관 상태를 함께 검증한다.
- PlanLimits에는 이미 Policy에 있는 읽기 전용 30일 보관 값만 추가한다. 기존 한도나 A/D 상수는 바꾸지 않는다.
- B worker/webhook 설정만 기본 false로 추가한다. 공용 생성 SDK는 서버 스펙으로 재생성하며 p07·p11 생성 파일은 dev와 동일하다.
- 최신 #216에서 삭제된 변수 adminOtpLastActiveAt의 남은 초기화 한 줄이 타입 검사를 막아 그 참조만 제거했다. 서버 OTP 판정 보완은 별도이며 mock의 권한 규칙을 새로 정하지 않았다.
- 07 테스트는 마이그레이션이 항상 4개라는 가정 대신 준비 SQL 적용 전후의 실제 이력이 동일한지 비교한다. 정식 버전을 임의 확정하지 않는다.

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

UserTeamController → UserTeamService → UserTeamSetupService를 사용한다. GitHubTeamClient는 기술 HTTP 어댑터이며 사용자 토큰 복호화·갱신은 A의 GithubUserAccessTokenSource를 재사용한다. 이슈·Projects·PR 설치 읽기 토큰은 기존 GithubAppClient를 그대로 재사용한다. 조직 멤버 조회만 GithubTeamClient에서 members:read 전용 설치 토큰을 발급해 기존 C 토큰의 요청 권한을 넓히지 않는다.

GitHub HTTP 호출은 ambient DB transaction을 거절한다. 설정의 외부 변경은 PostgreSQL session advisory lock으로 직렬화하며 DB 트랜잭션은 짧은 저장·재검증 때만 연다. C 소스의 이슈 저장·동기화·권한 소비 코드는 변경하지 않는다.

개인 한도·기존 팀 OWNER·보관 상태의 판단은 UserTeamSetupService에 두고 저장소는 잠금 조회·저장을 담당한다. 설치 이벤트도 팀 session lock을 얻은 뒤 현재 설치를 조회해 이전 이벤트의 대기 전 조회 결과를 다시 적용하지 않는다.

새 보드는 생성 호출 전 Redis에 결과 불확실 상태를 기록하고, 응답으로 받은 보드 ID를 다음 필드 호출 전에 저장한다. clientMutationId를 멱등 보장으로 간주하지 않는다. 응답 유실 후 NEW를 다시 눌러 새 보드를 만들지 않으며 기존 보드 선택으로 확인·복구한다. 기존 사용자 보드의 옵션 목록을 새 보드 기본값으로 덮어쓰지 않는다. Linker 생성 보드도 연결 후 상태 옵션이나 날짜 필드가 바뀌면 NEW 재시도로 덮어쓰지 않고 409로 기존 보드 재선택을 안내한다. 미매핑 옵션은 OTHER로 저장한다.

## C가 재사용할 연결점

| 요청 | 코드/현재 상태 |
| --- | --- |
| 팀·멤버·저장소 연결 | repository.team.TeamSetupRepository. 팀/멤버 생성과 연결 저장을 담당. C의 기존 IssueContextRepository가 같은 ERD 필드에서 읽음 |
| 보드·상태/날짜 필드 | team_project_boards, board_status_mappings. 실제 GitHub 필드/옵션 ID 저장. C의 기존 context reader로 조회됨 |
| DB TeamAccess | global.security.MembershipTeamAccess. 기존 TeamAccess SPI 구현을 교체해 C requireMember에서도 사용 |
| 설치 토큰 | GithubAppClient.installationReadToken(외부 설치 ID). 내부 github_installations.id와 혼용하지 않음 |
| 최초 이슈 동기화 | UserTeamSetupService.complete의 트랜잭션 반환 후 enqueue → UserTeamSyncService의 worker → C UserIssueSyncService.initialSync(teamId). C 호출을 B DB 트랜잭션으로 감싸지 않음 |
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
- 알림은 기존 UserNotificationService.create만 사용한다. TEAM_APP_REMOVED / TEAM_MEMBER_REMOVED 생산 타입을 사용하며 서명·인자나 D 배달 로직을 변경하지 않는다. D에게 표시/소비 확인이 필요하다.

## SQL 준비 순서와 활성화 조건

사용자 확인: **마이그레이션 번호 합의는 아직 없다. 코드와 준비본만 진행한다.**

현재 dev에는 V4__chat_message_edited_at.sql과 V4__github_social_login.sql이 중복돼 있다. 수정·재번호·기존 checksum 변경을 하지 않았다. B 신규 버전 파일도 추가하지 않았다.

A의 V5~V9도 현재 dev에 들어왔다. E `feat/59-e-backend`의 V2~V5는 아직 dev에 없으며 D/A 번호와 겹친다. E는 공유 github_repos를 V3__post_editor.sql에 정의한다. 향후 합칠 때 버전·실제 적용 이력을 A/D/E와 함께 확인해야 하며, B 번호를 선점하지 않는다.

준비본의 의존 순서는 다음과 같다. 정식 번호와 실제 적용 이력을 확인한 뒤 편입해야 하며, 개발/공용 DB에 수동 실행하라는 안내가 아니다.

1. 현재 공통/인증/채팅의 정식 이력 충돌 해결.
2. 07의 team-foundation.sql (github_installations/teams/team_members, chat_rooms 팀 FK).
3. E가 먼저 정의한 공유 github_repos. B가 제품 테이블을 복제 생성하지 않음.
4. 07의 team-repositories.sql, 08의 team-setup.sql (보드/매핑/첫 PR 동기화용 캐시).
5. C의 기존 db/issue-schema/issue-cache.sql.

TEAM_SETUP_WORKER_ENABLED, TEAM_SETUP_WEBHOOK_ENABLED는 기본 false다. 준비본 정식 편입·C 계약/실수신 확인 후 활성화한다. C의 ISSUE_SYNC_ENABLED/ISSUE_WEBHOOK_ENABLED와 기존 배포 전달 설정은 변경하지 않았다. 개인 .env 파일을 변경하거나 키를 작성하지 않았다.

격리 통합 테스트는 Flyway를 테스트에서만 끄고 실제 원본 SQL들을 명시한 순서로 초기화한다. 중복 버전 문제를 해결했다거나 정식 Flyway upgrade 검증을 통과했다고 간주하지 않는다.

## 자동 검증 결과 (2026-11-06)

- TeamSetupIntegrationTest 24개 + GithubTeamClientTest 6개 + 기존 UserGithubServiceTest 3개/GithubAppClientTest 7개: 총 40개 통과. 격리 PostgreSQL 16·Redis 7과 로컬 모의 GitHub 서버를 사용했다. 최신 A의 실제 소유 팀 조회·오너 탈퇴 거절·탈퇴 후 팀 접근 거절도 포함한다.
- 팀·OWNER·채팅방 원자 생성, 다른 조직 동시 생성 시 개인 한도, 역할 거절, 불확실 보드 생성 재시도, 연결한 보드 옵션 보호, 첫 동기화와 실패 재시작, 조직 멤버 제거·재설치·30일 보관을 확인했다.
- 서명된 합성 웹훅 → 기존 B 수신/dispatch → C 캐시 → 이슈 목록/워크스페이스 집계 검증을 포함한다.
- backend bootJar, 전체 frontend typecheck·test·프로덕션 빌드, Compose 설정/운영 구성 검증, git diff --check 통과. 웹 테스트 449개 통과, 공용 mock 한 줄 수정 후 관련 11개 재실행 통과. 전체 lint는 오류 0개이며 기존 미사용 인자 경고 4개가 있다.
- 기본 ./gradlew build는 259개 중 100개 실패했다. 9개 Spring 테스트 컨텍스트가 모두 중복 V4에서 초기화에 실패했고, 이후 테스트도 같은 컨텍스트 실패로 중단됐다. 기존 중복 V4와 준비본 편입은 미해결이다.
- 별도의 임시 Gradle init script를 사용해 테스트 프로세스에서만 Flyway를 끄고 원본 V1~V9 SQL을 명시한 순서로 초기화하여 회귀 결과를 분리했다. 임시 스크립트는 저장소/CI/운영 설정에 포함하지 않으며, 정식 Flyway upgrade 통과로 간주하지 않는다.
- OTP 보완 후 이 보조 실행은 286개 전부 통과했다. B 07 통합 17개·08 관련 40개·C 이슈 통합 27개를 포함한다. 운영자 API는 OTP 전 403, 검증한 세션만 200, 다른 세션·권한 회수 후 403, 30분 초과 비활성 시 세션 만료를 확인했다. 정식 Flyway를 사용하는 기본 빌드의 V4 중복은 별개로 남아 있다.

외부 API 형식은 [GitHub App REST 문서](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10#list-installation-requests-for-the-authenticated-app)와 [Projects GraphQL 문서](https://docs.github.com/en/graphql/reference/projects)를 함께 확인했다.

## 남은 확인

- A/D/E 적용 이력·번호·머지 순서 합의 후 준비본 정식 Flyway 편입·업그레이드 검증.
- 서버의 기존 세션 OTP 확인 경계는 복원했다. 실제 OTP 입력·검증 HTTP API/화면은 아직 없으므로 A가 연결해야 하며, 이 작업에서는 새 인증 API를 추가하지 않는다.
- E 최신 cf7c122는 dev를 통합해 이전 User.java 충돌을 정리했다. 해당 파일이 최신 dev와 동일함을 확인했다. E의 V2~V5 마이그레이션 번호 충돌과 정식 통합은 여전히 조율해야 한다.
- 실제 테스트 조직·App 준비 후 설치 요청/검증, 보드 생성, C와 실제 웹훅 수신·캐시 갱신 샘플 확인.
- 08 프론트는 기존 미리보기 상태이며 실 API 저장 동선 연결·실브라우저 왕복은 #79 후속 범위다.
- 기존 보드는 이름이 Status인 SINGLE_SELECT 필드를 기준으로 연결한다. 이름을 바꾼 사용자 정의 상태 필드는 별도 선택 UI/API 계약 없이 자동 추측하지 않는다.
- D 채팅의 팀 전송/제목 등 기존 보류 연결과 새 알림 타입 소비 확인. 이 PR에서 D 업무 코드를 임의 변경하지 않음.
- C/D 및 GitHub App 권한 확인 전 동기화·웹훅 플래그를 임의 활성화하지 않음. 이슈 전체 완료/실서비스 검증 완료 표시는 하지 않음.

이번 작업의 구현 상태·검증 결과·미합의 사항은 이 작업 기록에서 관리한다. 기존 공통 ERD·WBS·태그 계약·운영 안내는 변경하지 않는다.
