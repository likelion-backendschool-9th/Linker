# 13 요청 템플릿 마크다운 UI

> 2026-11-10 · `fix/issue-create-request-form-markdown`

## 범위 (C 13 QA)

| 전 | 후 |
| --- | --- |
| 목업 `form:request` = `FORM` + YAML 필드 UI | `MARKDOWN` + `## 요약/자세한 내용/확인 사항` 뼈대 |
| 라디오 708:1814 | 미선택 3층: `#eaeaea` stroke → `#f6f7fb` 링 → 흰 원 12.5. 선택: 파란 stroke → 흰 간격 → 파란 점. 라벨 optionPick 유지 |

## 비범위

- FORM 렌더/`form-body` 제거·FORM→마크다운 강제
- 11/14/15 필터·보드 스크롤
- 신규 색 토큰·기존 토큰 값 변경

## 검증

Vitest IssueContentStep·form-body / e2e `c-issue-create` / lint·typecheck
