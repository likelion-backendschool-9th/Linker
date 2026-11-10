# 1단계: `/api/v1`, 클래스 이름, Entity 구조

상태: 완료 (PR #244 코드, PR #245 CI 규칙)

0단계 규칙을 실제 코드에 적용했다. URL, `@Tag`, `operationId`, STOMP 목적지, 동작은 바뀌지 않는다.

## 변경 내용

| 항목 | 내용 |
| --- | --- |
| `/api/v1` 전역 접두어 | `global/config/WebConfig`가 `addPathPrefix`로 붙인다. 컨트롤러 18개의 `@RequestMapping`에서 제거. 웹훅 컨트롤러는 자체 매핑 유지 |
| 경로 상수 | `global/config/ApiPaths`. `SecurityConfig`, 보안 필터 4개, `UserUploadService`가 사용 |
| 클래스 이름 | `Public*Controller/Service`의 `Public` 접두어 제거. `user/`, `recruiter/`, `admin/` 폴더의 컨트롤러·서비스도 역할 접두어 제거(`user/TeamService`). `PublicRateLimitFilter` → `RateLimitFilter`, `PublicReadRateLimiter` → `ReadRateLimiter` |
| 빈 이름 | 이름이 폴더마다 겹치므로 역할 폴더의 모든 컨트롤러·서비스에 폴더로 시작하는 빈 이름을 명시한다(`@Service("userTeamService")`). 루트 클래스는 기본 이름 |
| `AdminController` | `admin/ModerationController`, `admin/ModerationService`로 변경 (OTP, 신고 케이스, 이의 신청) |
| Entity | `BaseTimeEntity`, `@EnableJpaAuditing` 삭제. Entity 45개가 `createdAt`/`updatedAt`을 직접 선언. `ChatMessage.replaceCreatedAt`은 `ChatMessage` 안으로 이동 |
| `type/` | 비-`@Entity` 32개를 `entity/{업무}/type/`으로 이동 |
| 폴더 정리 | `RecruitCardMapper`를 `dto/recruit/mapper/`로 이동, 빈 `service/recruit/` 삭제 |
| 문서 | `AGENTS.md`, `05-backend-blueprint` §3–§4, WBS, plans의 규칙·클래스 이름 갱신 |

CI 규칙(#245): `pr-rules`(PR 제목 형식, 한국어 설명, 브랜치 type 일치, 에이전트 표시 검사), `assign-author`(PR 작성자를 Assignee로 지정), `commit-msg` 훅 확장(`frontend`의 `pnpm install` 때 자동 설치).

## 새 규칙 요약 (이름과 빈 이름)

- 루트(public) 컨트롤러·서비스: 접두어 없음, 기본 빈 이름. 예: `AuthController`, `AuthService`.
- `user/`, `recruiter/`, `admin/`: 접두어 없음, **빈 이름 명시**. 예: `user/TeamService` + `@Service("userTeamService")`.
- 같은 이름이 한 파일에서 겹치면 한쪽은 풀네임으로 쓴다(`user.ModerationService`가 `admin.NotificationService`를 쓰는 곳).
- 컨트롤러는 같은 그룹의 짝 서비스를 호출한다(같은 이름 줄기).
- 자세한 규칙: `AGENTS.md`, `docs/development/05-backend-blueprint.md` §3–§4.

## 검증

- 전체 테스트 통과(변경 전 454개, 변경 후 동일. 경로 비교용 임시 테스트 1개 제외).
- 변경 전후 핸들러 경로 목록과 `/v3/api-docs` JSON 동일.

## 남은 확인과 후속 과제

- **웹훅 등록 URL**: 앱 소유자 확인 필요(0단계 문서 참고).
- **서비스 접두어 제거 방침**: 강사님 확인이 필요하다. 달라지면 서비스 쪽만 되돌린다.
- **`RecruitCardMapper`**: `toAuthor`, `toAuthorCard`는 post 서비스에서도 쓰므로 책임 분리를 검토한다.
- **접두어가 남은 클래스**: `UserIssueAccess`처럼 Service/Controller로 끝나지 않는 클래스.
- **`ModerationController` 분리**: OTP, 신고 케이스, 이의 신청을 나눌지는 후속에서 정한다(나누면 컨트롤러 수 29와 엔드포인트 합계 205 등 문서 합계를 같이 고친다).
- **import 순서**: 이름 변경으로 순서가 어긋난 파일이 있을 수 있다. 포매터·린터가 있으면 한 번 정리한다.
- **프론트 문서**: `frontend/AGENTS.md`와 `03-frontend-blueprint`의 프론트 규칙은 건드리지 않았다(컨트롤러 이름 표기만 치환). 3단계에서 확인한다. 생성 API 클라이언트는 URL이 같아 영향이 없을 것으로 본다.
- **저장소 설정**: `pr-rules`를 Required status check로 지정해야 규칙 위반 PR의 머지가 막힌다.
