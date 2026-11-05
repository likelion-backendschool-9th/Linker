# 00 구현 계약 freeze

> 2026-11-05. 이슈 [#193](https://github.com/likelion-backendschool-9th/Linker/issues/193). 코드를 바꾸지 않고 현재 구현을 기준 문장으로 고정한다.  
> 변경은 이 문서와 연결 이슈에 적고 전원 멘션 후 반영한다. claim만으로 서버 권한을 부여하지 않는다.  
> 근거: `JwtSessionTokens`, `SessionCookies`, `SessionClaims`, `ApiErrorBody`, `handleApiError`, `PlanLimits`, `policy.ts`, `CreateNotificationCommand`, `PublicCatalogService`.

## 1. JWT claim

서명 알고리즘은 RS256이다. 세션 쿠키 값의 SHA-256만 DB에 저장한다.

| Claim | 의미 | 허용 값 |
| --- | --- | --- |
| `sub` | `users.id` 문자열 | 비어 있지 않음 |
| `typ` | 가입 유형. `user_type` | `DEVELOPER`, `RECRUITER` |
| `adm` | `admins` 행이 있는지 | boolean. 운영 OTP 통과가 아님 |
| `onb` | 화면 분기용 온보딩 완료 | boolean. `users.onboarded_at`이 있으면 true |
| `st` | 계정 상태 | `ACTIVE`, `SUSPENDED`, `WITHDRAWING` |

추가로 `jti`, `iat`, `exp`가 있다. `jti`는 서명마다 새 값이다.

재발급:

- `POST /api/v1/public/auth/refresh`는 유효한 세션이면 항상 쿠키를 교체하고 204를 반환한다. 없거나 삭제된 세션은 401 `LOGIN_REQUIRED`다. 교체 전 쿠키는 거부한다.
- 그 외 인증 요청은 claim이 DB와 다르거나, 만료가 30일 목표의 마지막 1일 안이면 쿠키를 교체한다.
- 정지 변경은 다음 인증 요청에서 claim을 다시 쓴다. 통합 테스트로 확인했다.
- 온보딩 프로필 저장이 `users.onboarded_at`을 찍으면, 그 응답에서 `onb=true` 쿠키를 다시 발급한다.

`GET /api/v1/user/me` 본문은 `userId`, `login`, `userType`, `isAdmin`, `status`, `onboarded`, `suspendedUntil`이다. `isAdmin`은 `adm`과 같이 `admins` 행이며 OTP 완료가 아니다.

## 2. 세션 쿠키

| 속성 | 현재 값 |
| --- | --- |
| 이름 | `linker_session` (`SESSION_COOKIE_NAME`) |
| HttpOnly | 항상 true |
| SameSite | Lax |
| Path | `/` |
| Max-Age | 30일 |
| Secure | 운영은 true. 로컬 기본은 `SESSION_COOKIE_SECURE=false` |
| Domain | 운영은 부모 도메인. 로컬 기본은 빈 값이라 Domain을 붙이지 않음 |

JWT와 GitHub 토큰은 브리지와 URL에 넣지 않는다.

## 3. 공통 에러

본문은 `{code, message, detail}`이다. `detail`은 없을 수 있다. 500은 예외 문장을 반환하지 않고 `INTERNAL_ERROR`와 `잠시 후 다시 시도해 주세요`를 쓴다.

| code | HTTP | `handleApiError` |
| --- | --- | --- |
| `LOGIN_REQUIRED` | 401 | 로그인 시트. 메시지 `로그인이 필요해요` |
| `FORBIDDEN` | 403 | 화면이 처리 |
| `DEVELOPER_ONLY` | 403 | 토스트 |
| `TEAM_ROLE_REQUIRED` | 403 | 화면이 처리 |
| `SUSPENDED` | 403 | 정지 배너. 읽기(GET/HEAD/OPTIONS)와 refresh는 허용 |
| `VALIDATION_ERROR` | 400 | 화면이 처리. 필드 검증의 `detail.fields` |
| `NOT_FOUND` | 404 | 화면이 처리 |
| `STATE_CONFLICT` | 409 | 화면이 처리 |
| `RATE_LIMITED` | 429 | 토스트. `detail.retryAfterSeconds` |
| `UNAUTHORIZED` | 401 | 웹훅 서명 실패 전용. 로그인 시트로 보내지 않음 |
| `METHOD_NOT_ALLOWED` | 405 | 화면이 처리 |
| `SERVICE_UNAVAILABLE` | 503 | 화면이 처리 |
| `STORAGE_UNAVAILABLE` | 503 | 화면이 처리 |
| `PAYMENT_UNAVAILABLE` | 503 | 화면이 처리 |
| `INTERNAL_ERROR` | 500 | 화면이 처리 |

`PLAN_LIMIT`와 `GITHUB_UNAVAILABLE`은 프론트 분기에만 있다. 서버가 이 코드를 내기 시작하면 같은 `detail` 이름을 쓴다. `PLAN_LIMIT`는 `detail.reason`이다.

## 4. 기술 태그·직군

| API | 본문 |
| --- | --- |
| `GET /api/v1/public/tech-tags` | `[{id, name}]`. `id`는 숫자, 정렬은 `sort_order`, `id` |
| `GET /api/v1/public/job-categories` | `[{key, label}]`. `key`는 `JobCategory` 이름 |

직군 키는 `FRONTEND`, `BACKEND`, `FULLSTACK`, `MOBILE`, `DATA_AI`, `DEVOPS`, `GAME`, `EMBEDDED`, `SECURITY`, `QA`다. 응답은 공개 캐시 1일이다.

## 5. 숫자

화면은 `frontend/apps/web/src/lib/policy.ts`, 서버는 `PlanLimits`만 쓴다. 같은 항목의 현재 값은 같다. 가격과 Flex AI 하루 10회는 Policy상 잠정이다.

양쪽에 있는 값: 사이트맵 50000, 이미지 10MB·긴 변 2048, 운영 OTP 30분, 채팅 5회/초·2000자·10장·24시간·제안 1000자·재시도 3·복구 500·공유 10회/분·100회/일, 무료 팀 기록 60일, 무료 팀 이미지 원본 90일, AI 결과 7일, 제안 10/50, AI 10회/일, Pro 2900·29000, Flex 7900·추가 1900·포함 6명, Scout 14900, 체험 7일, 환불 7일, 결제 실패 유예 7일, Flex 유예 30일, 종료 알림 7일 전. 조용한 시간은 서버만 계산한다. 일반 22:00–08:00, 마케팅 21:00–08:00 KST.

한쪽에만 있는 키는 그 파일을 유지한다. 페이지에서 세 번째 숫자 상수를 만들지 않는다.

## 6. 알림 생성

호출은 생산 업무의 역할 서비스만 사용한다.

| 생산 업무 | 서비스 |
| --- | --- |
| 로그인 사용자 업무 | `UserNotificationService` |
| 채용 담당자 업무 | `RecruiterNotificationService` |
| 운영자 업무 | `AdminNotificationService` |
| 신고 최초 자동숨김 | `UserModerationService`가 `AdminNotificationService.create` 호출 |

인자는 `CreateNotificationCommand` 순서대로 `recipientUserId`, `notificationType`, `actorUserId`, `targetType`, `targetId`, `linkPath`, `payloadJson`, `groupKey`다. 상세 동작은 [알림 생성 계약](d-notification-create-contract.md)과 청사진 §4를 유지한다. 이 freeze는 호출부를 추가하지 않는다.

## 7. 이미 고정된 차단

`user_blocks`는 [차단 계약](e-block-contract-freeze.md)을 유지한다. 해제는 행 삭제가 아니라 `unblocked_at` 설정이다.

## 8. 이번 freeze에서 열어둠

- `PUT /api/v1/user/uploads/{fileId}/content`는 로컬 스토리지 대역이다. WBS 업로드 API 2개에 없고, 공개 스펙에서도 뺐다. OpenAPI 포함 여부는 E 확인 전이다.
- OpenAPI `@Tag`는 [00 OpenAPI 태그](00-openapi-tags.md)로 고정했다.
- 웹훅 이벤트·큐 payload 공동 freeze, Sentry, 메일·스토리지 업체는 각 단계 이슈에 남긴다.
