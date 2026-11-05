# C — 11 이슈 목록 API 구현

작업 브랜치: `feat/11-page-api`. 관련 이슈: [#86](https://github.com/likelion-backendschool-9th/Linker/issues/86).
기준 dev: `9fb7074` (#202 공통 계약, #206 D 채팅 변경 포함).

## 범위

백엔드 페이지 11만 구현한다. 12–15 API, B의 팀 생성·공유 엔티티·설치 콜백, D의 구독·결제·채팅 저장을 추가하지 않는다.
프론트는 서버에서 생성한 API 타입·React Query 함수·MSW·Zod만 포함하며, 화면 및 페이지 mock은 유지한다.
`p00-common` 태그·기존 API 경로는 변경하지 않는다.

| 메서드 | 경로(`/api/v1/user` 아래) | 동작 |
| --- | --- | --- |
| GET | `/teams/{teamId}/issues` | 저장소·상태·GitHub 담당자 로그인·라벨·open 필터, 커서·전체 건수 |
| GET | `/teams/{teamId}/issues/unscheduled` | 프로젝트 미등록 또는 마감일 없음 |
| GET | `/teams/{teamId}/issue-filters` | 현재 연결 저장소·라벨·활성 팀원·상태 후보 |
| POST | `/teams/{teamId}/issues/refresh` | 현재 탭·필터와 일치하는 캐시 이슈만 재조회. 사용자·팀별 60초 제한 |
| POST | `/teams/{teamId}/issues/{issueId}/project-item` | 팀·저장소 쓰기 권한 확인 → GitHub 추가 → 재조회·캐시 반영. 204 |
| GET | `/teams/{teamId}/progress?days=14` | Included. Flex 14일 추이·당일 집계·담당자별 작업량·마감 수치. Free는 PLAN_LIMIT |

메서드 태그는 `p11-issue-list`. 사용자 쿠키·DeveloperOnly·TeamAccess와 공통 오류 `{code,message,detail}`를 재사용한다.
쓰기는 정지·읽기 전용 팀에서 거절한다. 정지 계정의 읽기는 Policy대로 허용한다.

## 동기화와 저장

- B의 설정 저장 커밋 이후 `UserIssueSyncService.initialSync(teamId)`를 호출한다. 자동 주기 갱신도 최초 미동기화 팀을 찾는다.
- REST 이슈는 PR을 제외하고 전 페이지를 읽는다. Projects 항목과 각 항목의 fieldValues도 페이지를 끝까지 읽는다.
- 실제 저장된 필드 ID와 옵션 ID를 쓴다. `Blocked`, `Due date`, 특정 보드 ID를 기본값으로 하드코딩하지 않는다.
- 같은 팀의 최초·주기·수동·웹훅·프로젝트 추가가 모두 PostgreSQL **세션** advisory lock에 참여한다. 원본 조회 전 획득, DB 커밋 후 해제한다.
- 외부 HTTP를 DB 트랜잭션 안에서 실행하지 않는다. 저장 시 팀·보드·연결 저장소가 읽기 시작 시점과 같은지 재검증한다.
- GitHub Issue.updated_at이 오래된 응답은 제목·담당자·라벨을 덮어쓰지 않는다. Projects 필드는 별도 원본이므로 해당 Issue 시각만으로 무시하지 않는다.
- 전체 목록에서 빠진 기존 이슈는 개별 재조회한다. 같은 저장소 ID 검증 후 이슈 404가 확인된 경우만 삭제 표시한다. 목록 누락·403·통신 실패만으로 삭제하지 않는다.
- GitHub 추가는 중복 호출해도 기존 프로젝트 항목을 재사용한다. 추가 성공 후 재조회 실패는 FAILED와 확인된 item ID를 보존하고 오류를 반환한다. 다음 전체 동기화로 복구한다.
- ACTIVE 팀은 15분, COMPLETED 팀은 일별로 전체 동기화한다. READ_ONLY/ARCHIVED/DELETED와 제거·중지된 설치는 원본 갱신에서 제외한다. 실패는 성공 시각으로 기록하지 않는다.
- 웹훅은 B의 원문·외부 installation ID·행 ID 큐를 재사용한다. 누락·잘못된 타입·알 수 없는 action·미해결 연결은 정상 처리로 위장하지 않는다.
- 보관 항목의 노출·멤버십 정책은 아직 미확정이다. archived를 CLOSED·삭제·날짜 해제로 바꾸지 않고 해당 저장을 거절한다. 정책 결정은 별도 조율 대상이다.

## 스냅샷과 진행 현황

KST 자정에 방금 끝난 날짜의 네 상태·마감 초과 수치를 모든 비삭제 팀에 저장한다. 같은 날짜 재실행은 멱등이며 1년 초과 행은 정리한다.
당일은 저장된 과거 값으로 꾸미지 않고 현재 이슈를 집계한다. 아직 수집하지 않은 과거 날짜는 0 대신 null을 반환한다.
Flex 권한은 D의 subscriptions ERD를 읽기 전용으로 참조한다. ACTIVE/TRIALING 유효 기간 또는 PAST_DUE 결제 실패 유예를 확인한다.
구독 테이블 자체가 없으면 준비 미완료 503이며, 실제 Free/만료이면 403 PLAN_LIMIT이다. 구독을 임의로 생성하거나 결제 코드를 복제하지 않는다.
담당자별 작업량은 이름·로그인 순으로 제공하며 순위로 정렬하지 않는다.

## B/D 연결 전 안전 경계 — 전체 기능 완료 표시 금지

현재 dev에는 B의 팀·저장소·보드 연결 테이블과 DB 기반 TeamAccess, A의 실제 사용자 토큰 공급, D의 구독 구현이 없다.
테스트에만 해당 ERD 투영을 두었으며 실제 운영 코드에 허용용 TeamAccess나 가짜 회원·구독을 넣지 않았다.

1. C 테이블 DDL은 `backend/src/main/resources/db/issue-schema/issue-cache.sql`에 준비했다.
2. B의 공유 테이블이 먼저 존재해야 FK를 만들 수 있으므로 **자동 Flyway 경로에 임의 V3 파일로 넣지 않았다**. 현재 V1·V2를 수정하지 않는다.
3. B와 마이그레이션 번호·순서를 정한 뒤 이 SQL을 버전이 있는 정식 마이그레이션으로 편입한다. 개발·공유 DB에 수동 실행하라는 안내가 아니다.
4. DB 기반 TeamAccess와 B의 검증된 연결, A 사용자 토큰, App 권한을 연결하고 실제 데이터를 확인한다.
5. B/C 실수신 샘플·계약 확인 후 `ISSUE_WEBHOOK_ENABLED=true`, 공유 스키마·초기 동기화 준비 후 `ISSUE_SYNC_ENABLED=true`로 활성화한다. 기본값은 둘 다 false다.
6. D 28 이후 실제 Flex 자격과 진행 현황을 연결한다. 현재 구독 검증은 테스트 전용 ERD 투영으로 검증했다.

따라서 이 변경은 **C의 11번 코드와 격리 검증**이며 서비스 실연동·전체 페이지 완료 선언이 아니다.
PR은 `Refs #86`으로 연결하고, 이슈는 In progress를 유지한다. Closes #86 또는 Done은 실제 연결·완료 기준 통과 후 사용한다.

## 생성 타입과 기존 화면

실제 Springdoc 출력에서 p00-common·p11-issue-list와 참조 스키마만 골라 Orval을 실행한다. 다른 담당자의 생성 클라이언트는 이번 범위에서 새로 만들지 않는다.
필수·nullable·상태 enum을 명시했고, `canWrite`는 boolean이며 조회 실패 이유는 `writePermissionReason`으로 구분한다.
기존 화면의 임시 타입에는 NONE, 연결되지 않은 담당자 id/avatarUrl의 null, 진행 현황 응답 차이가 남아 있다.
이번 PR은 화면이나 12–15 기능을 확장하지 않는다. 실 API 전환 시 해당 페이지의 생성 타입으로 대체하고 표시·빈 값 처리를 맞춘 뒤 mock을 제거한다.

## 검증 방법과 한계

- `IssueReadIntegrationTest`: 실제 Spring Security 쿠키, Flyway V1/V2, PostgreSQL, Redis, 테스트 HTTP GitHub 서버 사용.
- B/D 공유 테이블·TeamAccess·A 사용자 토큰 공급은 테스트 전용 대역. 배포된 B/D 구현과의 연결 시험이 아님.
- 서명된 HTTP 수신 → B의 PostgreSQL delivery → Redis 행 ID → 실제 dispatch → C 캐시 반영을 합성 payload로 검증한다. 실제 GitHub App 수신 캡처와 구분한다.
- 실제 개인 인증으로 C 어댑터의 두 읽기 GraphQL 쿼리가 보드 12에서 오류 없이 동작함을 확인했다. 100개 항목과 다음 페이지 존재를 확인했고, 필드 cursor 후속 쿼리도 성공했다. App 설치 토큰·쓰기 성공 증거는 아니다.
- 테스트용 GitHub 오류·동시 실행·오래된 응답·삭제 확인·중복 웹훅·권한·결제 유예·KST·보관 정책·재시도 복구를 검증한다.
- 팀의 실제 DB·GitHub 보드·필드·이슈는 변경하지 않았다.

테스트는 기본적으로 Testcontainers PostgreSQL·Redis를 사용한다. 외부 테스트 인스턴스를 쓸 때만 ISSUE_TEST_DB_URL/ISSUE_TEST_DB_USERNAME/ISSUE_TEST_DB_PASSWORD/ISSUE_TEST_REDIS_PORT를 지정하며 개인·공유 개발 DB를 넣지 않는다.

## 근거

- WBS §4-8, Page TODO 11, Policy 6·7·11장, ERD issues·team_progress_snapshots
- 00-openapi-tags.md, 00-foundation-contract-freeze.md, c-backend-cross-contracts.md
- [GitHub Issues REST](https://docs.github.com/en/rest/issues/issues)
- [GitHub Projects GraphQL](https://docs.github.com/en/graphql/reference/projects)

문서 변경은 저장소 밖 한국어 원본에도 반영이 필요하다. 푸시는 사용자 확인 이후에만 진행한다.

## 최종 로컬 검증 결과

- 11번 통합 테스트 27개 + 관련 정책·설치·세션 회귀 16개 = 43개 통과(실패·오류·생략 0). 전체 백엔드 테스트를 실행한 것은 아니다.
- 실행 JAR `bootJar` 빌드 통과.
- 실제 Springdoc 응답의 필수·nullable·상태 enum 확인, Orval 생성 통과.
- API 패키지 및 웹 타입 검사 통과.
- GitHub 개인 인증의 읽기 쿼리 2개 성공. 실 App 쓰기·수신은 미검증.

생성 재현(프로젝트 루트):

```bash
python3 scripts/scope_openapi.py --input backend/build/openapi/page11.json --output backend/build/openapi/page11-client.json --tags p00-common p11-issue-list
cd frontend
OPENAPI_URL=/home/jangabc3/Linker/backend/build/openapi/page11-client.json pnpm --filter @linker/api generate
```

OpenAPI 입력 파일은 위 통합 테스트가 생성한다. 저장소 경로가 다르면 해당 절대경로를 변경한다.
