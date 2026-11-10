# C14 보드 — 가로 스크롤바만 숨김

> 2026-11-10 · `fix/board-no-horizontal-scroll`

## 범위

`/teams/[id]/board`에서 **보이는 X 스크롤바만** 없앤다. 칸 가로 밀기(팬)는 유지.

## 전→후

| | 전(잘못 B) | 후(QA) |
| --- | --- | --- |
| `.page` | `overflow-x: clip` | 동일 |
| `.columns` | `overflow-x: clip` | `overflow-x: auto` + scrollbar 숨김 |

## 비범위

칸 밀기 제거, 11·15, 토큰·Policy.

## 문서 반영 (2026-11-10)

Page TODO 14 / WBS P14: 「가로 스크롤」→ 칸 팬 유지 + **보이는 X 스크롤바만 숨김**. 상세 차이 표는 [c-role-audit.md](c-role-audit.md).

## 검증

- Vitest BoardView / e2e `c-issue-board` (페이지 scrollWidth + columns pan·scrollbarWidth none)
- 커밋·푸시 안 함
