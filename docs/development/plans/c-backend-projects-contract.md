# 백엔드 00 C — policy 키 공유·Projects 스파이크 계약

담당 C. 공유 대상 B(설치·웹훅), D(서버 정책 상수), 08·11–15 구현 담당자.
2026-11-05, 기준 커밋 `0686873`의 코드와 문서를 대조했다.

**상태: C 공유안 작성 및 개인 인증으로 보드·필드 실 조회 완료. B·D 공동 합의와 전체 스파이크 통과는 미확인이다.**
이번 변경은 계약 문서만 추가한다. 클라이언트·핸들러·API·DB·정책 값은 변경하지 않는다.

근거: [WBS](../02-wbs.md), [공통 조율 체크](../00-foundation-coordination-checklist.md),
[Policy 2·7장](../../planning/04-policy.md), [ERD](../01-erd.md).
범위는 팀 순서 3의 **C: policy 키 공유 + Projects 스파이크 계약**이다.

## 1. policy 키 공유

전체 export 목록, 글자 수·숫자·KST 포맷은 이미 정리한
[C 프론트 정책·포맷 계약](c-frontend-policy-contract.md)을 재사용한다.
값의 기준은 Policy이며, 화면은 [policy.ts](../../../frontend/apps/web/src/lib/policy.ts),
서버는 D 담당 [PlanLimits](../../../backend/src/main/java/com/linker/backend/global/config/PlanLimits.java)를 따른다.

| C가 공유하는 키·기준 | 현재 값·단위 | 서버 코드 대조 |
| --- | --- | --- |
| `KST` (`lib/format/time.ts`) | `Asia/Seoul` | `PlanLimits.APP_ZONE`과 동일 |
| `IMAGE.maxBytes` | 10 × 1024 × 1024 bytes | `IMAGE_MAX_BYTES`와 동일 |
| `IMAGE.longSidePx` | 2048 px | `IMAGE_LONG_SIDE`와 동일 |
| `ISSUE.createPerDay` | 100건/일 | 대응하는 PlanLimits 키 없음. C·D 합의 필요 |
| `ISSUE.assigneesMax` | 10명/이슈 | 대응하는 PlanLimits 키 없음. C·D 합의 필요 |
| `ISSUE.refreshIntervalSeconds` | 60초 | 대응하는 PlanLimits 키 없음. C·D 합의 필요 |

대응 키가 없다는 것은 서버에서 이 제한을 적용했다는 뜻이 아니다. 이번에는 D의 상수를 추가하거나 이름을 확정하지 않는다.
`PLAN_LIMITS`의 `null`은 무제한, `0`은 허용량 0이다. 실제 잔여량·권한·가격은 서버 응답을 따른다.
정책 변경은 Policy → 관련 담당자 확인 → 프론트·서버 상수 및 소비 코드 반영 순서로 진행한다.

## 2. Projects 데이터 의미

| 항목 | 사용할 기준 |
| --- | --- |
| 원본 | 이슈·담당자·라벨은 GitHub Issues, 보드 상태·시작일·마감일은 GitHub Projects |
| 팀과 보드 | 팀당 보드 1개. 팀 생성 시 선택하고 변경은 팀 설정에서 처리 |
| 기본 상태 | Todo → `TODO`, In Progress → `IN_PROGRESS`, Blocked → `BLOCKED`, Done → `DONE` |
| 기존 보드 | 실제 Status 옵션 ID로 매핑. 미매핑 옵션은 `OTHER`, 상태가 없으면 `NONE` |
| 닫힘·중단 | 닫힌 이슈는 완료로 집계. `BLOCKED`는 이슈를 닫지 않음. Done 이동에 따른 close는 별도 호출 |
| 날짜 | 시작일 ≤ 마감일. 날짜는 `yyyy-MM-dd`/`LocalDate` 의미를 유지하고 UTC 변환으로 하루를 바꾸지 않음 |
| 날짜 없음 | 마감일이 없으면 캘린더 대신 ‘일정 없음’. 날짜 비우기도 유효한 변경 |
| 지난 마감일 | 일괄 거절하지 않고 Policy의 ‘이미 지난 날짜예요’ 확인 규칙 적용 |
| 동기화 | 웹훅 후 재조회, 활성 팀 15분·그 외 하루 주기, 화면 수동 새로고침 최소 60초 간격 |

기존 보드의 누락 날짜 필드 추가·새 보드 생성은 Policy에 있는 후속 동작이며 이번 문서 작성 중에는 실행하지 않는다.
GitHub 밖에만 존재하는 이슈를 만들거나, 임의의 상태 옵션을 삭제·재명명하지 않는다.

## 3. 식별자와 저장 연결 기준

아래는 **ERD의 연결 계약**이며, 해당 테이블·저장 코드의 구현 완료를 뜻하지 않는다.

| 대상 | 연결할 식별자·필드 |
| --- | --- |
| `team_project_boards` | `team_id`, `github_project_node_id`, `project_number`, `title`, `status_field_id`, `start_date_field_id`, `due_date_field_id` |
| `board_status_mappings` | `board_id` + `github_option_id`, 표시 이름 `github_option_name`, 내부 상태 `linker_status` |
| `issues` | 팀·저장소 연결, `github_issue_id`, `github_node_id`, `number`, `project_item_id`, `state`, `board_status`, `start_date`, `due_date` |

로컬 DB ID, GitHub 숫자 ID, GraphQL node ID, 프로젝트 item ID를 구분한다.
이슈 번호는 저장소 안에서만 유일하며 전역 식별자로 쓰지 않는다. node ID를 임의로 해석하지 않는다.

## 4. B → C 웹훅 연결

현재 코드에서 확인한 계약:

- B의 `GithubWebhookService.accept`가 서명을 확인하고 `GithubWebhookDelivery`를 저장한다.
- 저장 필드에는 `deliveryId`, `event`, `action`, `installationId`, 원본 JSON `payload`가 있다.
- `WebhookQueue.enqueue(long deliveryRowId)`에는 **저장된 delivery 행의 ID**를 넣는다. 큐를 원본 JSON이나 별도 DTO로 바꾸지 않는다.
- 확장 지점은 `GithubWebhookHandler.supports(String event)`와 `handle(GithubWebhookDelivery delivery)`다.

Projects용 공동 합의안:

1. `projects_v2_item`과 이슈 변경 이벤트를 대상으로, 실제 수신 샘플에서 지원할 event/action과 필드 경로를 B·C가 확정한다. 이번 문서는 이벤트 구독·수신 성공을 보증하지 않는다.
2. 식별에 필요한 의미는 delivery/event/action, 설치·조직, 프로젝트·item, 연결된 이슈·저장소다. 원본에 없는 값은 GitHub 재조회와 검증된 연결 정보로 보완하며, 누락을 임의 ID로 채우지 않는다.
3. 이슈가 아닌 항목·연결되지 않은 프로젝트·권한 없는 저장소는 구분한다. 설치·조직·팀·보드·저장소의 신뢰 관계를 확인한 뒤 해당 팀 데이터만 처리한다.
4. 중복 delivery와 지연 이벤트를 검증한다. ERD의 오래된 `updated_at` 무시 규칙을 따르되, Issues와 Projects의 시각을 혼동하지 않도록 비교 필드·재조회 기준을 실제 응답으로 확정한다.
5. 정책상 동기화 읽기는 설치 토큰, 사용자 권한이 필요한 쓰기는 사용자 토큰을 쓴다. B의 공급 위치와 실제 Projects 권한은 연결 시 검증하고 토큰 값을 문서·로그에 남기지 않는다.

**B 선행 반영 후 상태(2026-11-05, #179):** `dispatch`는 `Propagation.NEVER`로 바깥 트랜잭션을 거절하고 handler를 트랜잭션 밖에서 호출한다.
C도 GitHub 조회를 트랜잭션 밖에서 끝낸 뒤 필요한 DB 변경만 짧은 자체 트랜잭션으로 처리한다.
읽기 설치 토큰은 `GithubAppClient.installationReadToken(외부설치ID)`에 있으며 실제 Projects 권한·호출은 미검증이다.
전달은 at least once이고 같은 이슈에 대한 서로 다른 delivery의 순서는 보장하지 않는다. C의 멱등 저장·지연 이벤트 기준은 공동 확인이 필요하다.
기존 큐·식별자·처리 경계와 C 확인 항목은 [B 순서 4 교차 계약](b-backend-cross-contracts.md)을 참고한다.
처리하지 않은 이벤트를 성공으로 표시하는 빈 handler도 등록하지 않는다.

## 5. 실제 스파이크 통과 조건 — 조회 결과 반영

[실 API 조회 결과·재현 방법](c-projects-spike-results.md)에 개인 GitHub 인증으로 확인한 내용을 기록했다.
팀 업무 보드의 Status·날짜 필드는 읽었으나 `Blocked` 옵션은 없었다. 설치 토큰·쓰기·웹훅 검증과 구분한다.

| 확인 항목 | 남겨야 할 증거 | 현재 상태 |
| --- | --- | --- |
| 보드·필드 조회 | 보드 ID·이름, Status 필드·옵션 ID, 날짜 필드 ID·타입 | 개인 인증 조회 성공. 마감일 연결 의미는 미확정 |
| Blocked | 상태 변경 → 재조회 결과, 이슈 OPEN 유지 | 미확인 |
| 날짜 | 시작·마감 설정 및 비우기 → 재조회 결과 | 미확인 |
| 웹훅 연결 | B 서명 검증·delivery 저장·큐 소비와 C 대상 식별 결과 | 미확인 |
| 경계 | 중복·지연 이벤트, 비이슈 항목, 누락 필드·미매핑 옵션, 권한 부족의 처리 결과 | 미확인 |

실제 검증은 팀이 정한 테스트 조직·보드·이슈에서 수행한다. 공유 DB 변경·마이그레이션은 별도 합의 대상이다.
문서의 체크 항목을 채우는 것만으로 ‘스파이크 통과’나 팀 전체 freeze를 선언하지 않는다.

## 6. 공유·확정할 내용

- **C → 전원:** 기존 policy export·포맷 계약과 이 문서의 상태·날짜·식별자 기준 공유.
- **C ↔ D:** ISSUE 세 키의 서버 상수 이름·단위·적용 위치 확인. 기존 숫자는 변경하지 않음.
- **C ↔ B:** 실제 event/action·payload 필드, 검증된 연결 정보·토큰 공급 위치, 외부 호출과 저장의 처리 경계 확인.
- **전원:** 공통 freeze 상태는 공동 체크에서 관리. C 단독으로 JWT·에러·알림·Tag 계약을 확정하지 않음.

기존 문서·코드 대조, 문서 링크·차이 검사, 개인 인증을 이용한 실 GraphQL 조회·입력 스키마 확인을 수행했다.
실행 코드 변경이 없어 빌드·전체 테스트는 재실행하지 않는다.
설치 토큰 호출·보드 변경·DB 저장·웹훅 수신은 이번 작업에서 수행하지 않았다.
