# C · 12 이슈 상세·수정 API 구현

## 범위와 기준

- 작업 브랜치: `feat/12-page-api`, 관련 이슈: [#88](https://github.com/likelion-backendschool-9th/Linker/issues/88).
- [WBS P12·S08](../02-wbs.md), [Policy 7장](../../planning/04-policy.md), [ERD 이슈 표](../01-erd.md)의 기존 API 8개를 구현한다. 13–15, 채팅 전송, B의 팀 생성, A의 토큰 저장, D의 구독 기능은 추가하지 않는다.
- 11번은 #208로 dev에 병합된 C 구현을 재사용한다. 11번의 실제 A/B/D 연결 완료를 의미하지 않는다.
- Java 패키지는 화면 번호로 나누지 않는다. `UserIssueController → UserIssueService → UserIssueDetailService`의 같은 접근 그룹을 유지하고 `UserIssueAccess`로 11·12의 팀원 검사를 재사용한다.

## API와 동작

공통 경로: `/api/v1/user/teams/{teamId}/issues/{issueId}`. `issueId`는 **Linker DB의 내부 ID**이며 GitHub 이슈 번호가 아니다.

| 메서드·뒤 경로 | 동작 |
| --- | --- |
| GET (기본 경로) | Markdown 본문, 담당자·라벨·일정·상태, 쓰기 가능 여부·이유, 동기화 실패, 삭제·이동 상태, 하위 이슈 진행 수 |
| GET `/assignee-candidates` | 활동 중인 팀원·조직 초대 수락(`MEMBER`)·해당 저장소 읽기 권한을 모두 확인한 후보와 최대 10명 |
| PUT `/assignees` | `{userIds}`. 후보·중복·최대 인원 확인, GitHub PATCH 응답 및 재조회 결과 확인, 새 담당자 알림 |
| GET `/label-options` | 실제 저장소 라벨을 페이지 끝까지 조회 |
| PUT `/labels` | `{labels}`. 실제 선택지에 있는 이름만 반영·재확인. 빈 배열은 해제 |
| PUT `/schedule` | `{startDate,dueDate}`. 시작≤마감, 두 값을 함께 교체, null은 해당 필드 해제. 과거 날짜 자체는 거부하지 않음 |
| PUT `/status` | `{status}`. TODO/IN_PROGRESS/BLOCKED/DONE만 허용. 저장된 옵션 ID로 Projects 반영 후 Done은 close, 그 외는 reopen |
| GET `/sub-issues` | GitHub 하위 이슈 읽기 전용. 팀에 연결되지 않은 저장소의 제목·URL은 반환하지 않음 |

조회·변경 응답은 `Cache-Control: no-store`이다. 12번 OpenAPI 메서드 태그는 `p12-issue-detail`이며 기존 `p00-common`·`p11-issue-list`는 유지한다.

Markdown은 CommonMark AST에서 원시 HTML을 텍스트로 이스케이프하고 위험 URL을 제거한 **Markdown 문자열**로 반환한다. 프론트는 기존 `rehype-sanitize` 렌더링을 계속 사용해야 한다. 원문을 HTML로 직접 삽입하지 않는다. GitHub `created_at`을 생성 시각으로 사용한다.

삭제/이동 확인은 원래 저장소 ID·접근을 확인한 뒤 수행한다. GitHub 리다이렉트는 자동 추적하지 않는다. 이동 목적지가 안전하게 연결된 내부 ID로 확인되지 않았을 때 `movedToIssueId`는 null이다. 다른 저장소의 비공개 정보를 추정해서 노출하지 않는다. 구체적인 이동 목적지 캐시 연결은 실제 B 연결 후 확인 대상이다.

## 권한·원본 확인

1. 로그인한 개발자·현재 팀원인지 검사한다. 다른 팀의 내부 이슈 ID는 404다.
2. 변경은 현재 DB 계정 ACTIVE·개발자, 쓰기 가능한 팀, 연결된 저장소·이슈, 실제 GitHub 사용자 쓰기 권한이 필요하다.
3. 담당자 후보에는 저장소 **읽기** 권한도 허용한다. 변경을 수행하는 사용자는 **쓰기** 권한이 필요하다.
4. GitHub에 호출하는 동안 DB 트랜잭션을 열어 두지 않는다. 기존 PostgreSQL 팀 advisory lock을 원본 조회부터 캐시 커밋까지 잡아 11번 수동·웹훅·주기 갱신과 직렬화한다.
5. GitHub 응답의 이슈 ID·node ID, 실제 변경 값, 후속 REST·Projects 재조회를 확인한다. 오래된 REST 응답으로 최신 캐시를 덮거나 작업을 완료하지 않는다.
6. 캐시 커밋 직전에 팀 연결·팀원·현재 계정 상태를 다시 확인한다. 보관된 Projects 항목의 미정 정책을 임의로 정하지 않는다.

## 실패·재시도·알림

- 외부 쓰기 **전에** `issue_sync_jobs`에 사용자 ID와 변경할 값·팀/저장소/보드 연결 식별자만 저장한다. 토큰·비밀번호·외부 오류 본문은 저장하지 않는다.
- C12가 생성하는 작업은 `SET_ASSIGNEES`, `SET_LABELS`, `SET_START`(시작·마감 전체 목표 값), `SET_STATUS`(보드 상태·open/closed 전체 목표 값)다. 목표 상태를 재적용하는 멱등 재시도이며 중간 외부 호출 성공을 DB 롤백으로 취소했다고 간주하지 않는다.
- 기존 ERD의 재시도 step 목록에 담당자·라벨 2개를 추가했다. 기존 69개 테이블·205개 API 계획 수는 바뀌지 않는다. 저장소 밖 ERD 원본에도 같은 enum/설명을 반영해야 한다.
- 일시 장애·최신 결과 확인 지연은 운영 보호값으로 **최초 호출 포함 최대 3회**, 60초 간격으로 재시도한다. 상품 정책 수치가 아니다. 권한·입력·연결 충돌 등 4xx는 자동 재시도를 중단한다.
- RUNNING의 60초 lease와 팀 잠금을 함께 사용한다. 프로세스 중단 후 만료 작업을 다시 처리하며, 잠금 획득 후 lease를 재확인한다. 해당 이슈에 진행 중인 요청이 있으면 새로운 변경은 409로 막아 이전 요청이 나중 변경을 덮지 않게 한다.
- 실패 응답 `detail`에는 `jobId`, `syncStatus=FAILED`, `retryScheduled`를 포함한다. 11번 일반 재조회도 미해결 실패 표시를 지우지 않는다.
- 재시도마다 현재 요청자 계정·팀원·GitHub 쓰기 권한·후보/라벨·연결 식별자를 재검사한다. 다른 보드로 연결이 바뀐 요청은 재사용하지 않는다.
- 실제 담당자 반영 확인 후 `UserNotificationService.create(CreateNotificationCommand)`를 사용한다. 기존 담당자는 알리지 않고 자기 자신에게도 보내지 않는다. 요청 전 담당자 ID를 payload에 보관해 쓰기 후 재조회 실패·웹훅 경합에도 새 담당자를 판별한다. 캐시·알림 생성·job DONE을 한 DB 트랜잭션으로 커밋한다. D의 알림 API·푸시·구독 구현은 복제하지 않는다.
- 스케줄러는 기존 `linker.issues.sync-enabled`에서만 실행한다. 기본 false를 유지하며 DB·A/B 연결 확인 없이 켜지 않는다.

## SQL·실제 연결 경계

- [issue-cache.sql](../../../backend/src/main/resources/db/issue-schema/issue-cache.sql): 기존 11번 준비본.
- [issue-sync-jobs.sql](../../../backend/src/main/resources/db/issue-schema/issue-sync-jobs.sql): 12번 재시도 테이블 준비본.
- 두 파일 모두 자동 Flyway 검색 경로 밖이다. B의 실제 팀·멤버·저장소·보드 테이블 이후 정식 버전 번호로 편입한다. 기존 V1–V4를 변경하지 않았으며 공용/개발 DB에 임의 적용하지 않는다.
- 실제 실행에는 A의 `GithubUserAccessTokenSource`, B의 DB 기반 `TeamAccess` 및 팀/조직/저장소/보드 연결이 필요하다. 테스트용 대체 구현은 테스트 소스에만 있다.
- 실제 사용자 토큰·GitHub App 쓰기/수신, 설치 완료 후 캐시 연동, 정식 마이그레이션, 프론트 화면 연결은 아직 실검증하지 않았다. 이 문서는 이를 완료로 선언하지 않는다. 이슈 #88은 In progress를 유지하고 PR에는 `Refs #88`을 쓴다.

## 검증 결과

- 격리 PostgreSQL·Redis + 실제 Spring Security/MockMvc + 모의 GitHub HTTP를 사용했다. 팀 공용 DB·실제 GitHub 보드는 변경하지 않았다.
- `IssueReadIntegrationTest` 50개: 기존 11번 27개 + 12번 23개 통과.
- `IssueMarkdownTest` 3개, 정책·GitHub 설치·사용자 연동·JWT 회귀 16개: 합계 **69개 통과**, 실패·오류·생략 0.
- 12번은 내부 ID·권한·후보·초대 미수락/탈퇴·담당자 제한·silent ignore·알림 중복·라벨·일정 해제/순서·부분 실패·재시도·권한 회수·연결 변경·최대 시도·상태 close/reopen·삭제/이동·하위 이슈 노출·오래된 응답을 검증했다.
- `bootJar` 빌드, Orval 생성, `@linker/api` 및 웹 typecheck 통과. 전체 백엔드 테스트·실 GitHub App 쓰기·프론트 브라우저 E2E는 실행하지 않았다.
- OpenAPI 생성은 테스트가 덤프한 실제 Spring 스펙에서 `scripts/scope_openapi.py`로 p00/p11/p12만 선택한다. D의 다른 페이지 생성물을 이 C PR에서 새로 만들지 않는다. 페이지 mock·기존 프론트 상세 화면은 교체하지 않는다.
