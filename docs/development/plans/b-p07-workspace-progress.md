# B / 07 팀 목록 — 구현과 후속 조율

관련 이슈: [#76](https://github.com/likelion-backendschool-9th/Linker/issues/76).
기준: `dev` `b0c67cb`(채팅 PR #206·#210·#212 및 C 이슈 PR #208 반영).
E 브랜치 `feat/59-e-backend` `86a11a6`, A PR #211·#213은 별도로 대조했으며 미머지 제품 코드를 가져오지 않았다.

**상태: B 조회 API·생성 계약·화면 연결 코드와 SQL 준비본 구현. 정식 Flyway 편입·실제 개발 환경 연결은 미완료이며 이슈 전체 완료가 아니다.**

## 구현한 범위

- `GET /api/v1/user/me/teams`, method tag `p07-workspace`, operationId `getMyTeams`.
- `controller.user.UserTeamController` → `service.user.UserTeamService` → `repository.team.WorkspaceTeamRepository`.
- A의 쿠키 인증·DB 재검증·정지 읽기 허용과 `@DeveloperOnly`를 재사용한다. 운영자도 본인 소속만 조회한다.
- `team_members.left_at IS NULL`, 팀 `status <> DELETED`. 현재 인원은 현재 소속 행 수로 집계한다.
- ACTIVE·COMPLETED·READ_ONLY는 개인 참여 수에 포함, ARCHIVED는 목록에 남기되 한도에서 제외한다. 한도는 Policy ch.6의 10을 `PlanLimits.TEAMS_PER_USER_MAX`로 참조한다. 한도 도달·초과도 GET을 막지 않는다.
- 보관이 아닌 팀을 우선해 `joinedAt DESC`, 동률은 팀 ID DESC로 정렬한다. 같은 팀의 탈퇴·재가입 이력을 지우지 않는다.
- 실제 TEAM 채팅방과 현재·비숨김 채팅방 참여가 있을 때만 chatRoomId와 unreadCount를 반환한다. 없는 채팅방 ID를 만들지 않는다.
- 미읽음은 D의 `ChatListQueryRepository` 계약과 같다. 본인의 읽음 포인터 이후 메시지에서 본인 발신만 제외한다. 시스템 메시지·삭제/숨김 자리표시 메시지도 포함하며 팀 채팅에는 1:1 차단 필터를 적용하지 않는다. D의 목록과 동일하게 60일 제한을 임의로 추가하지 않고, 음소거도 읽음으로 취급하지 않는다.
- 열린 이슈 수는 C #208의 조회 범위(현재 연결 저장소·삭제되지 않은 저장소/이슈·state=OPEN)를 재사용하는 B 조회 투영이다. 보드 상태 DONE을 GitHub CLOSED로 치환하지 않는다. C의 생성/동기화/필터 서비스는 수정하지 않았다.
- 응답은 `Cache-Control: no-store`. 팀 전환 저장 API·GitHub 호출·팀 생성·알림 생산·C의 내 이슈 API를 추가하지 않는다.

## 응답과 아직 연결되지 않은 필드

`{items, teamLimit, teamCount, nextCursor:null}`. 개인 소속 전체 목록이며 화면 필터는 기존 방식대로 적용한다.
teamCount는 반환 페이지 길이가 아니라 보관을 제외한 실제 소속 수다. 페이지/커서 query를 새로 만들지 않았다.

items는 `id, name, orgAvatarUrl, status, myRole, memberCount, joinedAt, chatRoomId, plan, openIssueCount, unreadCount`다.

| 필드 | 현재 계약 |
| --- | --- |
| orgAvatarUrl | ERD teams.avatar_url. 없으면 null |
| joinedAt | 본인의 현재 team_members.joined_at. C 기본 팀 선택에 재사용 가능 |
| chatRoomId | 실제 TEAM 채팅방·본인 현재 비숨김 참여가 없으면 null |
| plan | D 구독 조회 미연결. **항상 null이며 FREE로 판단하면 안 됨** |
| openIssueCount | C 캐시·저장소 연결이 존재하면 캐시상 양수 집계. 캐시 미준비 또는 캐시 0건이면 null. C의 초기 전체 동기화 완료 표식 계약을 확인한 뒤 실제 0개 표시를 연결해야 함 |
| unreadCount | 연결된 TEAM 방이면 실제 미읽음 수(0 포함). 방/현재 비숨김 참여가 없으면 null |

Orval 생성물은 실제 테스트 서버의 OpenAPI에서 생성한다. 필수 필드와 nullable을 명시했고, 화면의 `MyTeam`은 생성된 `TeamItem`의 별칭이다.
`myTeamsOptions`는 생성된 query options·공통 apiFetch를 사용하며 기존 `['teams','mine']` 키를 유지한다. 서버 요청은 `cache:no-store`다.
워크스페이스·팀 전환·TeamFrame은 없는 아바타에 아이콘을 쓰고, 미확인 구독을 Free로 표시하거나 미확인 이슈 수를 0으로 표시하지 않는다.
보관 팀은 실제 채팅방이 있을 때만 채팅 이력으로 이동하며, 채팅 연결이 없으면 항목을 유지하되 잘못된 `/chats/null` 링크를 만들지 않는다.
일반 팀은 채팅 연결이 없어도 이슈 화면으로 이동한다. 참여 한도는 서버의 teamCount·teamLimit로 판정하고, C 진입 링크는 URL의 teamId를 유지한다.
mock 모드는 유지하되 07 팀 목록 응답의 joinedAt·nextCursor·보관 제외 teamCount를 서버 계약에 맞췄다. C의 내 이슈 API·화면 구현은 건드리지 않았다.
공통 `p00-common` 태그·기존 API 경로는 유지한다.

## A·D·E와 꼭 맞출 것 — 다음 구현 전 리마인드

1. **이 브랜치의 자동 실행 버전은 V1–V10이다.** V4는 머지된 GitHub 로그인(#211)이고, 채팅 `edited_at`은 V10이다. `origin/dev` `2251a9f`에는 채팅 V4와 로그인 V4가 같이 있어 Flyway가 기동하지 못한다. E `feat/59-e-backend`는 미머지이며 V2–V5가 이 번호와 겹친다. 적용 이력은 비밀값 없이 확인한다.
2. 그 결과에 맞춰 A·E의 번호 충돌 해소와 B의 **정식 마이그레이션 번호·머지 순서**를 함께 확정한다. B가 V5를 임의로 선점하지 않는다. 파일명만 다르고 버전이 같은 경우도 충돌이다. 이미 적용된 마이그레이션은 임의 수정·재번호/삭제하지 않으며, 적용 이력에 맞는 팀 합의를 먼저 한다.
3. B의 공유 `teams`, `team_members`, `github_installations` 및 08 팀 채팅 관계는 ERD를 따른다. E의 모집용 테이블을 복사하거나 팀·멤버 테이블을 따로 만들지 않는다.
4. E의 `recruit_posts.team_id`와 dev의 `chat_rooms.team_id`는 현재 FK가 없다. B SQL 준비본에는 chat_rooms의 team FK를 포함했으므로, 정식 편입 전 기존 연결되지 않은 team_id가 있는지 D와 확인한다. 데이터를 임의 삭제하지 않는다. E 모집 FK의 추가 시점과 OWNER/ADMIN 팀 선택 규칙은 E와 맞춘다. B의 전체 소속 목록을 모집글 작성 권한으로 그대로 간주하면 안 된다. D의 채팅 제목·팀 전송 권한 연결은 D 범위이며 이번 조회 보완에서 수정하지 않았다.
5. **공유 github_repos의 생성 주체도 E와 맞춘다.** E의 `V3__post_editor.sql`이 이미 테이블을 정의하므로 B가 중복 생성하지 않는다. B의 `team-repositories.sql`은 그 테이블 뒤에 연결되는 team_repos만 정의한다. C issue-cache.sql은 teams와 github_repos가 먼저 필요하다.

| 확인한 브랜치/PR | 마이그레이션 현황 | 이번 처리 |
| --- | --- | --- |
| 이 브랜치 #219 | V1–V9 유지. V4는 github_social_login. 채팅 edited_at은 V10 | 채팅 스크립트 번호만 이동. SQL 내용은 수정하지 않음 |
| E feat/59-e-backend | V2 recruit_list, V3 post_editor, V4 post_detail, V5 feed | 미머지. 현재 V2–V5와 번호 조율 필요 |
| A #211 | V4 github_social_login | dev에 머지됨. 이 브랜치의 V4 |
| A #213 | V5 user_agreements, V6 onboarding_profile | dev에 머지됨 |
| C #208 | issue-cache.sql 준비본, 정식 Flyway 미편입 | dev에 머지. 이슈 캐시 조회 투영과 생성 API를 함께 반영. 07 내 이슈 API 구현 완료로 간주하지 않음 |

GitHub의 텍스트 병합 가능 여부만으로 Flyway 충돌을 검출할 수는 없다. 위 현황은 확인 시점의 기록이며 후속 PR 머지 직전에 다시 확인한다.

### 마이그레이션을 기다리는 동안 검증한 방법

[B SQL 준비본](../../../backend/src/main/resources/db/team-schema/team-foundation.sql)은 ERD의 github_installations·teams·team_members와 chat_rooms의 팀 FK를 정의한다.
[저장소 연결 준비본](../../../backend/src/main/resources/db/team-schema/team-repositories.sql)은 E가 먼저 정의한 공유 github_repos가 존재한 뒤 적용할 team_repos와 FK·중복 제약을 정의한다. github_repos를 복제 생성하지 않는다.
Flyway가 자동 검색하는 `db/migration` 밖에 두었으며, 통합 테스트의 격리 DB에서 이 브랜치의 V1–V10 이후에만 실행한다.
채팅 테이블은 **Flyway V2·V3·V10**을 사용한다. D 테이블·엔티티·서비스를 복제하지 않는다.
V1 웹훅 delivery의 installation_id는 외부 GitHub 설치 ID라는 기존 계약을 유지하며, 이번 내부 설치 테이블 FK로 임의 변경하지 않는다.
정식 번호·적용 순서를 확정하면 준비본을 검토해 main migration으로 편입하고, 테스트도 별도 ResourceDatabasePopulator 없이 정식 Flyway만으로 준비되도록 바꿔야 한다.
이 파일을 개발/공용 DB에 수동 적용하는 방식으로 우회하지 않는다.

추가 이슈 집계 테스트는 E 저장소 테이블의 최소 읽기 투영을 테스트 리소스에만 두고, B의 실제 준비본과 C의 실제 `db/issue-schema/issue-cache.sql`을 사용한다. E의 전체 마이그레이션과 합친 운영 검증으로 간주하지 않는다.

### C에 확인할 것 — 이슈가 0개인 경우의 준비 상태

현재 C는 전체 갱신 성공 시 내부 Redis 키에 마지막 성공 시각을 저장하지만, DB의 빈 캐시와 최초 미동기화를 구분하는 공개 소비 계약은 없다.
B는 C 서비스의 private Redis 키를 직접 참조하거나 새 컬럼·이벤트를 임의로 만들지 않는다. 따라서 양수 캐시 수만 제공하고 0건은 아직 null로 둔다.
초기 전체 동기화 완료(성공한 빈 저장소 포함)와 연결 저장소 변경 후 무효화를 어떤 계약으로 확인할지 C와 맞춘 뒤, 실제 0을 제공해야 한다.
C의 ISSUE_SYNC_ENABLED·ISSUE_WEBHOOK_ENABLED 기본 비활성은 유지한다. 이번 조회 연결만으로 활성화하지 않는다.

main Flyway에는 아직 팀 테이블이 없으므로 해당 환경에서 호출 시 `503 SERVICE_UNAVAILABLE`로 준비 상태를 알린다.
이를 빈 목록 성공이나 배포 완료로 오인하지 않는다. 정식 마이그레이션 편입·연결 확인 전까지 배포 완료 대상으로 삼지 않는다.

## 검증 및 다음 단계

`WorkspaceTeamIntegrationTest`는 격리 PostgreSQL·Redis 및 서버 발급 JWT 세션으로 아래를 검증한다.

- 본인 소속·역할·상태별 목록, 탈퇴·삭제·다른 사용자 팀 제외, 인원·한도·가입 시각·정렬.
- 비로그인/리크루터 거절, 운영자 권한의 팀 접근 우회 금지, 정지 계정 GET 허용.
- 빈 목록, 10/11개 소속의 읽기 허용, 보관 제외 한도, 탈퇴 이력·재가입 및 현재 소속 중복 제약.
- 실제 채팅방 참여·숨김/탈퇴에 따른 바로가기와 미읽음, 미연결 데이터의 null, 팀 스키마 미반영 시 503.
- D의 실제 채팅 목록·미읽음 요약과 B 팀별 집계의 일치, D의 읽음 API 후 해당 팀만 갱신되는지 검증한다.
- p07 OpenAPI와 기존 p00 태그 유지 및 nullable 계약.
- 준비본의 팀 FK가 기존 채팅 테이블에 연결되고, 존재하지 않는 팀 참조가 거절되는지 검증한다.
- 실제 C 캐시 SQL과 B team_repos 준비본으로 양수 집계·다른 팀 제외·삭제/연결 해제 저장소 제외·GitHub OPEN 기준·빈 캐시/테이블 미준비의 null을 검증한다.

남은 단계는 **A·D·E 마이그레이션 조율 → 준비본 정식 Flyway 편입·검증 → 실제 개발 환경의 화면·API 왕복 확인 → C 이슈·D 구독 데이터 후속 연결 → #76 완료 확인**이다.
신규 서버·업체·공통 에러 코드·GitHub 권한을 이번 변경에서 정하지 않는다. 문서의 조율 결과는 저장소 밖 원본에도 반영한다.

### 최신 dev 반영 후 검증 (2026-11-05)

- #208 반영 후 `./gradlew build`: 전체 218개 테스트 통과(실패·오류·생략 0). 이 중 팀 목록 통합 테스트 17개.
- 실제 Springdoc 출력의 p00-common·p07-workspace·p11-issue-list와 참조 스키마만 추려 Orval 재생성. B/C 생성 파일 3개의 충돌을 해결했고, C의 p11 생성 파일은 기존 포맷으로 정리한 뒤 dev와 동일함을 확인했다. D의 생성 클라이언트를 이번 B 변경에 임의 추가하지 않았다.
- API 패키지 타입 검사·생성 파이프라인 검사, 웹 타입 검사 통과.
- 직전 B 화면 구현 단계에서 웹 전체 Vitest 448개 통과. #208 반영 후 관련 화면 15개를 재실행해 통과했으며 null·보관·실제 0개·서버 한도·C 진입 teamId·TeamFrame 바로가기를 포함한다.
- 직전 B 화면 구현 단계에서 Playwright B 협업·팀 전환 11개 통과. 목업 모드에서 실제 브라우저로 09·11~15의 공통 TeamFrame, 시트 열기/닫기·현재 팀 선택·다른 팀 왕복·키보드 포커스·360/1440px axe를 검증했다. 이번 #208 반영에서는 화면 로직을 추가 변경하지 않아 재실행하지 않았다. Spring과 브라우저를 한 서버 환경으로 묶은 실연동 검증과는 구분한다.
- 변경한 프론트 소스 ESLint 통과.
- 웹 프로덕션 빌드 통과. 생성 클라이언트의 서버/클라이언트 번들 연결을 확인했고, 프로덕션 server/static JS에서 `MOCK_NOT_IMPLEMENTED`가 발견되지 않았다.
- Git fast-forward 반영으로 현재 dev와 병합 충돌 없음. 미머지 A·E 마이그레이션까지 안전하다는 뜻은 아니다.
- 개인/공용 개발 DB에 준비본·마이그레이션을 적용하지 않았고, 실제 GitHub App 호출·실제 개발 환경의 DB→화면 실연동은 검증하지 않았다.

### 생성 재현

팀 목록 통합 테스트가 `backend/build/workspace-openapi.json`을 생성한다. 루트에서 아래처럼 B/C 태그를 함께 추린 뒤 그 출력 파일의 절대경로를 OPENAPI_URL로 지정해 기존 API 생성 명령을 실행한다.

```bash
python3 scripts/scope_openapi.py --input backend/build/workspace-openapi.json --output backend/build/workspace-client-openapi.json --tags p00-common p07-workspace p11-issue-list
```

Orval의 clean 옵션이 있으므로 p11 태그를 빼서 C 생성물을 지우지 않는다. p11 생성 파일은 저장소의 기존 Prettier 형식으로 정리해 불필요한 diff를 남기지 않는다.
