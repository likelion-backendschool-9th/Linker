# C07 내 이슈 API — 구현 및 검증

> 2026-11-06 · `feat/my-issues-api` · 기준 `origin/dev 5f4c885` (#253 이슈 JPA 전환, #255·#256 포함)

## 범위

[WBS 4-8·P07](../02-wbs.md), [Page TODO 07](../../planning/07-page-todo.md), [Policy POL-I-5](../../planning/04-policy.md)에 따른 **07 "내 이슈"의 C 담당 백엔드**다. 엔드포인트는 WBS에 이미 있는 1개이므로 REST 총수(205)·컨트롤러 수(29)·테이블 수(69)는 바뀌지 않는다. 화면(미리보기·전체 목록·팀 선택기) 연결은 포함하지 않는다.

`user.IssueController → user.IssueService.myIssues → IssueRepository.assignedToMe`이며 새 컨트롤러·서비스·테이블은 없다.

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| GET | `/api/v1/user/me/issues?teamId=` | 선택한 팀에서 나에게 배정된 열린 이슈 전체 |

태그 `p07-workspace`(B의 `GET /me/teams`와 같은 태그), operationId `getMyIssues`, 응답 no-store, `@DeveloperOnly`.

`user.IssueController`의 클래스 경로를 `/user/teams/{teamId}`에서 `/user`로 바꾸고 각 메서드에 `/teams/{teamId}`를 붙였다(B의 `user.TeamController`와 같은 방식). 실제 URL은 그대로이며, 전후 `/v3/api-docs`를 비교해 **추가된 것은 이 경로 1개와 `MyIssuesResponse` 스키마뿐**이고 기존 경로·태그·operationId·파라미터·응답은 같음을 확인했다.

## 응답 계약

- `{teamId, items[]}`. `items`는 11번 목록 카드(`IssueListItem`)와 같은 모양이다. 담당자(팀 소속 여부 포함)·라벨·마감·마감 지남 표시를 11·14·15와 같은 코드로 만든다.
- 대상: 선택한 팀의 **열린** 이슈 중 `issue_assignees.user_id`가 나인 것(ERD 4-5 "My issues"). GitHub 담당자가 Linker 계정과 연결된 경우만 내 이슈다. 보드 밖 이슈도 포함한다(내 이슈는 보드 기준이 아니다).
- 제외: 닫힌 이슈, 다른 팀 이슈, 삭제된 이슈, 삭제된 저장소·팀에 연결되지 않은 저장소의 이슈.
- 정렬: 마감 지난 것(오래된 순) → 마감 임박 순 → 마감일 없음, 같은 날짜는 내부 ID 순(POL-I-5, Page TODO 07). 마감일 오름차순에 NULL을 마지막으로 둔 것과 같다. 14번 보드의 칸 안 정렬과 같다.
- 페이지를 나누지 않고 전부 반환한다. `/workspace` 미리보기의 줄 수는 화면이 정한다(Page TODO 07 "UI-limited, not a fixed count").
- GitHub 호출·보드가 필요 없다. 설정 중인 팀은 행이 없어 빈 목록이다. 빈 목록 문구는 화면 몫이다("배정된 이슈가 없어요").

## 권한·검증

- 비로그인 401, 채용 담당자 403(`@DeveloperOnly`), 탈퇴 진행·삭제 계정 403(기존 이슈 접근 규칙).
- `teamId`가 없거나 숫자가 아니거나 0 이하, 또는 **현재 속한 팀이 아니면 400 `VALIDATION_ERROR`**(WBS 07 "otherwise 400"). 팀 페이지의 403과 달리 잘못된 필터로 다룬다. 화면은 이때 기본 팀으로 돌아간다(Page TODO 07).
- 읽기 전용·보관 팀도 내가 속해 있으면 조회할 수 있다(기본 팀이 보관 팀일 수 있음).
- 팀원 확인과 조회를 같은 REPEATABLE READ 읽기 트랜잭션에서 한다(11·14·15와 같은 방식).

## 코드 규칙

- `UserIssueAccess`의 계정 검사를 `developer()`로 묶고 `member()`(403)와 `ownTeam()`(400)이 공유한다. 기존 `member()` 동작은 같다.
- 조회는 JPQL 하나와 기존 카드 일괄 조회(담당자·라벨) 2개, 총 3쿼리다. N+1이 없다. 결과는 스칼라 프로젝션이다(2단계 기록 참고).

## 생성 타입

이전 C 페이지와 같이 실제 Springdoc 출력으로 Orval을 실행하고 **해당 부분만** 반영했다. `p07-workspace` 3개 파일에 `getMyIssues` 함수·훅·MSW·zod가 추가되고, `openAPIDefinition.schemas.ts`에 `MyIssuesResponse`, `GetMyIssuesParams` 2개 타입을 추가했다. 기존 생성 코드는 바뀌지 않았다.

기존 화면 목업(`mocks/pages/p07-workspace.ts`)과 화면 임시 타입(`workspace/issues/_lib/my-issues-queries.ts`)은 11-03 결정 전의 "모든 팀" 기준이다(`teamId` 없음, `teamName` 포함). 화면 연결 때 생성 타입과 `teamId` 필수로 바꾼다. 이번 PR은 화면을 바꾸지 않는다.

## 검증

- `IssueReadIntegrationTest` 108개 통과(07 신규 4개 포함). 정렬·마감 지남·보드 밖 포함·닫힘/다른 팀/삭제/연결 끊긴 저장소/다른 사람 배정 제외, 읽기 전용 팀 조회, 빈 목록, 401·403·400(팀 밖·떠난 팀·없는 팀·0·문자·누락), OpenAPI 태그·operationId와 기존 경로 유지.
- 백엔드 전체 `./gradlew build` 통과(테스트 503개, 실패·오류·생략 0).
- 프론트 `pnpm lint`·`typecheck`·`test`(web 464개)·`build` 통과.
- 실제 GitHub App·개발/공용 DB에는 쓰지 않았다.

## 문서 갱신

- 새 문서: 이 기록.
- WBS·Policy·Page TODO·ERD·합계는 바뀌지 않는다(이미 정의된 엔드포인트 구현).
