# 00 페이지 착수 경계

> 2026-11-05. 이슈 [#201](https://github.com/likelion-backendschool-9th/Linker/issues/201). 선행 1–5단계 뒤에 남는 항목이다. 이 문서는 구현을 시작하지 않는다.  
> 페이지 API와 화면은 여기 포함하지 않는다. 첫 페이지는 03 약관이고, 그다음은 01 로그인이다.

## 페이지가 있어야 닫는 것

| 항목 | 닫는 작업 |
| --- | --- |
| GitHub `authorize-url`, `callback`, 사용자 토큰 복호화 | 01 로그인 |
| WebView 로그인 복귀 | 01. B와 함께 실기기에서 확인 |
| 설치 검증의 실 GitHub 호출 | 08. 00 스파이크 URL과 구분 |
| 로그아웃 | 06 설정 |
| 약관 | 03 |
| 온보딩 | 02. `onb=true` 재발급은 상태 저장 후 |
| 프로필 | 04 조회, 05 수정 |
| 채용 가입·로그인·비밀번호 | 31, 32 |
| 운영 신고 조치 | 25 |
| 알림 `create` 호출부 | 알림을 만드는 각 페이지. 시그니처는 이미 고정 |
| 이슈·보드 캐시 핸들러 | C의 11–15. 00에서 빈 핸들러를 만들지 않음 |
| 채팅 저장 후의 차단 필터 | D의 16·17. 저장 전에는 연결하지 않음 |

## 페이지 전에 아직 열린 확인

선행 단계를 문서로 남겼지만, 아래는 체크를 닫지 않는다.

| 항목 | 이유 |
| --- | --- |
| Sentry·메일·스토리지·호스팅 결정 | [#192](https://github.com/likelion-backendschool-9th/Linker/issues/192)가 열려 있음. 업체를 새로 고르지 않음 |
| 업로드 PUT의 OpenAPI 포함 | [#193](https://github.com/likelion-backendschool-9th/Linker/issues/193). E 확인 전 |
| SSH, Spring 기동, Flyway `V1` | [#198](https://github.com/likelion-backendschool-9th/Linker/issues/198). Redis `PONG`만 확인 |
| 브라우저 STOMP, smee ping, Toss 실호출 | [#200](https://github.com/likelion-backendschool-9th/Linker/issues/200) |
| 웹훅 공동 freeze | 수신 샘플 전 |
| 로그아웃 시 푸시 토큰 순서 | [B 교차 계약](b-backend-cross-contracts.md) §1. 06에서 A·B가 정리 |

D의 접속 확인은 A의 기록으로 대신하지 않는다.
