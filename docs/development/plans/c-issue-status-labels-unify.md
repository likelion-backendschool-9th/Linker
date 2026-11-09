# 상태 이름 POL-I-3 통일

> 2026-11-09 · `fix/issue-status-labels`

## 범위 (C만)

| 전 | 후 | 위치 |
| --- | --- | --- |
| 진행 | 작업 중 | `STATUS_CHIPS` (11·15) |
| 정지 | 작업 중단 | 同上 |
| 완료 | 작업 완료 | 同上 |
| 진행/정지/완료 | 작업 중/중단/완료 | 11 진행 카드·추이 범례 |

`ISSUE_STATUS_LABELS` 단일 출처. 칩 줄: 기존 `overflow-x: auto` + `nowrap` 유지.

## 비범위

- B `teams/new` `NEW_LABELS`(작업 진행/정지)
- Policy 문서, API, 색·토큰
- 짧은 「중단」배지 신규

## 검증

Vitest IssueList·IssueProgress·CalendarView / e2e c-issue-list·c-issue-calendar / typecheck
