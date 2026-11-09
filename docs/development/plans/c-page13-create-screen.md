# C13 이슈 작성 화면 — 작업 기록

> 2026-11-09 · `feat/issue-create-screen` · API 선행: [c-page13-implementation.md](c-page13-implementation.md)

## 범위

- `/teams/[id]/issues/new`를 Figma 13에 맞춰 연결. 1단계(레포·템플릿) → 2단계(본문) 유지.
- 유지: `issues/new/_lib`, 각 `api.ts`, 목업 `p13-issue-create.ts`, 생성 API·`issue_sync_jobs`, 백엔드.
- 공용 `issue-sheets` 4개 = Figma 13 시트(12·13·14 공유). 저장 로직·API 그대로.

## Figma

| 노드 | 내용 |
| --- | --- |
| `200:806` | 2단계 기본 |
| `368:2098` | 제목 포커스 |
| `368:2186`~`368:2615` | 상태·담당자·라벨·일정 시트 |

1단계 프레임 없음 → 칸 모양만 13 입력칸. Required 부가 UI도 Figma 화면 없음.

## 질문 답 1~9 반영

1. 1단계 유지, 칸만 13 스타일  
2. CTA = Figma **"GitHub에 이슈 작성하기"**  
3. placeholder("실명"·"개발자님") **미반영** → 준호님 확인  
4. 0/2000 **미표시·미제한** → 준호님 확인  
5. 제목만 필수(CTA 막음)  
6. 공용 시트 = 13 Figma → **12도 바뀜**. 상태명 Policy  
7. 마크다운/미리보기 같은 칸  
8. Required 로직 유지(폼·초안·재시도·하루 100·sync job)  
9. API 미변경, `?fromSummary=` 안 만듦  

## 375px vs Figma (의도적 차이)

| 항목 | Figma | 구현 | 이유 |
| --- | --- | --- | --- |
| 제목/본문 placeholder | 실명·개발자님… | 없음 | 질문 답 |
| 0/2000 | 있음 | 없음 | 질문 답 |
| 상태 문구 | 완료/진행 중… | ISSUE_STATUS_LABELS | Policy |
| 양식 행 높이 | ~25px | ≥44px | 터치 목표 |
| 샘플 값 | 완료·UI/UX… | 템플릿 기본값 | 런타임 |

측정 일치: 입력 48×343·r14·pad15, 본문 min 163·pad11, 토글 37·r12, CTA 53·18 SemiBold, 카드 pad15·r10·gap10, 포커스 2px `#2563eb`.

## Figma 없어 만든 것 / 만들지 않은 것

- **만듦(화면 없음, 준호님 확인):** 1단계, YAML 폼·첨부 안내, 템플릿 실패 안내, 초안 복구 시트(공용), 다시 보내기, sync 진행, 하루 100(`RATE_LIMITED`) 문구  
- **안 만듦:** `?fromSummary=`, Linker 전용 이슈, Policy 수정, API 변경  

## Policy와 다른 부분

- CTA: Figma 문구 vs Policy/TODO "이슈 만들기"  
- 상태 시트 짧은 이름 vs Policy 상태명(통일 PR `fix/issue-status-labels` 맨 마지막 예정)

## 검증 (2026-11-09)

- lint: 오류 0 (기존 경고 9) · typecheck 통과  
- Vitest 24 (`issues/new`·`issue-sheets`·12 상세, `--maxWorkers=2`)  
- e2e 13+12: 15 passed (`pnpm dev:mock` 재사용)  
- 전체 test·build 안 돌림. 푸시 안 함  
- 목업 한계: 브라우저에서 만든 이슈는 서버 mock store에 없어 상세 RSC가 404 → e2e는 URL·토스트만 확인  


## PR 리뷰 항목

- [ ] 질문 답 1~9 기록 항목 전부  
- [ ] Figma에 없어 만든 것(1단계·YAML·초안·재시도·sync·하루 100) / 만들지 않은 것(`?fromSummary=` 등)  
- [ ] Policy와 다른 부분(CTA 문구, 상태명)  
- [ ] **13 Figma 시트를 공용 시트에 적용, 12도 바뀜**  
- [ ] **상태 이름 통일 PR(`fix/issue-status-labels`) 맨 마지막에 진행 예정**  
- [ ] placeholder·0/2000·Figma 없는 Required UI: **준호님 확인 필요**  
- [ ] 한국어 원본 반영 필요 문서: Policy CTA 문구(확정 시), TODO 13, 본 작업 기록(번역본만 저장됨)
