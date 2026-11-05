# C ↔ D 정책 숫자 계약 — 검토·제안

검토 기준: 원격 dev `04546c93e7fc42eace96507ffe39fa9c1a965e6e` (2026-11-05).
PR 반영 전 `af6cd13ce1f73ceacfe1ee3631bc247c968af0bb`까지 비교했다. Policy·policy.ts·PlanLimits와 지적한 Flex 소비 파일은 변경되지 않았고, 공동 체크 문서에는 D 알림 계약 링크만 추가돼 기존 정책 숫자 대조 결과가 유지된다.
이번 변경은 검토 보고서 추가와 기존 C 문서의 연결 안내뿐이다. 앱 코드·정책 값·서버 상수·이슈는 수정하지 않는다.
AGENTS.md, frontend/AGENTS.md, 관련 양쪽 blueprint와 아래 네 파일을 확인했다.

- [Policy](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/docs/planning/04-policy.md)
- [기존 D 대조 218행 이후](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/docs/development/00-foundation-coordination-checklist.md#L218)
- [policy.ts](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/frontend/apps/web/src/lib/policy.ts)
- [PlanLimits.java](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/backend/src/main/java/com/linker/backend/global/config/PlanLimits.java)

## 1. 결론과 분류

- **일치:** 현재 FE/Java 숫자 18쌍을 재대조해 모두 같음을 확인했다. 조용한 시간의 서버 값도 Policy와 같다.
- **불일치:** 같은 정책의 기존 두 숫자가 다른 사례는 찾지 못했다. 다만 무료 팀 정원과 Flex 기본 요금 포함 인원을 혼용하는 의미 문제가 있다.
- **누락:** D가 기록한 6개 항목은 최신 dev에도 누락 상태다. 같은 숫자의 다른 상수로 대신하면 안 된다.
- **정책 미정:** 1:1 이미지 보관 1년, 가격·이름, AI 하루 10회는 확정으로 표시하지 않는다. Policy 1장·14장에는 숫자 전반의 잠정성도 남아 있다.
- 이 네 분류는 겹칠 수 있다. 예를 들어 AI 10회는 현행 코드 값은 일치하지만 최종 확정 여부는 미정이다.
- 상수 선언과 실제 제한·배치·알림 적용 완료는 다르다. 이번 검토는 실행 동작 전체를 인증하지 않는다.

## 2. 현행 값이 일치하는 항목

| 정책·적용 대상·단위 | FE 키 | Java 키 | 현재 값 |
| --- | --- | --- | --- |
| 채팅 발송 빈도 / 회·초 | CHAT.sendsPerSecond | CHAT_SENDS_PER_SECOND | 5 |
| 실패한 일반 채팅 전송 자동 재시도 / 회 | CHAT.autoRetries | CHAT_AUTO_RETRIES | 3 |
| 오프라인 복귀 메시지 불러오기 상한 / 개 | CHAT.catchUpMax | CHAT_CATCH_UP_MAX | 500 |
| 일반 채팅 텍스트 길이 / 자 | CHAT.messageMax | CHAT_MESSAGE_MAX_CHARS | 2000 |
| 한 번에 보내는 이미지 / 장 | CHAT.imagesPerSend | CHAT_IMAGES_PER_SEND | 10 |
| 본인 메시지 수정 기한 / 시간 | CHAT.editWithinHours | CHAT_EDIT_WITHIN_HOURS | 24 |
| 채용 제안 첫 메시지 / 자 | CHAT.offerMessageMax | CHAT_OFFER_MESSAGE_MAX_CHARS | 1000 |
| 무료 팀 채팅 조회·검색 / 일 | PLAN_LIMITS.teamChatHistoryDays.free | TEAM_CHAT_HISTORY_DAYS_FREE | 60 |
| 일반 리크루터 채용 제안 / 계정당 회·일 | PLAN_LIMITS.recruitingOffersPerDay.free | RECRUITING_OFFERS_PER_DAY_FREE | 10 |
| Scout 채용 제안 / 계정당 회·일 | PLAN_LIMITS.recruitingOffersPerDay.scout | RECRUITING_OFFERS_PER_DAY_SCOUT | 50 |
| Flex 팀 구성원의 AI 요약 / 사람당 회·일 | PLAN_LIMITS.aiSummaryPerDay.flex | AI_SUMMARY_PER_DAY_FLEX | 10, 잠정 |
| Pro 월 요금 / 원·월 | SUBSCRIPTION_PRICE.proMonthly | PRO_MONTHLY_KRW | 2900, 잠정 |
| Flex 기본 요금 / 팀당 원·월 | SUBSCRIPTION_PRICE.flexMonthly | FLEX_BASE_MONTHLY_KRW | 7900, 잠정 |
| Flex 7번째부터 추가 인원 / 사람당 원·월 | SUBSCRIPTION_PRICE.flexExtraMember | FLEX_EXTRA_SEAT_KRW | 1900, 잠정 |
| Scout 월 요금 / 원·월 | SUBSCRIPTION_PRICE.scoutMonthly | SCOUT_MONTHLY_KRW | 14900, 잠정 |
| 체험 기간 / 일 | SUBSCRIPTION_PRICE.trialDays | SUBSCRIPTION_TRIAL_DAYS | 7 |
| 미사용 혜택 결제 환불 기한 / 일 | SUBSCRIPTION_RULES.refundWithinDays | PAYMENT_REFUND_WITHIN_DAYS | 7 |
| Flex 종료 후 기록·원본 유지 유예 / 일 | SUBSCRIPTION_RULES.flexGraceDays | FLEX_POST_EXPIRY_GRACE_DAYS | 30 |

Policy 근거: 2장 127·129·133·140행, 8장 446–455·487–489·506·521행, 11장 626·644–648·680·683·686행.
조용한 시간은 일반 비채팅 알림 22:00–08:00, 마케팅 21:00–08:00 KST이며 PlanLimits 46–49행과 역할별 NotificationService가 참조한다. CHAT은 이 대기 계산의 예외다.
프론트에서 조용한 시간을 계산·검증하지 않는다면 같은 상수를 억지로 만들 필요는 없다.

의미상 주의:
- 채팅 5회/초와 채팅방 공유 10회/분·100회/일은 서로 다른 제한이다.
- 무료 팀 60일은 메시지 삭제 기한이 아니라 조회·검색 범위다. Flex는 전체 기록이며 null 무제한과 0을 구분한다.
- AI 10회는 팀 전체 공유 한도가 아니라 Flex 팀 구성원별 한도다. KST 00:00 초기화, 실패는 차감하지 않음, 1:1 제외.
- 무료 팀의 AI 0과 Flex 체험은 모순되지 않는다. 체험 중에는 서버의 Flex 이용 자격을 적용해야 하며 별도 무료 AI 잔여량을 만들지 않는다.
- 실제 화면 가격은 API 응답을 기준으로 한다. SUBSCRIPTION_PRICE는 목업·초기 계약용이며 운영 가격을 상수로 강제하지 않는다.
- 체험 7일은 Pro 계정당 1회, Flex 팀당 1회이고 Scout는 체험이 없다.

## 3. 기록된 누락 6개와 권장안

아래 키 이름은 제안이다. 적용·승인 완료를 뜻하지 않는다. 정책에 적힌 현재 값을 바꾸지 않는다.

| 항목 | 현재 누락 | 권장 FE 키 | 권장 Java 키 | 값·단위 및 적용 대상 |
| --- | --- | --- | --- | --- |
| Pro 연 요금 | Java | 기존 SUBSCRIPTION_PRICE.proYearly 유지 | PRO_YEARLY_KRW | 29000 원/년. 현재 잠정 요금 |
| 결제 실패 유예 | FE | SUBSCRIPTION_RULES.paymentFailureGraceDays | 기존 PAYMENT_FAILURE_GRACE_DAYS 유지 | 7일. 결제 재시도 중 혜택 유지 |
| 무료 팀 채팅 이미지 원본 보관 | 양쪽 | CHAT.teamImageOriginalRetentionDaysFree | TEAM_CHAT_IMAGE_ORIGINAL_RETENTION_DAYS_FREE | 90일. 무료 팀 이미지 원본만. 미리보기·메시지 전체의 삭제 기한 아님 |
| AI 요약 결과 보관 | 양쪽 | AI_SUMMARY.resultRetentionDays | AI_SUMMARY_RESULT_RETENTION_DAYS | 7일. 개인 요약 결과만. 채팅에 공유한 카드에는 적용하지 않음 |
| Flex 종료 사전 알림 | 양쪽 | SUBSCRIPTION_RULES.flexEndNoticeDaysBefore | FLEX_END_NOTICE_DAYS_BEFORE | 종료 7일 전. 팀 전체 알림 |
| Flex 유예 종료 사전 알림 | 양쪽 | SUBSCRIPTION_RULES.flexGraceEndNoticeDaysBefore | FLEX_GRACE_END_NOTICE_DAYS_BEFORE | 30일 유예의 종료 7일 전. 위 알림과 별개 시점 |
| 채팅방 공유 분당 한도 | 양쪽 | CHAT.shareToRoomPerMinute | CHAT_SHARE_TO_ROOM_PER_MINUTE | 10회/분. 일반 메시지 발송 한도와 분리 |
| 채팅방 공유 일일 한도 | 양쪽 | CHAT.shareToRoomPerDay | CHAT_SHARE_TO_ROOM_PER_DAY | 100회/일. 분당 한도와 동시 적용할 기준 |

필요 여부:
- Java 정책 키는 해당 가격 계산·정리 작업·제한·알림 기능을 구현할 때 하드코딩을 막기 위해 필요하다. 이번에는 기능이나 미사용 상수를 추가하지 않는다.
- FE 키는 해당 숫자를 화면 설명·검증·목업에서 실제 소비할 때 필요하다. 서버 전용 정리·발송 작업에만 쓰는 숫자를 FE에 반드시 복제할 필요는 없다.
- 결제 실패 유예 7일과 Flex 종료 후 보관 유예 30일을 같은 키로 합치지 않는다.
- 이미지 원본 90일은 Flex 유지 중에는 적용하지 않으며, 종료 후 30일 유예와 결합한 정리 순서를 Policy 686행 기준으로 확인한다.
- 이미지 보관의 기산 시각, 공유 제한의 계수 주체(사용자/방 등)와 시간 창은 본문 수치만으로 모두 정해지지 않는다. 구현 전에 C·D가 확인할 세부 기준으로 남긴다.

## 4. 추가 발견: 같은 6명이지만 서로 다른 정책

Policy 644행의 Flex 기본 요금 포함 인원 6명과 645행의 무료 팀 최대 정원 6명은 적용 대상이 다르다.
Java는 FLEX_INCLUDED_SEATS=6을 따로 둔다. FE는 PLAN_LIMITS.teamMembers.free=6을 아래 Flex 요금 설명·계산에 재사용한다.

- [plan-selector.tsx 153행](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/frontend/apps/web/src/app/%28member%29/subscribe/_components/plan-selector.tsx#L153)
- [p28-subscribe.ts 57행](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/frontend/apps/web/src/mocks/pages/p28-subscribe.ts#L57)
- [p09-team-settings.ts 71행](https://github.com/likelion-backendschool-9th/Linker/blob/04546c93e7fc42eace96507ffe39fa9c1a965e6e/frontend/apps/web/src/mocks/pages/p09-team-settings.ts#L71)

현재 산출액이 틀렸다는 발견은 아니다. 그러나 무료 정원이 바뀌면 유료 가격까지 함께 바뀌는 결합이다.
제안: FE에 SUBSCRIPTION_RULES.flexIncludedSeats=6을 별도로 두고 위 세 소비 지점의 Flex 용도만 바꾼다.
무료 팀 가입 제한은 기존 PLAN_LIMITS.teamMembers.free를 유지한다. Java FLEX_INCLUDED_SEATS는 그대로 둔다.
기존 D 대조 238행도 ‘숫자 일치’와 ‘독립된 의미 키 부족’을 구분해 보완할 필요가 있다.

## 5. 정책 본문과 미정 목록의 관계

| 정책 | 근거 위치 | 판단·제안 |
| --- | --- | --- |
| 1:1 이미지 원본 1년 | 8장 526행, 14장 747행 | 모두 잠정으로 명시. 아직 확정 상수를 추가하지 않음. 1년을 임의로 365일로 바꾸지 않음 |
| 요금·플랜 이름 | 11장 626·640·644·655행은 금액·이름 제시, 14장 753행은 최종 미확정 | 현재 계약 초안 값은 일치하지만 확정은 아님. Pro 연 가격도 전체 요금 확정과 묶어 확인 |
| AI 하루 10회 | 2장 133행·11장 648행에는 10, 8장 506행은 tentative, 14장 752행도 미확정 | 최종값으로 선언하지 않음. 기존 D 문서 261행의 ‘14장만 잠정’ 표현은 부정확하여 보완 필요 |
| 숫자 전반 | 1장 13행은 모든 숫자 잠정, 14장 744행은 최종화 미체크 | 지금 비교는 현행 작업 기준의 정합성 검토다. 누락값을 코드에 추가해도 제품 정책 승인으로 간주하면 안 됨 |

서로 다른 숫자가 충돌한다기보다 **본문의 현행 기준과 최종 확정 상태가 분리되지 않은 문서 상태**다.
팀이 확정한 뒤 본문·미정 목록·공통 대조표를 함께 정리하고, 저장소 밖 한국어 원본도 맞춰야 한다.

## 6. 범위 내 추가 누락 후보 — 이번에 구현하지 않음

기록된 6개가 채팅·알림·구독의 모든 숫자를 포괄하는 것은 아니다.
실제 해당 기능을 구현할 때 아래도 별도 의미 키가 필요한지 확인한다.

- AI 요약: 최소 20개·최대 500개, 30초 후 대기 안내, 실패 재시도 1회, 사용 안내 배너 첫 7일(8장 505·511·515행). 일반 채팅 catchUpMax=500·autoRetries=3을 재사용하지 않음. AI 세부는 C와 조율.
- 채용 요청: 응답 대기/만료 30일과 거절 후 재제안 제한 30일(8장 489·490행). 같은 30이라도 다른 시점·용도.
- 알림: 마감 하루 전 09시(8장 454행), 체험 종료 하루 전(11장 680행), 연 갱신 7일 전·가격 인상 30일 전(681행).
이 목록은 후속 적용 시 확인할 사항이며 이번 검토를 기능 확장 작업으로 바꾸지 않는다.

## 7. 합의 후 누가 어떤 파일을 바꿀지

| 담당 | 수정 후보 파일 | 할 일 |
| --- | --- | --- |
| C | frontend/apps/web/src/lib/policy.ts | 필요한 FE 키 추가, 기존 값 유지, Flex 포함 인원 의미 분리 |
| C 및 소비 화면 담당 D | plan-selector.tsx, mocks/pages/p28-subscribe.ts, mocks/pages/p09-team-settings.ts | 위 Flex 용도 3곳의 키 참조 교체. 페이지 동작 추가가 아니라 정책 참조 정리 |
| D | backend/src/main/java/com/linker/backend/global/config/PlanLimits.java | 합의한 서버 대응 키 추가. 기존 요금·한도 임의 변경 금지 |
| C·D | docs/development/00-foundation-coordination-checklist.md의 D 정책값 대조 | 238행 의미 혼용, 261행 잠정 근거 및 각 누락 상태 보완 |
| 정책 담당자·팀 | docs/planning/04-policy.md 및 저장소 밖 원본 | 미정 항목 승인 후 일관되게 반영. 이번 검토에서 미정 체크 해제하지 않음 |

프론트 공통 상수 소유 C와 구독 화면 소유 D가 변경 위치를 공유하고, 역할별 서비스 구현 규칙은 그대로 따른다.
새 API·DB·정리 배치·알림 발송·페이지 기능·전체 테스트 확장은 이번 범위가 아니다.

## 8. 재확인 방법·결과

- 최신 dev SHA를 조회하고 해당 커밋의 네 기준 파일 및 상수 소비 코드를 git show/git grep으로 확인했다.
- 읽기 전용 대조 스크립트로 FE/Java 기존 숫자 18쌍을 확인해 전부 같았다. 의미까지 자동 검증한 결과라고 하지 않는다.
- 기존 D 대조 문구를 재사용해 결론 내리지 않고 실제 코드·Policy 행 번호와 대조했다.
- 검토 시 앱 코드를 변경하거나 이슈 댓글을 게시하지 않았다. PR에는 이 보고서와 검토 안내 링크만 추가하며, 정책 상수·페이지·서버 로직은 변경하지 않는다.

## 9. 이슈에 공유할 확인 문구 — 아직 게시하지 않음

### 순서 4 C↔D 정책 숫자 검토 — 제안, 코드 변경 없음

dev `04546c9` 기준으로 대조했으며, PR 반영 전 `af6cd13`까지 정책 숫자 변경이 없음을 재확인했습니다.

- 기존 숫자 18쌍은 일치합니다. 기록된 누락 6개도 현재 남아 있습니다. 일치한 값은 변경할 필요가 없습니다.
- 추가로 FE가 무료 팀 정원 6명을 Flex 기본 요금 포함 인원에도 재사용합니다. 현재 금액 오류는 아니지만 별도 `SUBSCRIPTION_RULES.flexIncludedSeats=6`으로 의미 분리를 제안합니다. Java의 `FLEX_INCLUDED_SEATS`는 유지하면 됩니다.
- 누락 키·값·단위는 C/D가 맞춘 뒤 FE는 `policy.ts`, 서버는 `PlanLimits`에서 관리하고 필요한 소비 코드만 참조하도록 제안합니다. 서버 전용 숫자를 FE에 무조건 복제하지는 않습니다.
- 1:1 이미지 1년, 가격·이름, AI 10회는 최종 확정으로 표시하지 않습니다. 특히 AI는 Policy 8장에도 잠정이라고 명시돼 있어 D 대조표의 ‘14장만 잠정’ 문구 보완이 필요합니다.
- 공유 제한의 계수 주체·시간 창, 원본 보관 기산점 등은 숫자만으로 확정하지 않고 확인 후 반영하겠습니다.

현재는 검토·제안만 했습니다. 정책·코드 변경, 알림 생성, 공동 freeze 확정은 하지 않았습니다.
