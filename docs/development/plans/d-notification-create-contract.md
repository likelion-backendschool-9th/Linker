# D → 전원: 알림 생성 계약

> 2026-11-05 · 기본 계약 #175, 신고 자동숨김 계약 #186 반영.
> 목적: A·B·C·E가 호출 인자를 확인하는 교차 정렬. 이번 단계에서 알림 호출부를 추가할 필요는 없다.
> 구조·상세 규칙의 기준은 [청사진 §4](../05-backend-blueprint.md#4-controller--service-11)와 [AGENTS.md](../../../AGENTS.md)다.

## 어떤 서비스를 호출하나

| 생산 업무 | 호출 서비스 |
| --- | --- |
| 로그인 사용자 업무(팀 초대 등) | `service.user.NotificationService` |
| 채용 담당자 전용 업무 | `service.recruiter.NotificationService` |
| 운영자 업무 | `service.admin.NotificationService` |
| 신고 최초 자동숨김의 시스템 운영자 알림 | E의 `user.ModerationService` → `admin.NotificationService` (명시적 예외) |

서비스 선택은 **수신자 계정 종류가 아니라 생산 업무** 기준이다. 중립 NotificationService나 역할 간 위임을 새로 만들지 않는다.

## 호출 인자

공통 입력: `dto.notification.request.CreateNotificationCommand`.
각 서비스의 `create(command)`는 저장된 `Notification`을 반환한다. 내부 반환값이며 HTTP 응답으로 Entity를 노출하지 않는다.

| 순서 | 인자 | 의미 |
| --- | --- | --- |
| 1 | `long recipientUserId` | 필수: 수신자 users ID |
| 2 | `String notificationType` | 필수: 종류. `NotificationTypes` 상수 사용 권장. DB enum 아님 |
| 3 | `Long actorUserId` | 선택: 행위자. 시스템 이벤트는 null |
| 4 | `String targetType` | 선택: 업무 대상 종류 |
| 5 | `Long targetId` | 선택: 업무 대상 ID |
| 6 | `String linkPath` | 선택: 클릭 시 이동할 서비스 내 경로 |
| 7 | `String payloadJson` | 선택: JSON 문자열. 객체가 아님 |
| 8 | `String groupKey` | 선택: 그룹 표시용 키. 중복 방지 기능 없음 |

선택 문자열의 공백 값은 null로 정규화한다. 대상 종류·payload 구조는 업무별 기존 계약을 따르고, 미정 값을 임의로 발명하지 않는다.

```java
userNotifications.create(new CreateNotificationCommand(
        recipientUserId, NotificationTypes.TEAM_INVITE,
        actorUserId, null, null, "/invite/" + code, null, null));
```

신고 자동숨김은 `REPORT_AUTO_HIDDEN`, `/admin/reports`, 권장 groupKey `report-auto-hidden:{caseId}`다. 최초 `auto_hidden_at` 설정 때 활성 운영자마다 생성하며 피신고자·신고자에게는 생성하지 않는다. E가 활성 운영자 조회와 동시성·중복 생산 방지를 담당한다.

## 호출자가 알아야 할 동작

- 업무 권한, 대상 가시성, 마케팅 동의, 필요한 차단 필터는 호출자가 확인한다. create는 이를 대신하지 않는다. 수신자 조회는 미존재·삭제만 거르므로, 업무상 활성 상태가 필요하면 호출자가 별도 확인한다.
- 수신자 또는 지정한 행위자가 없거나 삭제됐다면 `404 NOT_FOUND` / `사용자를 찾을 수 없어요`. notificationType이 null·공백이면 `IllegalArgumentException`이다. 별도 새 HTTP 오류 계약을 만들지 않는다.
- 호출자의 트랜잭션에 참여한다. 알림도 함께 롤백되어야 하면 생산 업무에서 트랜잭션을 열고 그 안에서 호출한다.
- 생성은 DB 저장까지다. 푸시·STOMP 전송은 하지 않는다.
- KST 기준 CHAT은 지연 없음. MARKETING은 21:00–08:00, 나머지는 22:00–08:00에 다음 08:00까지 `deliver_after`를 설정한다. 신고 알림도 기존 지연 규칙을 따른다.
- 차단 알림 억제 범위·시각과 채팅 신고 ±10 스냅샷은 별도 조율 사항이다. create가 이미 해결했다고 가정하지 않는다.

## A·B·C·E 확인 요청

아래 문구를 각 담당 이슈에 기록하면 된다. D가 대신 확인 완료를 표시하지 않는다.

```text
[D 알림 생성 계약 확인]
참고: docs/development/plans/d-notification-create-contract.md
- 담당: A / B / C / E
- 사용할 생산 서비스와 이벤트:
- 인자·오류·트랜잭션·야간 지연 규칙: 확인 / 질문 있음
- 기존 기능과 충돌 또는 미정 사항: 없음 / 내용
※ 현재 단계는 계약 확인이며 실제 호출부 구현 완료를 의미하지 않습니다.
```

D 준비물은 이 문서로 마련했다. 실제 팀 전달·이슈 고정과 각 담당 확인은 별도로 기록한다. 인자 변경은 소비자에게 먼저 공유한다. 공식 문서 변경은 저장소 밖 원본에도 반영한다.
