# C15 이슈 캘린더 화면 — 작업 기록

> 2026-11-09 · `feat/issue-calendar-screen` · API 기록은 [c-page15-implementation.md](c-page15-implementation.md)

## 범위

- `/teams/[id]/calendar` 화면을 Figma 15(`234:219`), 날짜 셀 선택(`368:2753`), 날짜 선택(`368:3024`)에 맞춰 새로 만들었다. 기존 화면 코드(`CalendarView`, `hook`, CSS, 테스트)는 지우고 `page.tsx`·`loading.tsx`만 남겨 고쳤다.
- 그대로 쓴 것: `calendar/_lib/calendar-queries.ts`, `calendar-view/api.ts`, 목업 `p15-calendar.ts`, 생성 타입, 백엔드, 11·14의 `TeamFrame`·`TeamNav`·`IssueFilterButton`·`IssueFilterSheet`.
- 새 파일: `calendar-day-sheet`(368:2753), `calendar-date-sheet`(368:3024), `e2e/c-issue-calendar.spec.ts`.
- 엔드포인트·테이블·페이지 수는 그대로다(205 REST, 69 테이블).

## Figma 3개 상태

| 노드 | 내용 |
| --- | --- |
| `234:219` | 기본 화면. 월요일 시작 월 달력, 이슈 막대, 상태 칩 4개 + `?`. 4번째 칩 문구가 "완료"로 중복 |
| `368:2753` | 날짜 칸 선택 시트 "9월 12일 이슈": 제목 + 상태 점, `#번호 · 레포`, 담당자 사진 |
| `368:3024` | 날짜 선택 시트: 휠 2개 + "저장". 휠 값이 샘플(26/11) |

## 확정한 결정

| 항목 | 결정 |
| --- | --- |
| 날짜 휠 | 사용자 결정: **연도 · 월** 휠. 저장하면 그 달 1일로 이동(이번 달이면 `date` 제거). 연도는 현재 ±5년 |
| `?` 아이콘 | 준호님 리뷰 반영: 오른쪽 끝이 아니라 마지막 칩 바로 옆, 간격 10px(Figma 234:219 자동 레이아웃 간격, 기존 `--space-calendar-chip`). 사용자 결정: 14 드롭다운 모양의 작은 안내 팝오버. 기존 문구 "마감일이 없는 이슈는 캘린더에 보이지 않아요."와 `/teams/{id}/issues?view=unscheduled` 링크만 넣었다. Figma에 열린 화면이 없다 |
| 필터 · FAB | 사용자 결정: 헤더 아이콘은 11 필터 시트, FAB은 `TeamFrame`의 팀 채팅 링크 |
| 상태 칩 | 사용자 결정(2026-11-09): 칩 문구만 11 칩(`STATUS_CHIPS`, 재사용)과 같은 **작업 전 / 진행 / 완료 / 정지**로 맞췄다. 순서는 Figma 15대로. 그 밖의 상태 이름(화면 낭독 등)은 Policy POL-I-3 문구 그대로다. 색은 보드 상태 색(해당 상태 이슈의 `statusColor`, 없으면 회색·파랑·초록·빨강) 15% 투명 배경. 360·375px에서 한 줄(e2e로 확인) |
| 주 시작 | Figma대로 월요일. `calendar-grid.ts`의 `weekStartsOn`을 1로 바꿨고 테스트를 맞췄다 |
| 막대 | 날짜 아래 3줄까지, 한 날짜만 있는 이슈도 막대. 시작·마감일이 모두 있으면 기간 막대 |
| 날짜 칸 | 이슈가 있는 날짜만 버튼(시트가 열림). 없는 날짜는 글자만 — Figma에 빈 날 시트가 없어 문구를 만들지 않았다 |
| 필터 적용 | 담당자만 API로 보내고, 레포·상태·라벨·열린 이슈만은 받은 목록에서 화면이 거른다(API 계약 그대로) |
| 공용 컴포넌트 | `IssueSummaryRow`에 선택 prop `compact`(마감일 숨김, 담당자 이름은 화면 낭독기용), `onOpen`, `issue` 타입을 `syncStatus`·`syncedAt` 없이도 받게 넓힘. 기존 사용처 동작은 같다 |
| 새 토큰 | `color.css`(`--color-sheet-picker`, `--color-text-wheel`), `layout.css`(달력 간격·크기·`--wheel-row-height` 등). 기존 값은 바꾸지 않았다. 오버레이 키 `calendar-date` 추가 |

## 기존 화면에 있었지만 Figma에 없어 만들지 않은 것

1. 주 보기와 월/주 전환 (URL `view=week`는 무시)
2. 이전·다음 달 화살표와 "오늘" 버튼 (날짜 선택 시트로만 이동)
3. 담당자 드롭다운 (헤더 필터 시트의 담당자로 대신함)
4. 한 날짜에 막대가 3줄을 넘을 때 "+N" 표시 (날짜 시트에서 전부 보임)
5. 마감 지난 이슈의 빨간 표시와 시트의 날짜·"마감 지남" 글자: 시트에 날짜가 없다. **Policy 7장·POL-I-4의 마감 지남 표시와 다르다**
6. 시트의 상태 배지 글자, 시작~마감 기간, 담당자 이름(글자): 상태 점과 사진만 보인다
7. 날짜 시트의 설명 문구와 빈 날 "이 날 일정이 있는 이슈가 없어요." 안내
8. 달력 아래 "이슈 목록의 '일정 없음'에서 보기" 안내 줄: `?` 팝오버로 옮김
9. 점(dot) 모양의 마감일만 있는 이슈 표시: 막대로 통일

Policy·Page TODO는 수정하지 않았다.

## 검증 (로컬, 2026-11-09)

- frontend `pnpm lint` 오류 0(경고 6개는 이번 변경과 무관), `pnpm typecheck` 통과.
- Vitest `calendar` 10개 통과(`--maxWorkers=2`; 공용 `IssueSummaryRow` 변경 때 `issues`·`_components`까지 42개 통과 확인). 새 `CalendarView.test.tsx` 4개(칩·월요일 시작·날짜 버튼·axe, `?` 팝오버, 날짜 시트, 날짜 선택 후 URL).
- e2e `c-issue-calendar.spec.ts` 6개 통과(`pnpm dev:mock`, 서버 하나, 끝난 뒤 종료): 머리글·칩·`?`, 360·375·600px에서 칩 4개와 `?`가 한 줄·간격 10px, 날짜 시트 → 12, 연도 휠 → URL, 360·375·600px 가로 스크롤 없음 + axe(`color-contrast` 제외).
- 화면 확인: 375px 캡처를 Figma와 비교해 제목·칩·요일·막대 간격을 맞췄다.
- `pnpm test` 전체, `pnpm build`, 백엔드는 돌리지 않았다. 푸시하지 않았다.

## PR 리뷰 항목

- [ ] `?` 팝오버: Figma에 열린 화면이 없어 14 드롭다운 모양으로 만들었다. **준호님 확인 필요**
- [ ] Policy와 다름(수정 안 함): 마감 지남 표시 (Policy 7장·POL-I-4)
- [ ] 칩 문구는 11과 같은 "작업 전/진행/완료/정지"(Figma 15의 4번째 "완료"는 중복이라 "정지"로). Policy POL-I-3 문구(작업 중·작업 완료·작업 중단)와 다름, 수정 안 함
- [ ] 날짜 선택 휠: Figma 값이 샘플이라 연도·월로 해석(사용자 결정)
- [ ] 주 시작을 월요일로 바꿈(`calendar-grid.ts`), 주 보기 제거
- [ ] 디자인 가이드 한국어 원본에 새 토큰 반영 필요
