# C13 이슈 작성 화면 — 작업 기록

> 2026-11-09 · `feat/issue-create-screen` · API 선행: [c-page13-implementation.md](c-page13-implementation.md)

## 범위

- `/teams/[id]/issues/new` **한 페이지** (Figma 200:806). 2단계 UX 제거.
- 유지: `_lib`, API·목업 계약, 생성·초안·재시도·하루 100·sync, 시작일 빈 칸 저장 수정.
- 공용 `issue-sheets` 스타일 맞춤(12도 영향). 담당자 직군: API 없음 → **목업만** `jobRole`(PO 등), 실API는 이름만.

## Figma 노드 핵심

| 노드 | 한 줄 |
| --- | --- |
| `200:806` | 한 페이지: 저장소·템플릿 드롭다운 → 제목·본문(0/2000)·양식 5줄·CTA |
| `368:2098` | 제목 인풋 포커스 링 |
| `368:2186` | 상태 시트: 행+구분선, 선택=글자 강조(+오른쪽 체크). **왼쪽 라디오 없음** |
| `368:2309` | 담당자: 이름+직군, 행+구분선. **왼쪽 라디오·선택 점 없음** |
| `368:2440` | 라벨 칩 선택(파란 채움) |
| `368:2615` | 날짜 휠 + CTA「저장」 |
| `708:1814` | **저장소 변경** 피커(라디오+변경) — 이어쓰기 아님 |
| `708:1965` | **템플릿 선택** 피커(라디오+변경) — 이어쓰기 아님 |
| `708:2249` | **이어쓰기 모달** (이어 쓰기 / 새로쓰기·이어쓰기) |

## 준호님 요청으로 바뀐 합의

- 2단계 → **한 페이지**
- placeholder·**0/2000** Figma 반영 (표시+`maxLength` 2000)
- 이어쓰기: 바텀시트 → **모달**(이슈 작성만, `issue-draft-restore`)
- 담당자 역할: Figma대로 이름 옆 표시. API 직군 없음 → **목업만 jobRole**, OWNER/ADMIN/MEMBER 가짜 표시 금지
- 선택 UI: 368 시트는 왼쪽 라디오 제거. **708 라디오는 CreatePickSheet만**
- 제목 placeholder: 「제목을 작성해 주세요」(본문·0/2000 유지)

## Policy·문서와 다른 점 (Policy 문서 미수정)

- CTA: Figma 「GitHub에 이슈 작성하기」 vs Policy/TODO 「이슈 만들기」
- 상태명: Policy `ISSUE_STATUS_LABELS` 유지 (통일 PR 나중)
- 담당자 직군(PO 등): **API 직군 없음** — 목업 `jobRole`만, 실응답은 이름만

## Figma에 없어 / 최소 연결

- YAML 폼·첨부 안내: Required 로직 유지, 큰 별도 UI 없음 → **준호님 확인**
- 사진/첨부 UI: 200:806에 **없음**

## 검증 (2026-11-09)

- lint: 0 errors (warnings only)
- Vitest(`issues/new` + `issue-sheets` + `[issueId]`, `--maxWorkers=2`): 26 pass
- e2e mobile: create 전 통과; detail status 시트는 단독 재실행 pass (목록→상세 진입 간헐 실패)
- 커밋·푸시 안 함

## 피커/복구 URL 주의

- 시트·모달에서 `setNav` 후 `overlay.close()`(`history.back`)하면 선택이 되돌아감 → `closeAnd`로 닫은 뒤 적용

## PR 리뷰 항목

- [ ] 한 페이지 + 저장소/템플릿 피커(708:1814/1965)
- [ ] placeholder·0/2000 (표시+입력 제한)
- [ ] 이어쓰기 모달(708:2249, 이슈만) — 게시글·모집은 기존 시트
- [ ] 담당자 선택: 708 라디오 차용 (**준호님 확인**)
- [ ] 담당자 역할 미표시 (API 없음)
- [ ] 13 시트 → 공용, 12도 영향
- [ ] Policy CTA 문구 차이 / 상태명 통일 PR 나중
- [ ] 도균님 리뷰 / 한국어 원본 반영 필요 문서
