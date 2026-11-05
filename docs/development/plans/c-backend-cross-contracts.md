# 백엔드 00 C — 순서 4 교차 계약 확인

2026-11-05, `976d380` 코드 기준. 담당 C, 확인 대상 B·D. B의 [#184 리뷰](https://github.com/likelion-backendschool-9th/Linker/pull/184#pullrequestreview-5779375943)와 [#183 확인 기록](https://github.com/likelion-backendschool-9th/Linker/issues/183)을 반영했다.
순서 3 산출물을 연결 규칙으로 정리하는 단계다. 새 API·테이블·핸들러·토큰 공급·알림 발송은 추가하지 않는다.

| 경계 | 이번 C 확인 | 공동 확정 상태 |
| --- | --- | --- |
| B ↔ C 웹훅 | 현재 delivery로 원본 식별·재조회가 가능한 경로와 소비 기준 작성 | 필드·큐·비대상 처리·직렬화 방향 B 확인. 실제 수신·보관 정책·구현 검증은 별도 |
| C ↔ D 숫자 | Policy·화면 상수·서버 상수의 값·단위 대조 | 대응 키가 없는 항목은 D 확인 대기 |
| D → C 알림 | 현재 command와 역할별 create 계약 확인 | 이번에는 기록만 함. 알림 생성·발송 없음 |

근거: [B 교차 계약](b-backend-cross-contracts.md), [C Projects 계약](c-backend-projects-contract.md),
[C 실조회 결과](c-projects-spike-results.md), [공동 체크 및 D 정책 대조](../00-foundation-coordination-checklist.md),
[Policy](../../planning/04-policy.md), [ERD](../01-erd.md).

## 1. B → C 전달 정보에 대한 답변

**원본을 식별하고 다시 조회할 입력으로 사용할 수 있다. 큐에 이슈·상태·날짜 필드를 추가할 필요는 없다.**
다만 payload만으로 내부 팀 ID가 확정되거나 캐시가 갱신되는 것은 아니다. 검증된 연결 조회와 업무 저장은 후속 구현이다.

| 입력 | C 소비 기준 |
| --- | --- |
| 큐 `deliveryRowId` | 저장 행을 찾아 전달받는 용도. GitHub delivery ID·issue ID와 구분 |
| `deliveryId` | 전달 중복 추적. 서로 다른 delivery가 같은 이슈를 바꿀 수 있음 |
| `event`, `action` | event별 소비자를 고르고 action으로 업무 분기. 누락·잘못된 타입은 성공으로 간주하지 않음 |
| `installationId` | 외부 GitHub 설치 ID. 내부 `github_installations.id`로 바로 사용하지 않음 |
| `payload` | 서명 검증 후 저장한 JSON 의미를 읽음. 공백·키 순서 보존이나 재직렬화 후 서명 검증에 의존하지 않음 |
| B `status/attempts/updated_at` | 전달·재시도 정보. 이슈나 Projects의 최신 버전을 판단하는 값으로 사용하지 않음 |

현재 [GithubWebhookService](../../../backend/src/main/java/com/linker/backend/integration/github/GithubWebhookService.java)의
`dispatch`는 `Propagation.NEVER`이며 handler에 바깥 DB 트랜잭션을 넘기지 않는다.
[GithubAppClient](../../../backend/src/main/java/com/linker/backend/integration/github/GithubAppClient.java)의
`installationReadToken(installationId)`를 외부 호출 전에 사용한다. 현재 요청 권한에는 `organization_projects: read`가 있다.
코드에서 이 연결점을 확인한 것이며 실제 App 권한으로 Projects 호출이 성공한 증거는 아니다.

## 2. 원본 JSON 경로와 내부 식별자 연결

아래 경로는 GitHub Octokit 공개 스키마를 대조한 소비 기준이다. 실제 팀 App 수신 샘플과 동일하다고 검증한 것은 아니다.
스키마가 제공하는 필드도 수신 시 타입·존재 여부를 확인한다. `installation`·`organization`이 없을 가능성을 고려한다.

| JSON 경로 | 의미와 사용 |
| --- | --- |
| `installation.id` | App 설치 숫자 ID. envelope의 installationId와 일치 여부 확인 |
| `organization.id` | 조직 숫자 ID. 검증된 설치·팀 연결의 조직과 비교 |
| `repository.id`, `repository.node_id` | `issues` 이벤트의 저장소 숫자/node ID. 현재 팀에 연결된 저장소인지 확인 |
| `issue.id`, `issue.node_id`, `issue.number` | 이슈 전역 숫자/node ID 및 저장소 안 번호. ERD의 `github_issue_id`, `github_node_id`, `(repo_id, number)`에 대응 |
| `issue.updated_at` | Issues 원본 변경 시각. Projects의 필드 변경 시각과 동일하다고 가정하지 않음 |
| `projects_v2_item.project_node_id` | 보드 node ID. `team_project_boards.github_project_node_id`와 연결 |
| `projects_v2_item.node_id` | 프로젝트 item node ID. `issues.project_item_id`와 연결. item의 숫자 `id`와 구분 |
| `projects_v2_item.content_type` | `Issue` / `PullRequest` / `DraftIssue`. `Issue`만 이슈 캐시 대상 |
| `projects_v2_item.content_node_id` | 연결 콘텐츠 node ID. Issue일 때 이슈 조회에 사용. 저장소는 재조회 결과로 보완 |
| `projects_v2_item.updated_at`, `archived_at` | Projects 항목 변경·보관 정보. Issues의 `updated_at`으로 대체하지 않음 |
| `changes.field_value.field_node_id`, `.field_type` | `edited`에서 바뀐 필드의 식별 힌트. 새 상태·날짜 값이 있다는 뜻이 아님 |

확인 순서는 **설치 → 조직 → 연결된 팀/보드 → 접근 가능한 저장소 → 대상 이슈**다.
프로젝트 이벤트에 repository가 없으면 콘텐츠를 GraphQL로 조회해 보완한다. 다른 팀의 캐시를 임의로 만들지 않는다.
필수 식별자가 없거나 설치·조직·보드 관계를 검증하지 못하면 대상 확정 실패로 남긴다.
`sender`만으로 Linker 사용자 권한이나 팀 소속을 판단하지 않는다.

## 3. C의 event/action 소비안

이 표는 후속 소비자의 업무 기준 제안이다. 이번에 핸들러를 등록하거나 B의 인입 allowlist를 바꾸지 않는다.

| event / action | 소비 기준 |
| --- | --- |
| `issues`: `opened`, `edited`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled` | 설치·저장소·이슈를 확인하고 원본 재조회. 제목·본문·OPEN/CLOSED·담당자·라벨을 캐시에 반영할 입력으로 사용 |
| `issues`: `deleted` | 검증된 기존 연결에 한해 삭제 이벤트를 식별. 지연된 이전 이벤트로 삭제 상태를 되돌리지 않음 |
| `issues`: `transferred` | `changes.new_issue`, `changes.new_repository`도 확인. 새 저장소 권한·팀 연결 재검증 후 이전/새 식별자를 정리하는 후속 처리 필요 |
| `issues`: `locked`, `unlocked`, `milestoned`, `demilestoned`, `pinned`, `unpinned` | 검증 후 현행 소비 범위 밖으로 명시 분류한 action은 업무 변경 없이 정상 반환할 수 있음. 미지원·잘못된 필드·미해결 연결은 이 성공 분기에 섞지 않음 |
| `projects_v2_item`: `created`, `edited`, `converted`, `restored` | 보드·item·콘텐츠를 확인하고 현재 상태/날짜/멤버십 재조회. `converted`는 Issue로 바뀐 콘텐츠 기준 |
| `projects_v2_item`: `deleted` | 보드에서 항목이 제거된 것과 GitHub 이슈 삭제를 구분. 재검증 후 연결 item과 보드 상태·날짜를 정리할 기준으로 사용 |
| `projects_v2_item`: `archived` | 보관을 이슈 CLOSED/삭제로 바꾸지 않음. 현행 캐시에 별도 보관 상태가 없어 노출·멤버십 취급은 B·C 확인 필요 |
| `projects_v2_item`: `reordered` | 현행 이슈 목록은 마감 우선 정렬이므로 순서 자체를 저장하지 않음. 검증 후 비대상으로 명시 분류해 정상 반환하는 기준에 B 동의 |
| 기타 event / 알 수 없는 action | 다른 담당자 이벤트를 C가 대신 처리하지 않음. 미지원·잘못된 입력과 의도적 비대상을 구분하고 처리 결과를 B와 맞춤 |

상태는 [기존 C 계약](c-backend-projects-contract.md)의 TODO/IN_PROGRESS/BLOCKED/DONE/OTHER/NONE을 유지한다.
새 날짜 값·선택 옵션 ID는 item의 `fieldValues`를 조회해서 읽는다. 기존 보드의 실제 필드 ID와 매핑을 사용한다.
`changes.field_value`에서 새 값을 임의 추출하거나, 필드 이름을 `Due date`로 고정하지 않는다.

## 4. 중복·지연·실패 처리 기준

- B의 전달은 at-least-once다. C 업무 저장 후 B 완료 표시 전에 중단돼도 재실행 결과가 같도록 저장해야 한다. 이번에는 그 저장 코드를 구현하지 않는다.
- B의 delivery별 advisory lock은 같은 이슈의 서로 다른 delivery 순서까지 보장하지 않는다.
- **B·C 방향 확인:** 같은 이슈의 웹훅·수동·주기 동기화는 모든 인스턴스·진입 경로에 걸쳐 원본 조회 시작부터 DB 반영까지 직렬화한다. 외부 조회를 DB 트랜잭션에 넣지 않고 필요한 DB 변경만 짧게 저장한다. 현재 delivery 잠금이나 DB 저장 단계만의 잠금으로 이 범위가 보장되지는 않는다. 구체적인 구현 수단과 실검증은 후속 저장 구현에서 확인한다.
- Issues의 오래된 `issue.updated_at`은 ERD의 `github_updated_at`보다 최신 값을 덮어쓰지 않도록 확인한다. Projects 변경은 별개이므로 Issues 시각만으로 버리지 않는다.
- Projects의 오래된 이벤트도 무조건 payload를 저장하지 않고 현재 item을 재조회한다. 재조회만으로 동시 저장 순서가 보장되는 것은 아니므로 위 직렬화 기준을 함께 확인한다.
- 삭제된 item·이슈는 재조회 결과와 검증된 삭제 이벤트를 구분한다. 권한 부족·통신 실패·404만으로 이슈 삭제를 확정하지 않는다.
- B 재큐잉 시각을 원본 시각으로 쓰지 않는다. 실패·미연결을 성공으로 표시하는 빈 handler를 등록하지 않는다.

08 보드를 ‘새로 만들기만’으로 줄이는 결정은 **실제 스파이크 실패가 확인된 경우** B와 같은 이슈에서 합의한다.
현재 개인 인증 조회의 성공·제약만으로 실패나 기능 축소를 선언하지 않는다.

## 5. C ↔ D 숫자 대조

[D 채팅·알림·구독 정책 숫자 재검토](c-d-policy-review.md)에 현행 값 18쌍, 기록된 누락 6개, Flex 포함 인원 의미 분리안과 잠정 정책 근거를 정리했다. 검토·제안이며 코드 변경이나 공동 확정은 아니다. 아래 C 이슈 관련 3개 키의 확인 범위와 구분한다.

값의 원천은 [Policy](../../planning/04-policy.md)다. 키 철자가 서로 같아야 한다는 뜻이 아니라 **의미·값·단위가 같은지** 확인한다.
[화면 policy.ts](../../../frontend/apps/web/src/lib/policy.ts)와
[서버 PlanLimits](../../../backend/src/main/java/com/linker/backend/global/config/PlanLimits.java)를 대조했다.

| 기준 | 화면 키 / 값 | 서버 키 / 값 | C 확인 |
| --- | --- | --- | --- |
| 시간대 | `format/time.ts` KST = Asia/Seoul | `APP_ZONE` = Asia/Seoul | 일치 |
| 이미지 최대 바이트 | `IMAGE.maxBytes` = 10 × 1024 × 1024 | `IMAGE_MAX_BYTES` = 동일 | 일치 |
| 이미지 긴 변 | `IMAGE.longSidePx` = 2048px | `IMAGE_LONG_SIDE` = 2048 | 일치 |
| 사이트맵 분할 | `SITEMAP.pageSize` = 50000 | `SITEMAP_PAGE_SIZE` = 50000 | 일치 |
| 운영자 비활동 | `ADMIN.otpIdleMinutes` = 30분 | `ADMIN_OTP_IDLE_MINUTES` = 30 | 일치 |
| Flex AI 요약 | `PLAN_LIMITS.aiSummaryPerDay.flex` = 10회/일 | `AI_SUMMARY_PER_DAY_FLEX` = 10 | 일치. 잠정 여부는 D 기록 유지 |
| 이슈 생성 | `ISSUE.createPerDay` = 100건/일 | 대응 키 없음 | 값 충돌 아님. 키 이름·적용 위치 D 확인 필요 |
| 이슈 담당자 | `ISSUE.assigneesMax` = 10명 | 대응 키 없음 | 같은 기준으로 서버 검증할 위치 확인 필요 |
| 이슈 수동 갱신 | `ISSUE.refreshIntervalSeconds` = 60초 | 대응 키 없음 | 서버 제한 키·단위 D 확인 필요 |

채팅·구독의 기존 일치/누락 목록은 [D 정책값 대조](../00-foundation-coordination-checklist.md#d-정책값-대조-2026-11-05)를 재사용한다.
누락 키를 ‘이미 서버 제한 적용’이라고 표시하지 않는다. C가 D의 PlanLimits나 FE 상수를 임의로 추가하지 않는다.
`null` 무제한과 `0` 허용량 0을 구분한다. 날짜 DATE는 yyyy-MM-dd, 오늘 경계는 KST로 유지한다.

## 6. D → C 알림 인자 확인

실제 공유 입력은 [CreateNotificationCommand](../../../backend/src/main/java/com/linker/backend/dto/notification/request/CreateNotificationCommand.java)다.

| 인자 | 타입 | 기준 |
| --- | --- | --- |
| `recipientUserId` | long | 수신 사용자. 존재·삭제 상태는 서비스 검증 |
| `notificationType` | String | 필수·공백 불가 |
| `actorUserId` | Long | 선택. 값이 있으면 사용자 검증 |
| `targetType` | String | 선택 |
| `targetId` | Long | 선택 |
| `linkPath` | String | 선택 |
| `payloadJson` | String | 선택 |
| `groupKey` | String | 선택 |

C의 이후 로그인 사용자 작업은 `UserNotificationService.create(command)`를 사용한다.
역할별 서비스는 수신자 종류가 아니라 알림을 생산하는 use case 기준이며 중립 NotificationService를 새로 만들지 않는다.
create는 생산 트랜잭션에 참여해 DB에 저장하고 푸시/STOMP는 보내지 않는다. 호출 전 업무 권한·차단 등 적용 조건은 생산자가 확인한다.
조용한 시간은 D 구현을 재사용한다. `TEAM_INVITE` → `/invite/{code}`는 B 초대 흐름의 공유 기준으로 기록만 한다.
C의 이슈 알림 생성 시점·링크·중복 그룹 키를 이번에 새로 확정하거나 실제 알림을 생성하지 않는다.

## 7. 이슈 기록과 종료 조건

B는 [#184 리뷰](https://github.com/likelion-backendschool-9th/Linker/pull/184#pullrequestreview-5779375943)에서 공개 스키마 기준 경로·큐 유지·비대상 처리 및 직렬화 방향에 동의했고, 보완은 [PR #185](https://github.com/likelion-backendschool-9th/Linker/pull/185)에 정리했다.
`PROCESSED`는 전달 처리가 끝났다는 뜻이며 캐시 변경 증거가 아니다. 명시적으로 분류한 비대상의 정상 반환과, 미지원·잘못된 필드·미해결 연결은 구분한다. 현재 `IGNORED` 자동 기록 경로는 없다.
B가 보고한 격리 통합 테스트 15개는 합성 입력의 서명 수신→DB→Redis 행 ID 큐→handler 식별 필드 유지와 C 미연결 시 RECEIVED 유지·복구를 포함한다. C가 이 테스트를 이번 문서 수정에서 재실행한 것은 아니며, 실제 App 수신·C 캐시 저장 검증을 뜻하지 않는다.
보관 항목의 노출·멤버십·날짜 정책과 다중 인스턴스 구현 검증은 미확정 상태로 유지한다.

공유 위치는 [B↔C 웹훅 소비 계약 확인 #183](https://github.com/likelion-backendschool-9th/Linker/issues/183)이다. 기존 #49 댓글은 #183으로 이동한 뒤 삭제됐다.
이 문서 작성만으로 이슈 댓글 게시·상대 확인·팀 전체 freeze가 완료된 것은 아니다.

- [x] 최신 B envelope·큐·외부 설치 ID·토큰·트랜잭션 경계를 코드와 대조
- [x] C event/action·식별자·재조회·중복/지연 소비안 작성
- [x] C 관련 정책 숫자 및 현재 알림 인자 대조
- [x] B가 공개 스키마 기준 필드 경로·큐 유지·명시적 비대상 정상 반환·갱신 직렬화 방향 확인
- [ ] 실제 GitHub App 수신 샘플 확인
- [ ] 보관 항목의 노출·멤버십·날짜 정책 공동 확인
- [ ] 다중 인스턴스·모든 진입 경로의 직렬화 구현 수단과 실검증 확인
- [ ] D와 ISSUE 3개 대응 키·단위·적용 위치 확인
- [ ] 이슈에 C 확인 결과를 게시하고 상대 확인 기록 연결

검증은 문서 로컬 링크·정책 값·코드 시그니처 대조와 `git diff --check`다. 실행 코드 변경이 없어 빌드·전체 테스트는 재실행하지 않는다.
실제 GitHub App 수신·캐시 갱신, Blocked·날짜 쓰기, 공유 DB·마이그레이션은 실행하지 않았다.
저장소 밖 한국어 순서 원본에도 이 확인 상태와 문서 링크를 별도로 반영해야 한다.

공식 필드 근거(2026-11-05 확인):
[Projects item](https://github.com/octokit/webhooks/blob/main/payload-schemas/api.github.com/common/projects_v2_item.schema.json),
[Projects edited](https://github.com/octokit/webhooks/blob/main/payload-schemas/api.github.com/projects_v2_item/edited.schema.json),
[Projects converted](https://github.com/octokit/webhooks/blob/main/payload-schemas/api.github.com/projects_v2_item/converted.schema.json),
[Issues transferred](https://github.com/octokit/webhooks/blob/main/payload-schemas/api.github.com/issues/transferred.schema.json).
