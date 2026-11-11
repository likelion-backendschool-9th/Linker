# C14 상태 보드 API — 구현 및 검증

> 2026-11-06 · `feat/14-page-api` · 기준 `origin/dev 91ef336` (#224 포함) · [이슈 #92](https://github.com/likelion-backendschool-9th/Linker/issues/92)

## 범위

[WBS 4-8·P14](../02-wbs.md), [Page TODO 14](../../planning/07-page-todo.md), [Policy POL-I-3·I-4](../../planning/04-policy.md)에 따른 **14번 C 담당 백엔드**다. 상태 변경 API는 새로 만들지 않고 12번 `PUT .../issues/{issueId}/status`를 그대로 쓴다. 필터 선택지는 11번 `issue-filters`를 재사용한다. 15번 API, 프론트 화면 교체, B의 팀·권한·보드 연결, 정식 Flyway 편입은 포함하지 않는다.

`user.IssueController → user.IssueService.board → IssueReadRepository.board`이며 새 서비스·테이블·REST 총수 변경은 없다(205개 유지).

| 메서드 | 경로 (기본 `/api/v1/user/teams/{teamId}`) | 동작 |
| --- | --- | --- |
| GET | `/board?repo=&assignee=&label=&open=` | 작업 전·작업 중·작업 중단·작업 완료·기타 5칸과 칸별 카드, 쓰기 가능 여부 |

태그 `p14-board`, operationId `getTeamIssueBoard`, 응답 no-store, `@DeveloperOnly`와 현재 팀원 검사를 사용한다.

## 응답 계약

- `{canWrite, writePermissionReason, columns[{status, label, cards[]}]}`. 칸은 항상 5개이며 순서는 TODO, IN_PROGRESS, BLOCKED, DONE, OTHER다. 빈 칸도 빈 배열로 반환한다.
- 카드는 11번 목록 항목(`IssueListItem`)과 같은 모양이다. 담당자(팀 소속 여부 포함)·라벨·마감·마감 지남 표시를 같은 코드로 만든다.
- 보드에는 **팀 GitHub Projects 보드에 들어간 이슈만** 나온다(`project_item_id` 있음). 보드 밖 이슈는 11번 "일정 없음"에서 "프로젝트에 추가"로 넣는다(Policy 7장).
- 닫힌 이슈는 보드 값과 관계없이 작업 완료 칸이며 마감 지남으로 표시하지 않는다.
- 매핑되지 않은 보드 값(OTHER)은 기타 칸이다. **Status 값이 비어 있는 카드(NONE)도 기타 칸에 넣되, 카드의 status는 NONE으로 유지**한다. 화면에서 구분할 수 있고 드래그로 상태를 정할 수 있다. (2026-11-06 C 확인)
- 칸 안의 순서는 **마감 급한 순**이다: 마감 지난 것(오래된 순) → 마감 임박 순 → 마감일 없음, 같은 날짜는 내부 ID 순. 07 내 이슈의 정렬 규칙과 같다. GitHub 보드의 수동 순서(`reordered`)는 저장하지 않는다는 기존 계약을 유지한다. (2026-11-06 C 확인)
- 필터는 11번과 같고 상태만 제외한다(칸이 곧 상태). 잘못된 repo·open 값은 400 `VALIDATION_ERROR`, 다른 팀 저장소 ID는 범위를 넓히지 않고 빈 결과다. 보드는 한 번에 전부 반환하며 페이지를 나누지 않는다.
- 삭제된 이슈·삭제된 저장소·팀에 연결되지 않은 저장소의 이슈는 나오지 않는다.

## 권한

- 로그인 개발자이면서 현재 팀원이어야 한다. 채용 담당자·팀 밖 사용자는 403, 비로그인은 401이다. 운영자도 팀 권한을 우회하지 않는다.
- `canWrite`는 11번과 같은 규칙으로 계산한다. 읽기 전용 팀 `READ_ONLY_TEAM`, 정지 계정 `SUSPENDED`, 연결 저장소 쓰기 권한 없음 `NO_REPOSITORY_WRITE_PERMISSION`, GitHub 확인 실패 `GITHUB_PERMISSION_UNAVAILABLE`. `+`(이슈 작성)만 `canWrite`를 따른다. 카드 이동은 쓰기 가능한 팀의 팀원이면 저장소 push가 없어도 된다. 읽기 전용·보관 팀과 정지 계정은 상태 메뉴와 드래그가 꺼진다. 상태 API는 저장소 쓰기가 없으면 설치 토큰으로 GitHub에 반영한다.
- 11번의 쓰기 권한 계산을 `user.IssueService` 안의 공용 private 메서드로 옮겼다. 동작은 바꾸지 않았다.
- GitHub 권한 확인은 DB 트랜잭션 밖에서 하고, 읽기 트랜잭션 안에서 팀원 여부와 팀 연결 정보가 그대로인지 다시 확인한다. 바뀌었으면 409 `STATE_CONFLICT`다.

## 생성 타입

실제 Springdoc 출력에서 `p00-common`, `p07-workspace`, `p11-issue-list`, `p12-issue-detail`, `p13-issue-create`, `p14-board` 태그를 골라 Orval을 실행했다. 기존 p00·p07·p11·p12·p13 생성 파일은 내용이 같아 커밋 상태를 유지했고, `p14-board` 폴더·index 두 줄·`openAPIDefinition.schemas.ts`의 보드 타입 4개(`IssueBoardColumnStatus`, `IssueBoardColumn`, `IssueBoardResponse`, `GetTeamIssueBoardParams`)만 추가했다.

기존 화면 mock(`p14-board.ts`)과 응답 모양은 같다. 화면의 임시 타입에는 `writePermissionReason`, 카드 status `NONE`이 아직 없다. 실 API 전환 때 생성 타입으로 바꾸고 기타 칸의 NONE 카드 표시를 맞춘다. 이번 PR은 화면을 바꾸지 않는다.

## 검증

- `IssueReadIntegrationTest` 90개 통과(14번 신규 4개 포함, 실패·오류·생략 0). Testcontainers PostgreSQL·Redis, 실제 Security 쿠키, 테스트 GitHub HTTP 서버를 사용했다.
  - 5칸 순서·라벨, 마감 급한 순, 보드 밖·삭제·다른 팀 제외, 닫힌 이슈 작업 완료, NONE·OTHER 기타 칸
  - 11번 필터 재사용(라벨·담당자·열린 이슈·저장소), 상태 파라미터 무시, 잘못된 값 400, SQL 주입 문자열
  - 비로그인 401, 팀 밖·채용 담당자 403, 읽기 전용 팀·쓰기 권한 없음의 `canWrite=false`와 이유
  - OpenAPI 태그·operationId, 생성 입력 파일 출력
- 백엔드 전체 `./gradlew build` 통과(테스트 387개, 실패·오류·생략 0).
- 프론트 `pnpm lint`, `typecheck`, `test`(web 454개), `build` 통과.
- 실제 GitHub App·개발/공용 DB에는 쓰지 않았다. B #217 실연동·정식 마이그레이션·화면 E2E는 별도다.

## 남은 공동 연동

11·12·13과 같다. B #217의 실제 팀·권한·보드 연결, C SQL의 정식 Flyway 편입, 실제 GitHub App 왕복 확인 뒤에 #92를 완료로 바꾼다. 그 전까지 PR은 `Refs #92`, 이슈는 In progress다.

문서 변경은 저장소 밖 한국어 원본(WBS P14, 이 구현 기록)에도 반영이 필요하다.
