# C 프론트 정책·포맷 계약 (D2)

담당은 C, 사용자는 A~E 프론트 담당자다. 근거는 Policy 2~11장, 프론트 blueprint §1-1 Stage 2의 C 항목과 팀 조율 체크의 D2 freeze다.

상태는 C 기준 정리 완료이며, 팀 전체 freeze 확정 여부는 공동 체크에서 관리한다. 3번 테스트 하네스는 #168에 머지됐다.

## 공통 정책 키

값의 기준 문서는 `docs/planning/04-policy.md`, 화면에서 가져올 코드는 `frontend/apps/web/src/lib/policy.ts`다. 각 화면의 입력 검사·카운터·도움말·목업은 같은 키를 사용한다.

| export | 사용하는 영역 |
| --- | --- |
| `SITEMAP` | 사이트맵 분할 크기 |
| `INPUT`, `IMAGE`, `DRAFT` | 입력 줄바꿈, 이미지 크기·타입, 초안 보관 기간 |
| `PROFILE`, `RECRUITER`, `JOB_AD` | 프로필·채용자 입력과 공고 조건 |
| `POST`, `RECRUIT` | 작업물·모집글 입력과 개수 제한 |
| `TEAM`, `ISSUE`, `CHAT`, `ADMIN` | 팀·이슈·채팅·운영 화면의 수치·기간 |
| `PLAN_LIMITS` | 요금제별 화면 한도 |
| `SUBSCRIPTION_PRICE`, `SUBSCRIPTION_RULES` | 목업 가격·체험 기준과 환불·유예 기간 |
| `STATS` | 통계 조회 기간 |

주요 소비 예시는 아래와 같다. 다른 값은 위 파일을 직접 참조한다.

| 키 | 현재 값 | 사용 의미 |
| --- | --- | --- |
| `IMAGE.maxBytes` | `10 * 1024 * 1024` | 이미지 한 장의 바이트 상한 |
| `INPUT.maxConsecutiveLineBreaks` | 2 | 연속 줄바꿈 상한 |
| `PROFILE.displayName` | min 1, max 20 | 표시 이름 길이 |
| `PROFILE.bioMax` | 160 | 소개 길이 |
| `ISSUE.createPerDay` | 100 | 이슈 생성 일일 한도 안내 |
| `ISSUE.assigneesMax` | 10 | 이슈당 담당자 상한 |
| `ISSUE.refreshIntervalSeconds` | 60 | 화면의 이슈 당겨서 새로고침 최소 간격 |

`PLAN_LIMITS`의 `null`은 무제한, `0`은 허용량 0이다. 서버에서 받은 잔여량·권한·가격은 해당 응답을 사용한다. `SUBSCRIPTION_PRICE`는 목업·초기 계약용 값이다. 실제 결제 화면 가격은 API 응답을 따른다.

## 글자 수와 숫자 표시

| 목적 | 공통 함수 | 계약 |
| --- | --- | --- |
| 입력 길이 | `countChars` (`lib/format/text.ts`) | 양끝 공백 제거 후 grapheme 단위로 센다. 조합 이모지와 한글을 화면상 한 글자로 취급한다 |
| 저장 전 줄바꿈 정리 | `normalizeLineBreaks` (동일 파일) | CRLF/CR을 LF로 바꾸고 연속 줄바꿈을 `INPUT.maxConsecutiveLineBreaks`까지 유지한다 |
| 개수 표시 | `formatCount` (`lib/format/number.ts`) | 999 → `999`, 1,250 → `1.2천`, 12,345 → `1.2만`. 소수 한 자리 아래 버림 |
| 원화 표시 | `formatWon` (동일 파일) | `ko-KR`의 KRW 통화 포맷 |

입력 검사와 화면 카운터는 모두 `countChars`와 동일한 정책 상수를 사용한다. 문자열의 `.length`와 HTML `maxLength`는 이모지에서 grapheme 수와 달라질 수 있으므로 공통 글자 수 검증을 대신할 수 없다.

## 날짜와 SSR 표시

공통 모듈은 `frontend/apps/web/src/lib/format/time.ts`, 시간대는 `KST = 'Asia/Seoul'`이다.

| 목적 | 사용할 함수·컴포넌트 |
| --- | --- |
| 타임스탬프를 KST로 변환 | `toKst` |
| `<time dateTime>` 값 | `toKstIso` (`+09:00` 포함) |
| 일반 날짜·상대 시간 | `formatDate`, `formatRelativeTime` |
| 채팅의 고정 발송 시각 | `formatMessageTime` |
| 오늘 날짜·D-day | `todayKst`, `daysUntil` |
| SSR 후 상대 시간으로 전환 | `components/ui/relative-time.tsx`의 `RelativeTime` |

타임스탬프는 시간대가 명시된 ISO 문자열 등으로 전달하고, 화면상의 오늘·연도·날짜 경계는 KST 기준으로 계산한다. 캘린더의 `yyyy-MM-dd` 날짜는 날짜 값으로 유지한다. `daysUntil`에는 이 날짜 형식을 전달한다.

일반 상대 시간은 1분 미만 `방금`, 1시간 미만 `N분 전`, 24시간 미만 `N시간 전`, 같은 연도 `M월 d일`, 다른 연도 `yyyy. M. d.`다. 채팅 발송 시각은 `오전/오후 h:mm`을 고정 표시한다. SSR 화면은 기존 `RelativeTime`의 서버 날짜 → 마운트 후 상대 시간 전환을 사용한다.

## 변경·공유 절차

1. 운영 규칙 변경은 Policy에 먼저 반영한다.
2. C 공통 정책·포맷과 영향받는 프론트 담당자가 키·단위·의미 변경을 함께 확인한다.
3. 정책 상수 또는 공통 함수를 갱신하고 해당 소비 화면·목업을 맞춘다.
4. 관련 기존 포맷 테스트로 경계를 확인하고 PR에 변경한 키와 소비 영역을 적는다.

백엔드 `PlanLimits`는 D 담당 계약으로 관리한다. C 프론트 정책 기준을 넘길 때 같은 값·단위를 대조한다. 이 문서는 C의 프론트 정책·포맷 전달 범위다.

## 확인 및 후속 기록

- 기존 코드와 Policy의 글자 수·숫자·KST 표시 규칙, 위 정책 export와 주요 수치를 대조했다.
- 관련 검사 명령은 `frontend/`에서 `pnpm --filter web test src/lib/format/format.test.ts src/lib/format/message-time.test.ts`다.
- A 담당 프로필 폼의 `.max`·`.length`·`maxLength`와 grapheme 기준의 차이는 #154에 기록된 후속 사항으로 유지한다. 이번 문서 작업의 코드 변경 범위에는 포함하지 않는다.
- JWT claim·공통 오류·NotificationService·차단·웹훅·OpenAPI Tag·Sentry의 팀 합의 상태는 각 담당자와 전원 공동 체크에서 관리한다.
