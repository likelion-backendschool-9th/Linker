# C12 이슈 상세·수정 API — 구현 및 검증

> 2026-11-06 · `feat/12-page-api` · 최신 통합 기준 `origin/dev b82de28` · [이슈 #88](https://github.com/likelion-backendschool-9th/Linker/issues/88)

## 범위

[WBS P12/S08](../02-wbs.md), [Policy 7장](../../planning/04-policy.md), [ERD](../01-erd.md)에 따른 **12번 C 담당 백엔드**다. 기존 11번의 권한·캐시·잠금을 재사용한다. 13–15 API, 프론트 화면 교체, B의 팀 생성·TeamAccess 구현, A의 로그인 구현, D의 알림 API·구독 기능은 추가하지 않는다.

`UserIssueController → UserIssueService → UserIssueDetailService`를 사용한다. 같은 접근 그룹의 `UserIssueAccess`를 11/12가 공유하며, 외부 통신과 DB 트랜잭션을 분리한다.

## 구현한 API 8개

기본 경로: `/api/v1/user/teams/{teamId}/issues/{issueId}`. `issueId`는 GitHub 번호가 아닌 **Linker 내부 DB ID**다. 응답은 no-store, OpenAPI 메서드 태그는 `p12-issue-detail`이다.

| 메서드·뒤 경로 | 구현 내용 |
| --- | --- |
| GET 기본 경로 | 안전 처리한 Markdown, 작성자 프로필·담당자·라벨·일정·상태, 쓰기 권한과 이유, 삭제/이동·동기화 상태, 하위 이슈 집계 |
| GET `/assignee-candidates` | 현재 활동 팀원 + 조직 초대 수락 + 저장소 읽기 권한. 최대 10명 제한을 함께 반환 |
| PUT `/assignees` | `{userIds}`. 후보·중복·최대 10명 검사, 실제 사용자 쓰기 권한, GitHub 응답 및 재조회 확인, 새 담당자 알림 |
| GET `/label-options` | 실제 저장소 라벨을 끝 페이지까지 조회 |
| PUT `/labels` | `{labels}`. 저장소에 존재하는 이름만 반영. 빈 배열로 해제. 응답 및 재조회 검증 |
| PUT `/schedule` | `{startDate,dueDate}` 전체 교체. 시작≤마감 검사, null로 해제. 과거 날짜 자체는 거부하지 않음 |
| PUT `/status` | TODO/IN_PROGRESS/BLOCKED/DONE. 실제 매핑 옵션 ID 사용. Done은 close, 다른 상태는 reopen. 재조회 확인 |
| GET `/sub-issues` | GitHub 하위 이슈 읽기 전용. 연결되지 않은 저장소의 제목·URL 제외. 완료 수와 내부 부모 연결을 캐시에 반영 |

## 상세 정보·이동 처리

- Markdown AST에서 원시 HTML을 텍스트로 이스케이프하고 위험 URL을 제거한다. 반환값은 Markdown이며 프론트의 기존 `rehype-sanitize` 렌더링을 유지해야 한다. GitHub `created_at`을 사용한다.
- 작성자의 GitHub 사용자 ID를 기존 `auth_identities`로 연결해 이름·프로필 이미지를 읽는다. 연동되지 않은 작성자는 GitHub 로그인만 표시하며 가짜 Linker ID를 만들지 않는다.
- 이동 응답의 Location은 자동 추적하지 않는다. 설정된 API origin, 허용된 경로, **현재 팀에 연결된 저장소**만 식별하고, 저장된 저장소 ID를 재검증한 요청으로 목적지를 확인한다. GitHub 이슈 ID/node ID가 기존 이슈와 같은지도 검사한다.
- 확인된 이동은 같은 Linker ID를 유지하면서 저장소·번호·URL·프로젝트 정보를 갱신한다. 정상 상세를 반환(`deletedOrMoved=null`, `movedToIssueId=기존 내부 ID`)해 기존 화면의 자기 자신 리다이렉트를 피한다. 다음 조회는 새 저장소를 사용한다.
- 목적지를 확인할 수 없거나 다른 팀/연결되지 않은 저장소라면 `MOVED`와 null 목적지를 반환한다. 임의 외부 URL·다른 저장소의 비공개 정보를 따라가거나 노출하지 않는다. 원래 저장소 접근을 확인한 뒤의 404/410은 삭제 상태로 반환한다.
- 하위 이슈는 완전한 원본 조회가 성공한 뒤 팀 잠금 안의 짧은 DB 트랜잭션에서 집계·부모 연결을 반영한다. 제거된 연결을 정리하고 자기 자신을 하위 이슈로 넣은 잘못된 응답은 거절한다.

## 권한·재시도·알림

- 로그인 개발자·현재 팀원·연결된 리소스를 검사한다. 변경 시 현재 DB 계정 ACTIVE와 실제 GitHub 사용자 쓰기 권한이 필요하다. 운영자도 팀 권한을 우회하지 않는다. 담당자 후보의 읽기 권한과 변경자의 쓰기 권한은 구분한다.
- 기존 PostgreSQL 팀 advisory lock을 조회부터 캐시 커밋까지 유지해 11번 웹훅·수동·주기 갱신과 직렬화한다. GitHub HTTP 호출은 DB 트랜잭션 밖에서 실행한다. 응답은 같은 잠금 안에서 구성한다.
- 외부 변경 전에 `issue_sync_jobs`에 사용자 ID·목표 값·연결 식별자만 보관한다. 토큰/비밀번호/외부 오류 본문은 보관하지 않는다. 재시도 시 계정·팀원·권한·후보/라벨·보드 연결을 재검사한다.
- C12 작업은 SET_ASSIGNEES, SET_LABELS, SET_START(시작/마감 전체), SET_STATUS(보드 상태와 open/closed 전체)다. 목표 값을 멱등 재적용한 뒤 REST·Projects 원본을 재조회한다. 오래된 응답을 성공 처리하지 않는다.
- 최대 시도는 최초 포함 3회, 일반 일시 장애는 60초 간격이다. 서버 종료 후 RUNNING lease가 만료되어도 네 번째 외부 쓰기를 하지 않는다. 진행 중 작업이 있으면 새로운 변경은 409다.
- GitHub 429 및 한도 소진 403은 권한 거절과 구분한다. Retry-After/reset을 반영하고 재시도 간격을 늘려 서버가 지정한 대기 전에는 호출하지 않는다. 일반 권한·입력·연결 충돌 4xx는 자동 재시도를 중단한다. 이 수치는 운영 보호값이며 상품 정책을 바꾸지 않는다.
- 실패 응답에는 jobId·syncStatus·retryScheduled를, 재시도 시에는 retryAfterSeconds도 반환한다. 일반 11번 재조회가 미해결 실패 표시를 지우지 않는다.
- 실제 반영 확인 후 기존 `UserNotificationService.create(CreateNotificationCommand)`로 새 담당자에게 알린다. 요청 전 담당자 ID를 보존해 웹훅 경합·재조회 실패 후에도 새 담당자를 판별한다. 캐시·알림·job DONE은 한 트랜잭션으로 커밋한다. 자기 자신/기존 담당자는 알리지 않는다.
- 커밋 성공 후 늦게 실패가 보고되어도 DONE을 PENDING으로 되돌리지 않는다. 완료된 작업이 다시 실행되어 알림이 중복되는 것을 막는다. 기존 sync-enabled=false 기본값을 유지한다.

## 기존 구현 재사용과 남은 외부 선행

- A의 실제 `PersistedGithubUserAccessTokenSource`·`GithubTokenCipher`를 그대로 소비한다. 테스트에서 합성 토큰을 실제 암호화 저장한 뒤, A 복호화 → C 사용자 권한 조회/쓰기 HTTP 전달을 검증했다. 실제 GitHub 사용자 자격 증명을 사용한 것은 아니다.
- dev의 B #214 팀 목록·공유 SQL 준비본을 재사용한다. B의 [#217](https://github.com/likelion-backendschool-9th/Linker/pull/217)에 MembershipTeamAccess·팀/저장소/보드 저장·최초 동기화 연결 코드가 있으며 C 소비 열/시그니처와 대조했다. 아직 미머지이므로 C에서 복제하지 않고, 병합 후 해당 구현을 받아 공동 검증한다. 현재 dev의 TeamAccess는 임시 전체 거절 상태이며 C 통합 테스트의 외부 계약 대체와 구분한다.
- C의 [issue-cache.sql](../../../backend/src/main/resources/db/issue-schema/issue-cache.sql)과 [issue-sync-jobs.sql](../../../backend/src/main/resources/db/issue-schema/issue-sync-jobs.sql)은 자동 Flyway 경로 밖이다. E 공유 github_repos는 V12로 정식 반영됐으며, 나머지 B 공유 테이블과 버전 순서 확정 후 C SQL을 정식 편입한다. 개발/공용 DB에 임의 적용하지 않았다.
- ERD의 재시도 enum에 SET_ASSIGNEES/SET_LABELS를 추가했다. 기존 69개 테이블·205개 API 계획은 유지한다. 저장소 밖 ERD 원본에도 step 설명을 반영해야 한다.
- 실제 사용자·GitHub App 쓰기/수신, 실제 팀/권한 데이터와 정식 DB 마이그레이션, 프론트 화면 왕복 검증은 남아 있다. 따라서 #88은 In progress, PR은 Refs #88로 유지한다.

## 최신 검증 결과 (b82de28 반영 후)

- **기본 설정에서 82개 통과**, 실패/오류/생략 0: 이슈 통합 62개, Markdown 3개, 정책·GitHub·JWT 회귀 16개, Flyway 버전 중복 회귀 1개. 격리 PostgreSQL/Redis·Spring Security/MockMvc·모의 GitHub HTTP를 사용했다.
- `./gradlew clean test`의 관련 테스트와 `bootJar`를 실행했다. 임시 SQL 사본이나 Flyway locations override를 사용하지 않았다. D #219가 정식 dev에 반영한 V4 GitHub 로그인 / V10 채팅 수정 순서를 그대로 사용했다. C가 별도 재번호화하지 않았다.
- API 패키지·웹 typecheck 통과. D #220의 공통 목업 수정 반영 후 기존 미정의 변수 오류가 해소됐고, mock-fetch 테스트 11개도 통과했다.
- E #218까지 반영해 실제 Flyway V12의 github_repos를 사용했다. dev의 중복 테스트 테이블 제거를 유지하고, C12 이동 테스트의 추가 저장소 입력을 명시적 열/full_name/생성·수정 시각에 맞췄다. 새 공유 스키마 상태에서 백엔드 82개·bootJar와 API·웹 typecheck를 재검증했다. E 병합은 frontend를 변경하지 않아 #220 반영 후 목업 11개 통과 결과를 유지한다.
- p12 HTTP 계약과 p00/p07/p11/p12 생성물을 유지했다. 실제 PR diff는 C12 코드이며, 다른 담당자의 공통 수정은 승인·병합된 dev에서만 받았다.
- 최신 dev 포함·텍스트 충돌 없음·원격 feat/12-page-api가 현재 HEAD의 조상임을 확인했다. 일반 fast-forward push가 가능하며 강제 push는 필요 없다. 이 기록 시점에 에이전트가 push/PR 생성/merge를 실행하지 않았다.
- 전체 백엔드 CI·실 GitHub App 쓰기/수신·프론트 실연동 E2E 성공은 선언하지 않는다. PR 생성 후 원격 CI·리뷰를 확인하며 #88은 실연동 검증까지 In progress로 유지한다. 기존 개인 DB 마이그레이션 이력의 복구는 D #219의 공유 절차를 따르며 이 작업에서 DB repair/초기화를 하지 않았다.
