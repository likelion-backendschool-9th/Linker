# C17 AI 채팅 요약 — 작업 기록

> 2026-11-09 · `feat/ai-chat-summary`

## 범위

- 팀 채팅 FAB → `POST/GET .../ai-summaries` → 결과 패널(Figma **351:362**).
- 항상 최근 500메시지. 범위 선택 UI 없음.
- 축소 DTO: `{ summaryId, status, summary, messageCount, usedToday, limit, disclaimer }`.
- Ollama `LlmClient` (`OLLAMA_BASE_URL` / `OLLAMA_MODEL`), Redis 10/일(KST, 실패 환불).
- Free→Flex: 기존 `PlanLimitSheet` (`PLAN_LIMIT` + `AI_SUMMARY`).
- 로딩 문구「요약하는 중이에요」, 실패 토스트「요약하지 못했어요」.
- 배너「이 팀은 AI 요약을 사용해요」: 팀 생성 7일 + session dismiss.

## 비범위

- 회의록 섹션(oneLine/decisions/todos/openQuestions), 채팅 공유, 할 일→이슈.
- Figma **351:138**(검색 인풋) 미사용.
- Policy/ERD 원문 수정, OpenAPI 재생성(수동 `apiFetch`).
- 완료 푸시 알림 타입(준호 확인 후).

## Figma

| 노드 | 용도 |
| --- | --- |
| 92:768 | 팀 채팅방 재사용 |
| 351:362 / 351:560 | 결과 패널 기준 |
| 351:138 | 검색 프레임 — AI 무시 |
| Flex·로딩·배너 | **Figma 화면 없음, 준호님 확인** |

## Policy 합의 차이

- 범위: Policy 4종 선택 → **항상 최근 500**.
- 출력: 회의록 → **본문 한 덩어리 `summary`** (`summary_line` 매핑).
- share 엔드포인트·화면 미구현.

**2026-11-10 c-role-audit #8:** 위 축소를 **지금 계약**으로 공식화. 범위4종·회의록·공유·이슈만들기는 **후속 `[Included]`** (Page TODO 17 / WBS P17 갱신). Policy 원문은 차이 표만 ([c-role-audit.md](c-role-audit.md)). 프롬프트 최소 격리는 PR3 (#9).

## 검증

- BE `compileJava` / disclaimer 단위 테스트
- FE lint·typecheck·Vitest `AiSummarySheet`
- 커밋·푸시·전체 e2e·OpenAPI gen 안 함
