# C14 보드 — 페이지 가로 스크롤 숨김 · 탭 sticky

> 2026-11-09 · `fix/board-overflow-sticky-tab`

## 범위

1. `/teams/[id]/board` **페이지/뷰포트** 가로 스크롤 제거. 칸 행(`.columns`) `overflow-x: auto`는 유지.
2. `TeamNav`를 앱바 아래 sticky (공용).

## 영향 페이지 (탭 공용)

`TeamFrame` → `TeamNav` sticky: **11 이슈 · 14 보드 · 15 캘린더 · 09 설정** 동일. 11·15 페이지별 잔여는 이후 PR.

## 원인·수정

| 문제 | 원인 | 고친 곳 |
| --- | --- | --- |
| 페이지 x-스크롤 | 넓은 칸 행·sr-only가 문서 폭을 키움 | `BoardView.module.css` `.page`에 `min-width:0; overflow-x:clip`, `.columns`에 `min-width:0` |
| 탭 고정 | sticky 없음 | `TeamNav.module.css` — `top: safe-area + header-height`, canvas 배경 |

## 비범위

11·15 전용 레이아웃, 상태 이름 통일, API/Policy/토큰, 보드 dnd·필터 리팩터.

## 검증

- typecheck / Vitest `BoardView`·`TeamFrame` (`--maxWorkers=2`) 통과
- e2e `c-issue-board`: 페이지 `scrollWidth` 단언은 통과 경로. axe는 Toaster `landmark-is-unique`(환경)로 실패 — 이번 CSS와 무관
- 커밋·푸시·전체 build 안 함
