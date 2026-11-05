# 00 스파이크 기록

> 2026-11-05. 이슈 [#200](https://github.com/likelion-backendschool-9th/Linker/issues/200). 페이지 API, 이슈 캐시 핸들러, 빈 `@RateLimit`은 추가하지 않는다.  
> 라이브 호출에 필요한 비밀값이 없으면 호출하지 않는다. 이 PC에는 루트 `.env`가 없다.

## 1. Projects

개인 인증 조회 결과는 [Projects 스파이크](c-projects-spike-results.md)에 있다. 계약 문단에 반영한 결론은 다음과 같다.

- 조회한 기존 보드에는 `Blocked`가 없다.
- 그 보드의 날짜 필드 이름은 `Target date`다.
- 그 보드의 필드 ID는 하드코딩하지 않는다.
- 새 보드의 기본 이름과 기존 보드의 매핑은 [Projects 계약](c-backend-projects-contract.md) §2를 따른다.

날짜 쓰기, Blocked로 바꾼 뒤 OPEN 유지, 설치 토큰 조회, `projects_v2_item` 수신은 하지 않았다.

## 2. 웹훅 페이로드

큐에 넣는 값은 `github_webhook_deliveries.id`의 10진 문자열 하나다. 이벤트 목록과 DB 필드는 [B 교차 계약](b-backend-cross-contracts.md) §2–§3을 그대로 둔다. 새 allowlist나 C 핸들러는 만들지 않는다.

smee ping은 하지 않았다. 저장소에 테스트 채널 주소가 없고, 웹훅 시크릿과 로컬 Spring도 없다. 실제 수신 샘플이 없으므로 B·C 공동 freeze는 아직 아니다.

## 3. 브라우저 STOMP

브라우저에서 `/ws`에 붙이지 않았다. 세션 쿠키를 만들 로그인 API와 로컬 Spring이 없다.

프로토콜 근거는 기존 `StompConnectionTest` 5건이다. 체크리스트의 [D STOMP 연결 검증](../00-foundation-coordination-checklist.md)에 있다. 그 실행은 브라우저가 아니라 테스트가 띄운 서버다.

## 4. Toss

`TOSS_SECRET_KEY`가 없어 테스트 결제 confirm/cancel을 호출하지 않았다. 없는 키로 결제 API를 치지 않는다.

`TossPaymentClientTest` 3건은 2026-11-05에 통과했다. Mock 서버로 confirm·cancel 요청 형태를 본다. 라이브 스파이크와 구분한다.

## 5. 딥링크 문서 확인

현재 코드는 [B 교차 계약](b-backend-cross-contracts.md) §1의 딥링크 항목과 같다.

| 확인 | 코드 |
| --- | --- |
| 복귀 `linker://auth` | `packages/bridge/src/paths.ts`의 `AUTH_REDIRECT_URL` |
| 앱이 저장하는 세션 | `userId`, `userType`만. `messages.ts`의 `AUTH_SESSION_SAVE` |
| `PUSH_TOKEN.token` | 기기 푸시 토큰. 세션 JWT가 아님 |
| 앱 로그인 시작 | `start-github-login.ts`가 authorize URL만 `AUTH_GITHUB_START`로 보냄 |

`GET /api/v1/public/auth/github/authorize-url`은 아직 없다. 페이지 01에서 만든다. 로그아웃 뒤 푸시 토큰을 지우는 순서 차이는 같은 B 문서에 열린 채로 둔다. 이번 단계에서 설정 화면을 바꾸지 않는다.
