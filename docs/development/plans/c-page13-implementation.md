# C13 이슈 작성 API — 구현 및 검증

> 기준: dev `1c02b6e` (#223 포함) / 작업 브랜치 `feat/13-page-api` / [Backend #90](https://github.com/likelion-backendschool-9th/Linker/issues/90)

## 범위와 재사용

C 담당 13번 백엔드만 구현한다. 14·15 API, 화면, B의 팀 생성·권한 공급, D의 구독 구현은 추가하지 않는다. `user.IssueController → user.IssueService → user.IssueTemplateService/user.IssueCreateService`이며 기존 GitHub 클라이언트·팀 잠금·캐시·역할별 알림 계약을 재사용한다.

| 메서드 | 경로 (기본 `/api/v1/user/teams/{teamId}`) | 동작 |
| --- | --- | --- |
| GET | `/issue-templates?repoId=` | 저장소→조직의 공개 `.github`→기본 3종. 작성 전 담당자 후보·라벨 선택지도 함께 제공 |
| GET | `/issue-templates/{templateKey}?repoId=` | Markdown·YAML 폼·기본 라벨/담당자/프로젝트/유형. 파싱 실패·사라진 키는 기본 작업 템플릿과 fallback=true |
| POST | `/issues` | 입력·권한·하루 한도 검사, GitHub 생성→보드→시작일→마감일→상태, 202/jobId |
| GET | `/issue-sync-jobs/{jobId}` | 단계·상태·내부 issueId·detailPath·실패 코드·재시도 여부 |

모든 메서드는 `p13-issue-create`, 개발자·현재 팀원 권한, no-store를 사용한다. 생성에는 저장소 write·ACTIVE 계정·쓰기 가능한 팀이 필요하다. 운영자도 팀 권한을 우회하지 않는다.

## 작성 계약

- `requestId`는 초안마다 생성하는 UUID이며 같은 내용 재전송에는 같은 값을 쓴다. 동일 ID에 다른 내용/팀을 보내면 409다. 서버는 정렬된 JSON의 SHA-256으로 내용을 비교한다. 키는 사용자별로 격리한다.
- `repoId`, `title`, 선택적 `body/templateKey/answers/assigneeIds/labels/startDate/dueDate/status`를 받는다. null 담당자/라벨은 템플릿 기본값, 빈 배열은 명시적 해제다.
- 저장소는 팀 연결 목록에서만 선택한다. 담당자는 현재 팀원·조직 수락·저장소 읽기 권한, 최대 `PlanLimits.ISSUE_ASSIGNEES_MAX`. 라벨은 해당 저장소 선택지만 허용한다.
- 저장소/조직 템플릿 기본값을 먼저 보여 주고 제출 시 원본을 다시 읽는다. 사라지거나 깨진 템플릿을 제출 중 조용히 대체하지 않고 409로 재확인시킨다.
- YAML은 SafeConstructor, 중복 키 금지, 별칭/깊이/크기 제한을 사용한다. 폼 답변은 `### 질문` 형식, 빈 답은 `_No response_`. required, 선택지, 필수 체크박스를 서버도 검증한다. 안내 Markdown은 결과 본문에 쓰지 않고 업로드 필드는 MVP 미지원이다.
- 템플릿의 type은 GitHub 생성 인자로 반영한다. projects는 이미 팀에 연결된 한 보드와 일치하는지 확인하며 외부 보드에는 쓰지 않는다.
- GitHub의 transport 입력 제한으로 제목 256 code points, 전체 본문은 복구 표식 공간을 남겨 65,000 code points를 검사한다. 상품 정책 숫자는 하드코딩하지 않는다.
- 생성 전에는 issueId가 없으므로 상세 API를 가짜 ID로 호출하지 않는다. 기존 템플릿 목록 응답에 같은 규칙의 후보/라벨을 포함한다. REST 총수는 늘리지 않는다.

## 중복·부분 실패·일일 한도

- 기존 `issue_sync_jobs`를 확장한다. GitHub 생성 전에는 issue_id가 null이고 생성 의도만 존재한다. 실제 issue ID를 확인한 뒤에만 issues 캐시를 만든다.
- 사용자별 DB transaction advisory lock으로 서로 다른 팀·다중 인스턴스의 일일 한도 경합을 막는다. KST 하루 100회(`PlanLimits.ISSUE_CREATES_PER_DAY`), 접수한 생성 시도를 센다. 동일 초안 재전송은 한도를 추가 소비하지 않는다. 11·12와 같은 팀 session advisory lock으로 웹훅·수동 갱신과 직렬화한다.
- CREATE_SENT를 외부 POST 전에 저장하고, 생성 번호·GitHub ID/node ID를 응답 직후 저장한다. 이후 실패는 같은 이슈·보드 항목에 멱등 적용한다. 토큰은 payload에 넣지 않는다.
- POST 응답 유실은 초안별 불투명 HTML 주석 표식을 GitHub에서 재조회해 복구한다. 일치하는 생성 결과를 못 찾으면 CREATE_OUTCOME_UNKNOWN으로 중단하고 다시 POST하지 않는다. 복구 표식은 Linker 상세 Markdown에서 숨긴다.
- 생성 작성자·식별자·본문/유형·담당자·라벨과 최종 날짜·상태를 원본으로 확인한다. 권한/팀 연결은 재시도 때 다시 검증한다. 완료된 작업은 재실행하지 않는다.
- 최초 처리는 POST에서 수행하고 202와 작업 상태를 반환한다. 이후 재시도는 기존 IssueSyncSchedule에서 수행하며 `linker.issues.sync-enabled=false` 기본값을 유지한다. 실행 중단 후 RUNNING 작업도 lease 만료 후 복구한다. 최대 최초 포함 3회, 일반 장애 60초 증가 대기, GitHub Retry-After를 존중한다.
- 기존 12번 재시도 worker는 CREATE를 소비하지 않는다. 캐시·담당자 알림·DONE은 같은 짧은 트랜잭션으로 반영한다. 외부 HTTP는 DB 트랜잭션 밖이다.

## 데이터와 남은 공동 연동

기존 staged `db/issue-schema/issue-sync-jobs.sql`에 CREATE/team_id/request_key/created_at/nullable issue_id를 반영한다. 자동 Flyway 이력은 수정하지 않는다. B 공유 테이블 이후 C11·12 SQL과 함께 정식 편입해야 하며 실제 개발/공용 DB에 임의 적용하지 않는다. 총 69테이블은 유지한다. ERD 번역본을 고쳤으므로 저장소 밖 한국어 원본에도 반영이 필요하다.

B #217 실제 팀·권한·보드 연결, 정식 DB 적용, 실제 GitHub App 쓰기/수신, 화면의 초안·진행 표시와 실연동은 별도 공동 검증이다. #90 완료를 이 문서만으로 선언하지 않는다.

## 검증

- 최신 dev `1c02b6e`(D #223 포함)를 반영한 기본 Flyway에서 **113개 통과**, 실패·오류·생략 0. 이슈 통합 86개, 템플릿 파서 7개, 기존 관련 회귀 20개다.
- `bootJar` 통과. API·웹 타입 검사와 API 생성 파이프라인 테스트 통과.
- 저장소/조직/기본 템플릿 우선순위, 깨진 YAML·필수 값·다중 기본값, 생성→내부 ID 상세, 같은 초안 재전송, 부분 실패, POST 응답 유실·확인 불가, API 권한, 라벨 유실, KST 한도, 잘못된 보드 선행, 재시도 상한을 검증했다.
- 12번의 작업 조회는 새 team_id 열과 충돌하지 않도록 `issue_team_id` alias를 사용한다. 기존 11·12 회귀도 함께 통과했다.
- 실제 GitHub·개발/공용 DB에는 쓰지 않고 격리 PostgreSQL/Redis·모의 GitHub HTTP를 사용했다. 전체 백엔드 테스트·실 App 쓰기·화면 E2E 성공을 선언하지 않는다.
- p00/p07/p11/p12 기존 생성 파일과 스키마는 유지하고 p13의 네 작업·스키마·Zod·MSW만 추가했다. 기존 스키마가 의미상 동일함을 TypeScript AST로 비교했다.
- 커밋·push·PR 생성은 하지 않았다. 검토 후 팀 규칙의 `feat/13-page-api → dev`, 제목 `feat/13-page-api: 13 이슈 작성·템플릿·생성 진행·복구 API (#90)`, 관련 이슈 `Refs #90`을 사용한다.

공식 API 참고: [GitHub issue 생성](https://docs.github.com/en/rest/issues/issues), [폼 스키마](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema).
