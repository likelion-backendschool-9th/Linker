# C 역할 감사 — 07·11–15·17

> 2026-11-10 · 브랜치 `docs/c-role-audit` · **PR1 문서만** (코드 수정은 PR2/PR3)

Policy 원문은 고치지 않는다. 의도적 축소·QA 반영은 이 문서의 차이 표와 Page TODO / WBS / 관련 plans에 둔다.

## 1. 감사 요약

| 영역 | 요약 |
| --- | --- |
| 07 | URL·미리보기·팀 선택·OPEN 정렬 대체로 일치. 홈 가시 카피「더 보기」→「내 이슈 전체 보기」통일 결정. 읽기전용/보관 `+` 숨김 결정(코드는 PR3). |
| 11 | 목록·`q`·멤버십·progress API 일치. 헤더 필터→팀변경(QA), 일정없음 칩 제거, Progress·Free 프롬프트 **의도적 축소**. |
| 12 | API·권한·sanitize·재시도 골격 일치. `MOVED`+null 렌더 → PR3. 채팅 공유는 MVP 제외. |
| 13 | **실연동 차단:** FE가 BE OpenAPI와 불일치(`requestId`, 후보/라벨 URL, FORM `answers`, CreateResponse·poll). 한 화면·요청폼 mock MARKDOWN은 합의 축소. 코드는 PR2. |
| 14 | 칸·dnd·canWrite 일치. 5xx `retryScheduled` vs FE 즉시 revert → PR3. 스크롤바만 숨김(QA). 헤더=팀변경, 보드「상태 필터」메뉴 유지. |
| 15 | calendar API·D-1 알림 골격 일치. month만·막대·overdue 미표시는 plans 축소. sync OFF면 리마인더도 사실상 OFF. |
| 17 | Flex·10/일·팀방·면책 일치. 범위4종·회의록·공유·이슈만들기는 **후속 Included**(지금 미구현). 프롬프트 인젝션 최소 완화는 PR3. |

**보안(요약):** High 없음. Med — AI 프롬프트 concat, 프로덕션 mock 오설정, `ISSUE_SYNC_ENABLED` 기본 false. Low — AI `@DeveloperOnly` 부재 등.

## 2. 결정 10항 (2026-11-10)

| # | 결정 |
| --- | --- |
| 1 | 13 실연동: FE를 BE OpenAPI/WBS에 맞춘다 (`requestId` UUID, 템플릿 후보/라벨, FORM `answers`, CreateResponse·poll). **PR2** |
| 2 | 11 Progress: 축소 UI 유지(상태 카드 4 + Flex 추이). POL-T-7 풀 복구 안 함. 「의도적 축소」공식화 |
| 3 | 필터 시트: Page TODO「(sheet) Filters」삭제·헤더는 팀변경만. 필터 UX 재도입 안 함. 보드「상태 필터」메뉴는 유지 |
| 4 | `ISSUE_SYNC_ENABLED`: 스테이징/프로덕션 **true**. 로컬만 false 가능 (재시도·마감 알림 의존) |
| 5 | 보드 5xx: `retryScheduled`면 즉시 revert하지 말고 폴링/무효화. **PR3** |
| 6 | 07 홈 링크: 가시 카피「내 이슈 전체 보기」로 통일. **PR3** → B 1차 QA(PR #412)에서「더 보기」로 되돌림(스크린리더 이름은「내 이슈 전체 보기」) |
| 7 | 읽기전용/보관 팀: 07·11 이슈 작성(`+`) 숨김. **PR3** |
| 8 | AI 요약: 범위4종·회의록·공유·이슈만들기는 **후속 Included**. 지금 구현 안 함 |
| 9 | AI 보안: 프롬프트 인젝션 **최소 조치**(격리·길이·출력 검증)를 PR3에 포함. 완전 차단 아님 |
| 10 | 감사 기록: 이 파일(`c-role-audit.md`)로 보존 |

### PR 분할

| PR | 내용 |
| --- | --- |
| **PR1** (이 문서) | 감사 + TODO/WBS/plans 반영. Policy 원문 최소 |
| **PR2** | 13 FE↔BE 계약 |
| **PR3** | 12 MOVED·14 retry/매핑·07/11 CTA·AI 최소 보안 |

## 3. Policy / TODO 차이 표 (원문 미수정 → 구현·합의)

| 주제 | Policy / Page TODO 원문 | 구현·합의 (SoT) |
| --- | --- | --- |
| 11 Progress | POL-T-7: 완료 링·4칸·14일·담당자별·마감 탭·「표로 보기」·Free「Flex 알아보기/오너에게 요청」 | **의도적 축소:** 상태 카드 4 + Flex 추이만. 「표로 보기」버튼 없음(추이 sr-only). Free 프롬프트 없음. `c-page11-issue-list-screen` |
| 11 필터 시트 | TODO「(sheet) Filters…」14·15 재사용 | **QA:** 헤더 아이콘=팀변경. `IssueFilterSheet` 제거. 보드「상태 필터」메뉴만. `c-team-nav-filter-to-team-change` |
| 11 일정 없음 | TODO 탭 + POL-I-3 | 칩 없음. 15 `?` → `?view=unscheduled` +「프로젝트에 추가」만 |
| 14 가로 스크롤 | TODO「Horizontal scroll of columns」 | 칸 팬 유지, **보이는 X 스크롤바만 숨김**. `c-page14-board-no-horizontal-scroll` |
| 15 뷰·마감 | TODO month/week·overdue 빨강·due-dot | month만·막대 통일·overdue UI 없음. `c-page15-calendar-screen` |
| 17 AI | POL-C-5: 범위 4종·회의록·공유·할일→이슈 | **지금:** 항상 최근 500·한 줄 `summary`. 범위/회의록/공유/이슈만들기는 **후속 Included**. `c-page17-ai-chat-summary` |
| 13 작성 UX | WBS stepped | **한 화면**. `c-page13-create-screen` |
| 07 상태/마감 문구 | POL-I-3 이름+색·「마감 지남」 | 색 점 + sr-only 이름; 「마감 지남」문구 없음(Figma) |
| 12 채팅 공유 | TODO `[Included]` | MVP 화면 없음 |
| sync 플래그 | (암묵 ON 가정) | 기본 설정 false 가능 → **운영 메모** 참고 |

한국어 Policy 원본 반영은 저장소 밖 작업. 온보딩이 옛 풀스펙을 보면 이 표를 본다.

## 4. 운영 메모 — `ISSUE_SYNC_ENABLED`

| 환경 | 값 | 이유 |
| --- | --- | --- |
| 스테이징 | **true** | 생성/편집 백그라운드 재시도, D-1 09:00 KST 마감 알림이 이 플래그에 묶임 |
| 프로덕션 | **true** | 동일 |
| 로컬 | false 가능 | GH App/토큰 없이 UI·목업 개발할 때 |

`linker.issues.sync-enabled` / `ISSUE_SYNC_ENABLED`. false면 job 재시도·리마인더 스케줄이 사실상 돌지 않는다. 배포 체크리스트에 넣을 것.

## 5. 관련 plans (이번 PR1에서 갱신)

- `c-team-nav-filter-to-team-change.md`
- `c-page14-board-no-horizontal-scroll.md`
- `c-page11-issue-list-screen.md`
- `c-page15-calendar-screen.md`
- `c-page17-ai-chat-summary.md`
- `c-page07-my-issues-screen.md`
- `c-page13-create-screen.md`

## 6. 검증 범위 (감사 시점)

실 GitHub/Ollama E2E, 프로덕션 빌드 mock grep, D push 실배송, Figma 전수는 하지 않음.
