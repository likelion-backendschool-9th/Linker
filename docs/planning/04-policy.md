# Linker Policy

> Question this document answers: **By what rules do the service's features operate?**
> Why each feature is needed is in the [PRD](02-prd.md), screens and flows in the [Service Plan](01-service-plan.md). Legal rights and duties of members and the company are covered by the [Terms of Service](05-terms-of-service.md), and collection/retention/destruction of personal data by the [Privacy Policy](06-privacy-policy.md).
>
> **UI copy is kept in Korean** (the app's language) with an English gloss where helpful. Use the Korean string as-is in code.

## 1. Overview

This document defines, per feature, "who can do what, when, how much, and in which cases." Developers implement validation, permissions and states with these values; designers write error/empty-state copy; operators use it as the report/sanction standard.

- Policy numbers follow PRD feature IDs. E.g. the policy for P-2 is POL-P-2.
- **All numbers (character counts, photo counts, periods) are tentative**, and this document is the source for numbers. Numbers copied into legal documents change when this one changes.
- For data whose source is GitHub (issues, PRs, org members), GitHub's rules take precedence; Linker adds no extra restrictions on top.
- Each feature section reads: base policy table → state flow → exceptions. Exceptions are written as "when X → do Y".
- Ch. 9 "Reports, sanctions, blocking" is the original text of the **community policy** published to users. Terms of Service articles 18 and 19 point to it.

## 2. Common policies

Rules applied to every feature. Unless a feature policy says otherwise, these values apply.

### Input and display

| Item | Rule |
| --- | --- |
| Character count | Counted after trimming leading/trailing whitespace. Korean, English, digits, emoji all count as 1. Keep at most 2 consecutive line breaks |
| Links | https only. External links open in the browser outside the app; first time per domain, confirm "외부 사이트로 이동합니다" (leaving to an external site) |
| Banned words | No automatic word filter in MVP; handled via reports. Profanity filter reviewed in phase 2 if reports pile up |
| Time display | Chat messages: fixed sent time in KST, e.g. "오후 3:12"; the date divider supplies the date. Other screens: KST. < 1 min "방금", < 1 hour "N분 전", < 24 hours "N시간 전", this year "10월 16일", previous years "2025. 10. 16." |
| Number display | < 1,000 as-is; ≥ 1,000 "1.2천"; ≥ 10,000 "1.2만" |
| Images | JPG, PNG, WebP, GIF, 10MB each. On upload, resize long side to 2,048px and strip location data (EXIF). GIFs preview first frame only, play on tap |
| Default sort | Lists newest first. Exceptions noted per policy |

### User status

| Status | Meaning | Can do | Next status |
| --- | --- | --- | --- |
| Active | Normal user | Everything | Suspended, pending deletion |
| Suspended | Suspended by operator, temporarily or permanently | Log in, view, appeal, delete account only | Active when the period ends |
| Pending deletion | 30 days after requesting deletion | Logging in again restores to active | Deleted after 30 days |
| Deleted | Personal data deleted | Nothing. Remaining team chat messages show "탈퇴한 사용자" (deleted user) | None (re-signing up creates a new account) |

### Access by role

Every Linker user has one of four roles. Owner/admin/member permissions within a team are an extra layer on top, covered in [ch. 6 Teams & permissions](#6-teams--permissions); the operator vs. lead operator split is in [ch. 10](#10-operators--back-office).

| Role | How | Login method | Bottom tabs | Detailed policy |
| --- | --- | --- | --- | --- |
| Guest | Enters without logging in | None | Home / Find Team / Workspace / Chat (Workspace and Chat show login prompt; profile is in the header) | Ch. 3 "Guests" (POL-A-9) |
| Developer | Signs up with GitHub (age 14+) | GitHub | Home / Find Team / Workspace / Chat (profile is in the header) | Ch. 3–9, 11 |
| Recruiter | Signs up with company email (age 19+) | Email + password | Home / Chat (profile is in the header) | Ch. 3 "Recruiter accounts" and "Job ads", ch. 8 "Recruiting offer messages", ch. 11 "Scout benefits" |
| Operator | Operator permission granted to a developer account via DB | GitHub + back-office OTP | Same as developer + `/admin` | Ch. 10 |

- An account is either developer or recruiter and never changes after sign-up. A person who wants both creates separate accounts.
- Operator is not a separate account but a permission attached to a developer account. In the app they act as a developer; operator permission is used only in `/admin`. Operator permission can't be used to enter others' teams/chats or post on behalf of others.
- User statuses (suspended, pending deletion, table above) apply equally to all logged-in roles, independent of role.

**By page**

Legend: ○ can use · view = read-only · prompt = login-prompt sheet (returns to the screen after login) · × URL blocked and buttons hidden

Handling × on direct URL entry: **guests** see the login-prompt sheet and are sent back to that URL after login (e.g. a logged-out teammate receives an issue/chat link). However, operations pages (25–27) appear as "page not found" (404) to anyone who isn't an operator, including guests, to hide their existence. **Logged-in users** hitting a × URL are sent to the home feed.

| # | Page | Guest | Developer | Recruiter | Operator |
| --- | --- | --- | --- | --- | --- |
| 01 | Start / login | ○ | To feed if logged in | To feed if logged in | Same as developer |
| 02 | Onboarding | × | ○ once at sign-up | × (31 replaces it) | Same as developer |
| 03 | Legal documents | ○ | ○ | ○ | ○ |
| 04 | Profile | View (except follower/following lists) | ○ | View + "Send recruiting offer"; own profile is the recruiter my page (incl. job ad sheet) | Same as developer |
| 05 | Edit profile | × | ○ incl. job categories of interest | ○ name, company, job title, website (company email can't change) | Same as developer |
| 06 | Settings | × | ○ | ○ no GitHub items, subscription is Scout only, has change password | Same as developer |
| 07 | Workspace home / my issues (`/workspace`, `/workspace/issues`) | Prompt | ○ | × | Same as developer |
| 08 | Create team | Prompt | ○ | × | Same as developer |
| 09 | Team settings & members | × | Per team role (ch. 6) | × | Same as developer |
| 10 | Accept invite | View team preview, accept = prompt | ○ | × "개발자 계정만 팀에 참여할 수 있어요" (only developer accounts can join teams) | Same as developer |
| 11–15 | Issue list/detail/create, board, calendar | × | Team members only; writes need repo write permission (ch. 7). The progress card above the issue list is Flex teams only (POL-T-7) | × | Same as developer |
| 16 | Chat list | Prompt | ○ team / 1:1 / requests | ○ 1:1 tab only | Same as developer |
| 17 | Chat room | × | ○ team & 1:1 | ○ 1:1 only; conversations start only via request | Same as developer |
| 18 | Notifications | Prompt | ○ | ○ | Same as developer |
| 19 | Recruit post list | View (All tab) | ○ | View (when arriving via link, no tabs) | Same as developer |
| 20 | Write/edit recruit post | Prompt | ○ | × | Same as developer |
| 21 | Recruit post detail | View; apply = prompt | ○ apply; author manages applicants | View | Same as developer |
| 22 | Write/edit project post | Prompt | ○ | × | Same as developer |
| 23 | Project post detail | View (except list of likers) | ○ | View + "Send recruiting offer" to author | Same as developer |
| 24 | Home feed | View (popular this week + latest, no job ads) | ○ following + recommended + job-category job ads | View (recommended only, "only developers open to offers" toggle, no job ads) | Same as developer |
| 25–27 | Ops: reports, users, action log | × | × | × | ○ (permanent suspension, lifting sanctions, reviewing appeals = lead operator) |
| 28·29 | Plans & checkout, manage subscription | Prompt | ○ Pro/Flex | ○ Scout only | Same as developer |
| 30 | My stats | Prompt | ○ free scope; Pro adds traffic sources and recruiter view counts | × | Same as developer |
| 31·32 | Recruiter sign-up / login | ○ | × (logged in) | To feed if logged in | × |
| 33 | Sent offers list | × | × | ○ | × |

**By action**

| Action | Guest | Developer | Recruiter | Operator | Related policy |
| --- | --- | --- | --- | --- | --- |
| Like / comment | Prompt | ○ | × (lists visible) | Same as developer | POL-P-5 |
| Follow | Prompt | ○ (can't follow recruiters) | × | Same as developer | POL-P-5 |
| Start 1:1 chat | Prompt | ○ direct if mutual follow / same team, otherwise request | Only via recruiting offer request | Same as developer | Ch. 8 |
| Send recruiting offer | × | × | ○ to Seeking / Open-to-offers developers, 10/day (Scout 50) | × | POL-H-3 |
| Set job-seeking status | × | ○ | × | Same as developer | POL-H-4 |
| Set job categories of interest | × | ○ up to 3 | × | Same as developer | POL-H-8 |
| Register / toggle job ad | × | × | ○ with Scout, 1 ad | × | POL-H-7 |
| See / close / hide job ads | × (no ads) | ○ when job categories match | × (no ads) | Same as developer | POL-H-9 |
| Apply to recruit post | Prompt | ○ | × | Same as developer | POL-R-3 |
| Create / join team | Prompt | ○ max 10 teams | × | Same as developer | Ch. 6 |
| Write post / recruit post | Prompt | ○ | × | Same as developer | Ch. 4, 5 |
| Share (copy link) | ○ | ○ | ○ | Same as developer | POL-P-7 |
| Share (share to chat room) | Prompt | ○ team chat rooms and open 1:1 rooms | ○ open 1:1 rooms | Same as developer | POL-P-7 |
| Report | Prompt | ○ | ○ | Same as developer | Ch. 9 |
| Block | Prompt | ○ (can block recruiters too) | ○ | Same as developer | Ch. 9 |
| Subscription payment | Prompt | ○ Pro/Flex | ○ Scout only | Same as developer | Ch. 11 |
| AI chat summary | × | Flex team members only (free teams see Flex prompt sheet) | × | Same as developer | POL-C-5 |
| View project progress graph | × | Flex team members only (free teams see Flex prompt) | × | Same as developer | POL-T-7 |
| Hide/delete content, sanctions | × | × | × | ○ reason required, all logged | Ch. 9, 10 |

### Rate limits

Limits to prevent spam and abuse. On hitting a limit show "잠시 후 다시 시도해 주세요" (please try again later); accounts exceeding 3× a daily limit go on the operator review list.

| Action | Limit |
| --- | --- |
| Write post | 10/day |
| Write comment | 10/min, 300/day |
| Follow | 200/day |
| Write recruit post | Max 3 open (Pro 10), 5/day |
| Apply | 20/day |
| Chat message | 5/sec (beyond that, sending is delayed) |
| Report | 20/day |
| Recruiting offer (recruiter's new 1:1 chat request) | 10/day, Scout 50/day |
| Job ad edits | 10/day |
| Job ad impressions (per developer) | 3/day, same ad once per day |
| Create issue | 100/day (protects GitHub limits) |
| AI chat summary | 10/day per Flex team member |
| Share to chat room | 10/min, 100/day (separate from chat message limits) |
| Guest reads | 60/min per IP (anti-scraping). Verified search engine bots (Google, Naver) get a separate limit for search exposure (POL-A-9) |

### Network and failures

- If sending a post/comment/issue fails, save the input on the device and show "다시 보내기" (resend). Drafts are deleted after 7 days.
- Failed chat messages get resend/delete buttons next to the bubble; auto-retry up to 3 times.
- If GitHub doesn't respond, show screens from the Linker cache with a top banner "GitHub 연결이 불안정해 최신 정보가 아닐 수 있어요" (GitHub connection unstable; info may be outdated).
- Light actions like likes/follows are applied on screen first; on failure, revert and notify briefly.

## 3. Account & profile

| Policy | Details |
| --- | --- |
| POL-A-1 Sign-up | Developers: 1 GitHub account = 1 Linker account. Age 14+, consent to Terms and Privacy Policy required |
| POL-A-1 Session | Login session 30 days, extended on each use. Server auto-refreshes expired GitHub tokens; on failure, request re-login |
| POL-H-1 Recruiter sign-up | Email + password. Company domain email only (no free email like Gmail, Naver). Age 19+, consent to Terms, Privacy Policy and Business Member Supplementary Terms required. Details in "Recruiter accounts" below |
| POL-A-2 Name & handle | Handle = GitHub login as-is (not editable; follows GitHub changes). Display name 1–20 chars |
| POL-A-2 Bio & link | Bio ≤ 160 chars, one blog link (https only) |
| POL-A-3 Tech stack | Up to 10 from a predefined tag list |
| POL-A-3 Looking for team | When on, shown on profile and in Find Team search. Auto-off after 30 days without login |
| POL-H-4 Job-seeking status | One of Seeking / Open to offers / Off; default Off. Set independently from "looking for team". See "Job-seeking status" table below |
| POL-A-4 Contribution graph | Public contributions only. Private contributions shown as counts only if the user enabled that on GitHub. Refreshed once a day. Help text next to the graph: "커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 잔디에 잡혀요" (commit email must be registered to your GitHub account to count) |
| POL-A-5 Completion record | Number of completed projects the user stayed in until the end, and the share of assigned issues completed in those projects. Calculation in POL-T-4 |
| Pinned featured posts | Pin own posts at the top of profile: Free 1, Pro 5. Reorderable. When Pro ends, existing pins stay; free limit applies to new pins |
| Post stats & recruiter view alert | Visible only to self. Free/Pro scope in ch. 11 |
| Profile visibility | Profiles are public to everyone including guests. But "Open to offers" is visible only to recruiters, and follower/following lists only to logged-in users (see "Guests" below) |
| Account deletion | Deactivated immediately, deleted after 30 days (restored if logging in meanwhile). Posts and comments deleted; team chat messages show "탈퇴한 사용자". A team owner can't delete before transferring ownership |
| GitHub disconnect | If app authorization is revoked on GitHub, request re-login on next visit. Data kept |

### Recruiter accounts

In MVP, sign-up completes with company email verification alone and the account is usable immediately. Operator pre-approval, business registration number check and yearly re-verification come in phase 3. Instead, who can be contacted and how often is narrowed, and problems are handled after the fact via reports.

| Item | Rule |
| --- | --- |
| Company email verification | 6-digit code sent by email. Valid 10 min; 5 wrong attempts require a new code; resend once per minute. Account is created only after verification |
| Free email block | Server-configured list: gmail.com, naver.com, daum.net, kakao.com, hanmail.net, outlook.com, hotmail.com, yahoo.com, icloud.com, etc. Free email domains not on the list are added when reported |
| Fields | Required: name (display name, 1–20 chars), company (2–40 chars), job title (e.g. tech recruiter, 1–30 chars). Optional: company website (https) |
| Password | 8–64 chars, must include letters and digits. 5 wrong attempts → 10-min lock |
| Password reset | Reset link sent to the sign-up email, valid 30 min, single-use. Changing it logs out all other devices |
| Handle | No GitHub handle, so auto-generated as `r-` + number (for profile URL, not editable) |
| Display | Company name next to name; profile shows job title and "회사 메일 인증(@company-domain)" (company email verified). Never use wording that vouches for the company like "인증된 회사" (verified company) |
| Can do | View feed, posts, profiles, recruit posts; send recruiting offer messages to developers with job-seeking on (ch. 8); view sent offers on my page; Scout subscription and one job ad (see "Job ads" below); report/block |
| My page | Instead of the developer my page (graph, completion record, posts, follows), shows company info, offer summary, sent offers list, job ad (status, on/off, edit), settings |
| Can't do | Posts, comments, likes, follows; teams, recruit posts, applying; Pro/Flex subscriptions. Developers can't follow recruiters either |
| Multiple people per company | Allowed. Accounts are per person; no company accounts |
| Also a developer | Even the same person keeps separate developer and recruiter accounts. One account never switches roles |
| Account deletion | Same as developers (30-day pending deletion, then anonymized). Already-sent messages remain in the other party's chat as "탈퇴한 사용자" |

### Job-seeking status

| Value | Who sees it | Recruiter messages |
| --- | --- | --- |
| Seeking (구직 중) | Everyone. "구직 중" badge on profile header and next to the author on feed cards | Receives |
| Open to offers (제안만 받기) | Recruiters only. Not shown among developers | Receives |
| Off (끔, default) | Not shown | Doesn't receive. No "Send recruiting offer" button on profile |

- Turning job-seeking off blocks only new offers. Already accepted conversations and pending requests stay.
- After 90 days without login, set to Off and send a "구직 상태를 껐어요" (we turned off your job-seeking status) notification on next login.
- To avoid recruiters from one's current company, block that person. Company-level block comes in phase 3 (formal offer box).

### Job ads (POL-H-5·7·8·9)

A recruiter with a Scout subscription shows their posting from an external job site as an ad in the feed of developers who picked the same job category. The posting detail is handed off to the external site; Linker builds no posting detail screen. Ads are chosen only by job categories the developer picked themselves, never by behavioral data such as screen views or clicks.

**Job category list**: Frontend, Backend, Full-stack, Mobile (iOS/Android), Data/AI, DevOps/Infra, Game, Embedded, Security, QA. Managed in server config.

| Policy | Details |
| --- | --- |
| POL-H-8 Job categories of interest | Developer picks up to 3 from the list in profile edit. Optional, empty by default. Visible only to the developer; not shown on the profile or to recruiters. Empty = no job ads. UI copy "관심 직군을 고르면 그 직군의 채용 광고만 피드에 보여요. 비워 두면 광고가 뜨지 않아요." (Pick job categories to see only job ads for them in your feed. Leave empty for no ads.) |
| POL-H-5 Scout subscription | Paid by recruiters only. Benefits: one job ad and 50 recruiting offers per day (free: 10). No free trial. When it ends, the ad stops showing (content kept) and the offer limit becomes 10/day from the next day |
| POL-H-7 Fields | One job category, posting title 2–40 chars, posting URL, closing date (within 90 days from today), all required. Company name is attached from the recruiter profile. No images |
| POL-H-7 Allowed URLs | https only. Only one of: ① allowed job sites jobkorea.co.kr, saramin.co.kr, wanted.co.kr, work24.go.kr (WorkNet merged into Work24) and their subdomains ② the verified company email domain and its subdomains (e.g. signed up with @abc.com → abc.com, careers.abc.com). Short URLs, IP addresses and other domains rejected. Allowed-site list in server config |
| POL-H-7 Count & status | One ad per recruiter. Status: showing / off (turned off by owner) / ended (closing date passed or subscription ended) / hidden (operator action). Changing the closing date allows turning it on again |
| POL-H-7 Review | No operator pre-review; showing starts on save. Handled after the fact via reports (ch. 9) |
| POL-H-9 Audience | Logged-in developers whose job categories include the ad's category. No ads for guests, recruiters or people with empty categories. Not shown to people who blocked the advertising recruiter |
| POL-H-9 Frequency | One per 10 feed posts (never on the first screen), max 3 per person per day, same ad once per day. Multiple matching ads rotate. Ad spend never affects post ranking |
| POL-H-9 Card | "광고" (Ad) label at top, company, posting title, job category, closing date, "외부 공고 보기" (View external posting) button, X at top right, more (⋯) menu. Different background color from regular posts |
| POL-H-9 On tap | Server records the click and returns the posting URL; opened in an external browser after confirmation per the common external link rule (ch. 2) |
| POL-H-9 X close | Hides that ad for 7 days. Undo toast "광고를 닫았어요 · 되돌리기" (Ad closed · Undo) |
| POL-H-9 Hide this ad | In the more menu. Hides that ad permanently. Report is in the same menu |
| Aggregation | Impressions/clicks aggregated per ad per day only. Recruiters are never told who saw the ad. Stats screen in phase 4 |

- **When the closing date passes** → set to "ended" at 00:00 the next day and notify the recruiter "채용 광고가 마감돼 노출을 멈췄어요" (Your job ad closed and stopped showing).
- **When the Scout subscription ends** → showing stops at that time; resubscribing shows it again right away if the closing date hasn't passed.
- **If a company site on a different domain is entered** → rejected with "회사 메일 도메인(@abc.com)과 같은 주소이거나 허용 채용 사이트의 공고만 넣을 수 있어요" (Only URLs on your company email domain or allowed job sites).
- **If the recruiter is suspended** → the ad is hidden at once and stays hidden until an operator unhides it after the suspension ends.
- **If the external posting is taken down first** → Linker doesn't check external pages, so it shows until the closing date. If a developer reports it, an operator hides it.

### Guests (POL-A-9)

Login is a condition for "actions," not an entrance gate. Anyone can read; only logged-in users react, write and participate.

| Category | Details |
| --- | --- |
| Can read | Home feed (popular this week and latest; "why shown" only "이번 주 인기" / "새로 올라온 작업물"), post detail (photos, repo card, README, comment list, like count), recruit post list (All tab) and detail (body, remaining slots per role, author card), profiles (header, tech stack, graph, completion record, posts, teams), legal documents, team preview of invite links |
| Login required to see | Follower/following lists, list of likers (people lists are easy to scrape), "Open to offers" (recruiters only), applicant list (author only) |
| Login-prompt sheet | Like, write comment, follow, apply, message/recruiting offer, report, block, write post/recruit post buttons; bottom tabs Workspace, Chat; the header's profile icon (my profile); notifications in the header |
| Sheet copy | "로그인한 사용자만 쓸 수 있는 기능이에요" (this feature is for logged-in users) + "GitHub로 시작" (start with GitHub) + small link "채용 담당자 로그인" (recruiter login). After login, returns to the screen being viewed (does not perform the attempted action) |
| Layout | Still 4 bottom tabs; a "로그인" button in place of the header bell. First visit to `/` shows the intro screen; "둘러보기" (browse) enters the feed. Shared links (posts, recruit posts, profiles) open directly without the intro |
| Hidden / blocked | Content hidden by reports and suspended accounts are handled the same as for logged-in users. Blocking is a relationship between accounts, so it doesn't apply to guest screens |
| Search engines | **Developer profiles, posts and recruit posts readable by guests are exposed to search engines** (indexing allowed, sitemap provided). Start screen and legal docs also exposed. Recruiter profiles, login-only screens and operations pages are `noindex`. Content hidden by reports, suspended / pending-deletion accounts and deleted content become "unavailable content", `noindex`, and are removed from the sitemap. Follower/following/liker lists require login so they aren't exposed |
| Stats | Guest visits are not counted in recruiter view counts or post view stats (MVP) |
| Rate limit | Guest read limit in the "Rate limits" table above |

### Exceptions

- **User changes their GitHub handle** → accounts are matched by GitHub user id, so login still works; on next login, handle and profile URL update. Old URL redirects to the new one for 90 days.
- **User deletes their GitHub account** → can't log in, so after 30 days switch to pending deletion and follow the deletion process.
- **User deletes the account while suspended and signs up again** → with the same GitHub account, sanction records (kept 1 year) carry over and the remaining suspension applies.
- **Permanently suspended GitHub account** → can't sign up again (ch. 9 sanction steps).
- **No public email on GitHub at sign-up** → collect and verify a separate email for notifications/account notices. Not shown on profile.
- **Team owner tries to delete the account** → show the teams they own; they must transfer ownership or delete each team before proceeding.
- **Signing up again with an already-registered company email** → show "이미 가입된 이메일이에요 · 로그인 · 비밀번호 찾기" (already registered · log in · reset password). If pending deletion, logging in restores it.
- **Recruiter tries to log in with GitHub** → a separate account of a different member type is created. The recruiter screens don't show the "GitHub로 시작" button.
- **Recruiter reported as having left the company** → operator verifies and suspends. Automatic email re-verification is phase 3.
- **Contribution graph fails to load** → show the last fetched values with "N일 전 기준" (as of N days ago); if never fetched, hide the graph area.

## 4. Project posts, feed, social

| Policy | Details |
| --- | --- |
| POL-P-1 Repo selection | Only **public** repos of the user's account or orgs they belong to. Private repos can't be selected. One post per repo (progress updates are phase 2) |
| POL-P-1 Repo changes | If the repo becomes private or is deleted, keep the post, show the repo card as "레포를 볼 수 없음" (repo unavailable), hide the README toggle |
| POL-P-2 Required fields | Repo, one-line intro (1–60 chars) |
| POL-P-2 Body | ≤ 2,000 chars, no markdown, only line breaks and links |
| POL-P-2 Photos | Free 5 / Pro 10, 10MB each, JPG/PNG/WebP/GIF. Resize long side to 2,048px and strip EXIF on upload. First photo is the cover |
| POL-P-2 Optional fields | My role 40 chars, up to 3 demo links (https), period (start/end month), team size (1–50), up to 5 tags |
| POL-P-2 Edit/delete | Author can edit/delete anytime. Edited posts show "수정됨" (edited). Deleting also deletes likes and comments |
| POL-P-3 README | Collapsed by default. Cached for 1 hour rather than fetched from GitHub each time. Scripts and HTML stripped before display |
| POL-P-4 Feed composition | 1 recommended post per 4 following posts. Only recommendations if following nobody. At most 2 consecutive posts from the same author. Job ads: 1 per 10 posts (POL-H-9) |
| POL-P-4 Recommendation pool | Posts from the last 7 days with many likes/comments, posts by mutual follows of mutual follows (2nd-degree). Exclude already seen, own posts, blocked users' posts, hidden posts |
| POL-P-5 Likes | Once per post, can undo. List of who liked is public |
| POL-P-5 Comments | ≤ 500 chars, one level of replies. Author can edit/delete; post owner can delete only. Deleting a comment with replies shows "삭제된 댓글입니다" (deleted comment) |
| POL-P-5 Follow | Follow immediately without approval. 200/day limit (anti-abuse). Mutual follow = following each other |
| POL-P-7 Share button | Posts, recruit posts and profiles have a share button. It opens a bottom sheet with only two options: "링크 복사" (Copy link) / "채팅방에 공유" (Share to chat room). Guests can only copy the link; "Share to chat room" shows the login prompt |
| POL-P-7 Copy link | Copies the page's public URL and shows a "링크를 복사했어요" (link copied) toast. A share marker (`?from=share`) is appended so the visit counts as traffic source "external link" |
| POL-P-7 Share to chat room | Pick one room from my chat room list (most recent first, search by name); it is sent immediately as a card message with no extra confirmation, and a "○○에 공유했어요 · 채팅방으로 가기" (shared to ○○ · go to chat room) toast appears. The list contains only team chat rooms I belong to and 1:1 rooms whose conversation is open (excludes pending requests, request box, blocked partners, read-only or archived teams) |
| POL-P-7 Share card | Post: cover photo, repo name, one-line intro, author. Recruit post: title, remaining roles, closing date. Profile: name, handle, tech stack. The card doesn't copy content at send time; it reads the latest state when shown. If the original was deleted or hidden, or the viewer blocked the author, it shows "볼 수 없는 게시물이에요" (this post is unavailable) |
| Blocking | Follows ch. 9 "Blocking" |

### "Why shown" copy

If a post has several reasons, show only the highest one.

| Priority | Condition | Copy |
| --- | --- | --- |
| 1 | Someone I follow liked it | OO님이 좋아해요 (OO likes this) |
| 2 | Written by a 2nd-degree connection | OO님과 아는 사이 (knows OO) |
| 3 | Overlaps my tech stack tags | React를 쓰는 사람들의 인기 글 (popular among React users) |
| 4 | Top likes/comments in the last 7 days | 이번 주 인기 (popular this week) |

Popularity score = likes × 1 + comments × 2 (excluding the author's own), decaying with post age. Likes from accounts less than 7 days old don't count (prevents like-for-like manipulation).

### Exceptions

- **Repo renamed or transferred to another account** → tracked by GitHub repo id; card info refreshed once a day. Post author doesn't change.
- **Forked repo** → can be posted, but the card shows "포크" (fork) and the original repo.
- **Org repo with none of my commits** → can be posted, but the card shows "내 커밋 0개" (0 of my commits). Shows 0 also when the commit email isn't registered to GitHub, so commit counts are never used as evidence for plagiarism or sanctions. If 0 or low, show the author "커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 숫자에 잡혀요" with a link to GitHub email settings.
- **Several teammates post the same repo** → each can post; the detail page groups "이 레포의 다른 게시물" (other posts for this repo).
- **Only some photos upload** → show retry on failed photos; publishing allowed only after all upload.
- **Post hidden by reports** → author sees "검토 중" (under review); removed from others' feeds. Likes and comments blocked.
- **Empty feed** (right after sign-up) → recommend 5 developers by my tech stack plus popular posts.
- **Someone I follow is suspended or deletes their account** → keep the follow, remove their posts from the feed. If deleted, the follow is removed too.

## 5. Find Team

Recruit posts have only two states: open → closed. Closed posts leave the list and accept no new applications, but the author can reopen.

| Policy | Details |
| --- | --- |
| POL-R-1 Who can write | Any logged-in user (developer). Can write without a team; guided to create a team (POL-T-1) at the first acceptance |
| POL-R-1 Concurrent posts | Max 3 open posts per person (Pro 10) |
| POL-R-1 Required fields | Title (40 chars), intro (1,000 chars), needed roles and headcount (1–10 per role), format (online/offline/hybrid), deadline (within 60 days from today) |
| POL-R-1 Optional fields | Up to 10 tech stack tags, expected duration, region (required if offline), goal (contest/hackathon/launch/learning) |
| POL-R-1 Auto-close | Closes automatically when the deadline passes or all roles are filled |
| POL-R-2 List | Open posts only, newest or closing soon. Filters stored in URL |
| POL-R-3 Apply | Choose one role, message ≤ 300 chars. Once per post (re-apply once after cancelling). Not allowed on own posts or with a block relationship |
| POL-R-3 Application | Profile (tech stack, graph, posts, completion record) attached automatically |
| POL-R-4 Handling | Author accepts/rejects. Auto-expires after 14 days unhandled, with notification to applicant |
| POL-R-4 After accept | Added as team member, joins team chat. If the author is an org owner, show a GitHub org invite button (not sent automatically) |
| POL-R-4 Reject | Rejection reason optional. Applicant is only told "이번엔 함께하지 못하게 됐어요" (we couldn't team up this time) |

### Application status

| Status | Reached when | Applicant sees |
| --- | --- | --- |
| Pending | Application submitted | "검토 중" (under review) |
| Accepted | Author accepts | Shortcut to team chat |
| Rejected | Author rejects | "이번엔 함께하지 못하게 됐어요" |
| Expired | 14 days unhandled, or recruit post deleted | "모집이 끝났어요" (recruiting ended) |
| Cancelled | Applicant cancels (only while pending) | Disappears from list |

Pending applications stay when a recruit post closes; the author can still accept/reject after closing.

### Exceptions

- **Editing a recruit post that has applicants** → title, intro and deadline are editable, but roles with applicants can't be deleted and headcount can't go below current acceptances.
- **Recruit post deleted** → pending applications become expired and applicants are notified. Accepted people stay in the team.
- **Accepting when that role is full** → ask "인원을 늘리고 수락" (increase headcount and accept).
- **Free team member limit reached** (6) → can't accept; show the reason and a Flex prompt (Flex teams have no member limit).
- **Author has no team yet when accepting** → must finish team creation (link a GitHub org) before accepting. Applications stay pending meanwhile.
- **Applicant is already a member of that team** → show "이미 함께하는 팀이에요" (already on this team) instead of the apply button.
- **Accepted applicant doesn't accept the GitHub org invite within 7 days** → stays in the Linker team and can chat, but doesn't appear as assignable for issues. Notify applicant and owner again.
- **Fake recruitment reported** → follow report/sanction policy. If the author deletes the team within 7 days after accepting, auto-flag for fake-recruitment review.

## 6. Teams & permissions

Team roles: owner, admin, member. Actions that write to GitHub (issues, PRs) follow the person's GitHub repo permission regardless of Linker role.

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| Edit team name/intro | O | O | X |
| Delete team, transfer ownership | O | X | X |
| Add/remove linked repos | O | O | X |
| Create Linker invite link | O | O | X |
| Send GitHub org invite | Only if GitHub org owner | Only if GitHub org owner | X |
| Remove members, change roles | O | Members only | X |
| Write team recruit posts, handle applications | O | O | X |
| Create/assign/change status of issues | GitHub permission | GitHub permission | GitHub permission |
| Mark project complete | O | O | X |
| Delete others' messages in team chat | O | O | X |

| Policy | Details |
| --- | --- |
| POL-T-1 Create team | 1 GitHub org = 1 Linker team. "Create team" goes to the GitHub App install screen to choose an org and install; back in Linker, the server must re-verify the installation with the user token before creation completes (the installation id in the return URL can be forged, so it's never trusted as-is). If no org, send to GitHub's create-org page and back (orgs can't be created via API). If not the org owner, guide to "request install from owner" (GitHub emails the owner). If the org's default repo permission is read, tell the owner "팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요" (members need write permission to set assignees/labels) with a GitHub settings link. Team size: Free 6, Flex no limit |
| POL-T-2 Invites | Linker invite links valid 7 days, revocable by owner/admin. GitHub org invites follow GitHub rules (accepted on GitHub, daily send limit) |
| Org member sync | People removed from the GitHub org are detected via the organization webhook (member_removed), automatically removed from the Linker team, and they and the owner are notified. Removing someone in Linker does not remove them from the GitHub org; the owner is only informed |
| Leaving / removal | Members can leave anytime. Owner can't leave before transferring ownership. After leaving, team chat history stays but new messages aren't visible |
| App uninstall | If the Linker app is removed from the org, the team becomes read-only and the owner is told to reinstall. Archived after 30 days |
| POL-T-4 Project completion | Owner/admin marks complete. Can be undone within 7 days; after that, completion records are finalized |
| POL-T-4 Completion calculation | Members in the team at completion who belonged ≥ 14 days during the project get 1 completion. Members who left midway get 1 non-completion (reason not shown). Issue completion rate = share of assigned issues in done status |

### Team status

| Status | Meaning | Can do |
| --- | --- | --- |
| Active | Default | Everything |
| Completed | Owner/admin marked the project complete | Chat and issues continue; no new recruit posts. "다시 시작" (restart) returns to active (completion records stay once finalized) |
| Read-only | Linker app removed on GitHub | View chat and existing issues only. Reinstall → active |
| Archived | 30 days in read-only, or archived by owner | Members see it only as "보관된 팀" (archived team) and can read chat history |
| Deleted | Owner confirms deletion by typing the team name | Members notified; chat deleted after 30 days. GitHub org and issues untouched |

### Exceptions

- **Transferring ownership** → choose a team member; transfer happens only when they accept. The old owner becomes admin. The Linker owner needn't be the GitHub org owner, but if not, the org invite button is disabled.
- **Owner permanently suspended or inactive for 90 days** → the longest-serving admin gets a button to take ownership; if no admins, the longest-serving member.
- **GitHub org deleted or renamed** → deletion is handled like app uninstall; rename is tracked by org id.
- **App installed on only some repos** → only installed repos can be linked; others show a "GitHub에서 접근 허용하기" (grant access on GitHub) link.
- **One person in many teams** → up to 10 teams. Archived teams don't count.
- **Removed member wants to rejoin** → possible via a new invite or application. For 7 days after removal they can't apply to the same team's recruit posts.
- **Someone has blocked a teammate** → team chat is not blocked; only 1:1 chat and profile are. If work becomes difficult, guide them to report or ask the owner.

## 7. Issues & schedule

| Policy | Details |
| --- | --- |
| POL-I-1 Source of truth | Issues, assignees, labels: GitHub Issues. Dates and status: GitHub Projects. Linker writes to GitHub with the author's own permission and refreshes its cache via webhooks |
| POL-I-1 Templates | 3 default templates (bug/feature/task) + the repo's .github/ISSUE_TEMPLATE. If both exist, repo templates go on top. If the repo has none, use the org's public .github repo templates (GitHub rule). Issue forms (YAML) render as in-app inputs; answers are written to the body in GitHub's format ("### question" then the answer, empty = _No response_). labels/assignees/projects/type in the form are applied by Linker. File upload fields are phase 2 (hidden in MVP with "첨부는 GitHub에서" — attach on GitHub) |
| POL-I-1 Create failure | If GitHub permission is missing or the request fails, keep the input as a draft and show the reason. Never create Linker-only issues |
| POL-I-2 Assignees | Only team members with access to that repo (max 10 due to GitHub). Members with read permission can still be assigned. If the person assigning lacks repo write permission, GitHub silently ignores it, so disable assignee/label buttons and show the reason in a toast on tap. After saving, verify from GitHub's response that the assignee was actually set |
| POL-I-3 Status mapping | 작업 전 = Todo, 작업 중 = In Progress, 작업 중단 = Blocked, 작업 완료 = Done. An issue closed on GitHub → Done; moving to Done closes the issue. Blocked keeps the issue open and shows "중단" (blocked) on the card |
| POL-I-3 Dates | Start ≤ due. Issues without a due date don't appear on the calendar; they're listed under "일정 없음" (no schedule) |
| Concurrent edits | If the same value changes in Linker and GitHub at once, the later arrival wins. The user's screen refreshes to the latest value |
| POL-I-4 Overdue | Issues past due and not done are shown in red. Team timezone is KST |
| POL-I-4 Status board | Change via drag or the "상태 바꾸기" (change status) menu. If writing to GitHub fails, move the card back to its original column and notify |
| POL-I-5 My issues (07) | Not a cross-team list. The user selects one of their teams; the list shows only issues assigned to them in that team. Default team = most recently joined (`team_members.joined_at` desc; prefer non-archived). Selection kept in the URL (`teamId`). Invalid / non-member `teamId` falls back to the default team. Sort by due urgency: overdue first (oldest due first), then soonest due, then no due date. `/workspace` shows a short UI-limited preview (not a fixed count); “내 이슈 전체 보기” opens `/workspace/issues` for the full selected-team list. Team-wide (all members’) issues are on page 11, not here |

### Preparing GitHub Projects

- A team links to exactly one GitHub Projects board, chosen once at team creation. If the org has no board, auto-create a "Linker" board with Status (Todo, In Progress, Blocked, Done), Start date and Due date fields. If boards exist, choose "새로 만들기" (create new) or "기존 보드 쓰기" (use existing); for existing boards, preview name, card count and status column names in the picker. No per-screen board switcher; to change it, owner/admin change it in team settings.
- When choosing an existing board, map its Status values once to Todo / In Progress / Blocked / Done (e.g. Blocked → 작업 중단). Linker adds missing start/due date fields. Unmapped values appear in an "기타" (other) column on the board.
- Issues created in Linker are added to the project automatically. Issues created on GitHub appear on calendar/board only if they're in the project; others can be added from the "일정 없음" list.

### Sync

- On webhook receipt, refresh the cache immediately. In case webhooks are missed, full sync every 15 min for active teams and once a day for others.
- Pulling down on a screen re-fetches only that screen's issues from GitHub (once per minute).
- Sync and webhook follow-up reads use per-org installation tokens (5,000–12,500/hour); user tokens (5,000/hour, shared with other apps) are used only for writes needing the user's identity (create issue, assign, org invite).
- Creating one issue makes separate calls: create issue → add to project → start date → due date → status. If a middle step fails, the server retries remaining steps; if it keeps failing, the issue card shows "일정이 GitHub에 반영되지 않았어요" (schedule not applied to GitHub). Closing on move-to-Done is also a separate call.
- The GitHub API can't upload files to issues, so images Linker puts in issue bodies are stored on the Linker server and inserted as long, hard-to-guess links. Whether images uploaded to private-repo issues on GitHub are visible in Linker is tested early in development.

### Exceptions

- **Repo template is an issue form (YAML)** → show inputs (text, textarea, dropdown, checkboxes) as a mobile form; unsupported items go into the body as headings only. If parsing fails, use the default template.
- **Assignee leaves the team** → keep the GitHub assignment; Linker shows "팀 밖 사용자" (outside the team). Notify owner/admin to reassign.
- **Issue deleted or transferred on GitHub** → deletion also deletes it in Linker and cards shared in chat become "삭제된 이슈" (deleted issue). Transfers are followed to the new location.
- **Issue moved from Done back to In Progress** → reopen the GitHub issue too.
- **Due date set in the past** → not blocked; confirm once with "이미 지난 날짜예요" (that date has passed).
- **Repo where I only have read permission** → issues visible, but create/assign/status buttons disabled with the reason.
- **Sub-issues (phase 2)** → in MVP, sub-issues created on GitHub are view-only; the parent card shows progress like "하위 3개 중 1개 완료" (1 of 3 sub-issues done).

### Project progress graph (POL-T-7)

Flex teams get a "진행 현황" (Progress) card at the top of the issue tab. It is drawn only from status board data (POL-I-3); no new input.

| Item | Rule |
| --- | --- |
| Completion rate | Done / all issues on the board (open and closed, excluding OTHER). "12개 중 7개 완료, 58%" (7 of 12 done, 58%) |
| Counts by status | Bars for the 4 columns Todo / In Progress / Blocked / Done, with column names written out alongside color |
| Last 14 days | Daily counts of the 4 columns as stacked area or lines. A batch at 00:00 KST stores a per-team snapshot; today's value is drawn from current state |
| Per assignee | Open issues (Todo, In Progress, Blocked) per assignee. No ranking or done-count comparison (it shows load, and must not be confused with completion records) |
| Due | Number of overdue issues and issues due within 3 days; tapping opens the calendar / my-issues filter |
| Snapshots | Stored daily for free teams too (so history shows as soon as Flex starts). Rows older than 1 year deleted |
| Accessibility | Each chart has a numeric summary sentence, and "표로 보기" (View as table) shows the same values as a table. Status is never distinguished by color alone |
| Free teams | In the card's place, copy plus "Flex 알아보기" (owner/billing manager) or "오너에게 요청" (ask the owner) |

## 8. Chat & notifications

| Policy | Details |
| --- | --- |
| Messages | Text 2,000 chars; up to 10 images at once, 10MB each (location data stripped). No file attachments in MVP |
| Edit/delete | Own messages editable within 24 hours ("수정됨"), deletable anytime ("삭제된 메시지입니다" — deleted message) |
| Read status | Team chat shows unread count; 1:1 shows read/unread. "Last read position" is the basis for AI summary (POL-C-5) |
| POL-C-2 Issue cards | Cards show the latest status. Issues from repos without permission show title only |
| POL-C-3 PR posting | Only PR opened, review requested, merged, closed in linked repos. No commits or comments. System messages can't be deleted |
| POL-C-4 Starting 1:1 chat | Direct conversation if mutual follow or same team. Otherwise only one first message goes to "메시지 요청함" (message requests); the conversation opens only on acceptance. Recruiters have no follows/teams, so always go to requests (see "Recruiting offer messages") |
| Chat retention | Team chat kept while the team exists. 1:1 chat deleted when both leave |
| Team chat search & scroll-back | Keyword search in team chat rooms. Free teams can search and scroll back only through the last 60 days (older messages are hidden, not deleted, and reappear with Flex). Flex teams: all history. Deleted/hidden messages not searchable. 1:1 chat search excluded from MVP |
| POL-N-1 Notification types | Chat, issue assignment, 1 day before due (9 AM), application received/accepted/rejected, comments, follows, message requests (incl. recruiting offers) |
| POL-N-1 Bundling & quiet hours | Notifications from the same chat room bundled into one. 10 PM–8 AM: no non-chat notifications; sent together in the morning. Marketing notifications (opt-in only) not sent 9 PM–8 AM |
| Muting | MVP: mute per chat room and the "푸시 알림" (Push notifications) on/off switch in settings only. Turning push off stops push only; the in-app notification list keeps filling. Per-type settings in phase 2 |
| Push devices | Only the Android app (development build) receives push. iOS app push needs a paid Apple developer account, so it is out of the MVP; browser web push is phase 2 (N-2) |

### Mentions and links

| Item | Rule |
| --- | --- |
| @person | Mentioning a team member in team chat notifies them even if they muted the room |
| @all (@전체) | Owner/admin only. Not sent to people who muted the room |
| #issue-number | Issue/PR numbers from linked repos become cards. If multiple repos, ask which repo |
| Link preview | Title/image preview (OG) for only the first external link in a message. In 1:1 chat only when mutual follow |
| POL-C-7 Linker link card | If a message contains a Linker post, recruit post or profile URL, the first one is read from the server DB and shown as the same card as share cards (POL-P-7). It is our own content, so no mutual-follow condition. Counted separately from the external link preview |

### 1:1 chat request status

| Status | Reached when | Sender sees |
| --- | --- | --- |
| Requested | First message sent | Can't send more; "상대가 수락하면 대화가 열려요" (conversation opens when they accept) |
| Accepted | Recipient accepts | Normal conversation |
| Rejected | Recipient deletes | No change (rejection not disclosed). No new requests to the same person for 30 days |
| Expired | No response for 30 days | No change. Disappears from requests |

### Recruiting offer messages (POL-H-3)

In MVP a recruiting offer is not a separate offer form but a 1:1 chat request. It follows the "1:1 chat request status" rules above, with only these differences.

| Item | Rule |
| --- | --- |
| Sender | A recruiter who completed company email verification (not while suspended) |
| Recipient | Developers with job-seeking status Seeking or Open to offers. If Off, no button and the API rejects |
| Entry points | "채용 제안 보내기" (send recruiting offer) on a developer profile, author menu on post detail |
| First message | Text 1,000 chars, no photos. A card with the sender's company, job title and "회사 메일 인증" is attached on top automatically. Input hint encourages writing company, role and reason for contact |
| In requests | "채용 제안" (recruiting offer) label with company name. Mixed into the same tab as normal message requests, distinguished by the label |
| Limits | 10/day per recruiter, 50/day on Scout. No additional offer to the same developer while pending; 30 days after rejection (deletion) |
| Response | Accept → normal 1:1 chat. Deletion isn't disclosed. Expires after 30 days without response |
| Personal data | Linker never gives developers' email/contact to recruiters. Developers share contact details themselves in the conversation |
| Sent offers list | On recruiter my page, only own sent offers. Status: in conversation (accepted) / awaiting reply (within 30 days) / no reply (after 30 days). Since rejection (deletion) isn't disclosed, it shows "awaiting reply" for 30 days and then "no reply", same as expiry. Shows remaining offers today (N/10, Scout N/50) |
| Blocked / deleted counterpart | Kept in the list as "볼 수 없는 사용자" (unavailable user); no navigation to profile/chat |
| Prohibited | Demanding money/training fees, sales or personal-data collection under the guise of hiring, fake companies/roles. Handled under ch. 9 "Fake recruiting offers" |

### AI chat summary (POL-C-5)

**Flex teams only** (PRD C-5, S-8). Free teams can try it during the 7-day Flex free trial. Summarizes only existing team chat messages; no recording or transcription.

| Item | Rule |
| --- | --- |
| Eligible teams | On a Flex subscription (incl. trial and payment-failure grace) and not turned off by the owner in team settings. 1:1 chats are never summarized |
| Free teams | Button is visible; tapping shows the "Flex 구독 팀만 쓸 수 있어요" (Flex only) sheet. Owner/billing manager get "Flex 알아보기" (→ plans & checkout; "7일 무료 체험" if no trial yet); other members get "오너에게 Flex를 요청해 보세요" (ask your owner for Flex) |
| Range | Since my last read position. Optional: today / last 24 hours / since last summary |
| Min / max | Fewer than 20 messages → "직접 읽는 게 더 빨라요" (faster to read yourself). Max 500; if more, summarize the latest 500 and say so |
| Count | 10/day per Flex team member (tentative). Resets at 00:00 KST. Failed summaries don't count |
| Excluded | Deleted/hidden messages, images, messages from people I blocked. PR system messages contribute title and status only |
| Output | Minutes format: one-line summary, decisions, to-dos (issue drafts), open questions. Tapping an item scrolls to the original message |
| Visibility | Only the requester sees it. "채팅에 공유" (share to chat) posts it as a minutes card in team chat. Shared cards can be reported / deleted (by self) like normal messages |
| Issue drafts | Never created automatically; created on GitHub only after the user reviews/edits and taps "이슈 만들기" (create issue) (ch. 7 write permissions apply) |
| Processing | Server generates only on button tap (no automatic summaries). Over 30 seconds → show "요약하는 중이에요" (summarizing) and notify when done. On failure, retry once, then "요약하지 못했어요" (couldn't summarize) |
| Model | Default: Ollama open model self-hosted on the Linker server (free, conversations stay in-house). If switched to a low-cost LLM API, send only under terms that it's not used for training and not stored after processing, and add the vendor to the Privacy Policy's processor table |
| Retention | Summary results 7 days. Shared cards live as long as team chat messages (while the team exists) |
| Label | Always show "AI가 만든 요약이라 틀릴 수 있어요" (AI-generated, may be wrong) |
| Team setting | Owner can turn AI summary off per team. When on, a banner "이 팀은 AI 요약을 사용해요" (this team uses AI summary) shows at the top of team chat (first 7 days) |
| When subscription ends | Only new summaries blocked. Existing summaries viewable per the 7-day rule; shared cards remain in chat |

### Exceptions

- **Message order mismatch** → sort by server receive time. Messages being sent appear dimmed at the bottom.
- **Back online after being offline** → load everything after the last received message at once. If over 500, show "안 읽은 메시지 500개+" (500+ unread) and jump to the last read position.
- **Read receipts** → a message counts as read only when actually visible on screen. Push previews don't count.
- **Messages from people who left the team** → keep them and show "나간 멤버" (left member) next to the name.
- **Blocking a 1:1 chat partner** → hide the room from my list; their messages appear sent to them but aren't delivered to me. Unblocking doesn't reveal messages from the blocked period.
- **Message hidden by reports** → replaced with "운영 정책에 따라 숨겨진 메시지예요" (hidden per community policy).
- **Image retention** → free-team chat image originals are deleted after 90 days, keeping only small previews. Flex teams keep originals while the team exists. 1:1 chat image originals are deleted after 1 year (storage management, tentative).

## 9. Reports, sanctions, blocking

Linker is where developers trust each other's work and collaborate. This chapter is the community policy applied to all posts, comments, recruit posts and chats, published to users as-is.

### Prohibited behavior and default actions

Baseline values for operator judgment. May be adjusted one step depending on the case, with the reason recorded in the action log.

| Reason | Examples | Content action | Account action |
| --- | --- | --- | --- |
| Spam / ads | Repeated posting, unsolicited promotion, automated mass follows/messages | Delete | Immediate permanent suspension possible |
| False / harmful job ads | Nonexistent jobs, conditions different from the posting, phishing/malicious links, impersonating another company | Hide ad | Immediate permanent suspension possible for false/phishing ads; subscription ends without refund |
| Abuse / defamation / hate | Personal attacks, demeaning gender/origin/disability, harassment | Hide | Stepwise starting with a warning |
| Sexual content | Pornography, sexual harassment | Delete | Permanent suspension; report to law enforcement if illegal |
| Exposing personal info | Others' contacts, real names, internal company info, screenshots containing API keys/passwords | Hide immediately | 7-day suspension and up if intentional |
| Plagiarism / misappropriation | Presenting a repo you didn't contribute to as your own, posting others' photos/code without permission | Hide, author has 7 days to explain, else delete | Stepwise |
| Fake recruitment | Recruiting for a non-existent team, sales or personal-data collection under the guise of recruiting, demanding money | Delete recruit post | Stepwise; repeat offenders barred from recruit posts for 30 days |
| Fake recruiting offers | Non-existent company/role, sales / training fees / data collection under the guise of hiring, contacting non-seeking developers via workarounds | Hide message | 7-day suspension and up; permanent if repeated |
| Impersonation | Impersonating others, companies or operators | Delete | Permanent suspension possible |
| Illegal acts | Distributing malware, trading illegal information, promoting gambling | Delete | Permanent suspension; report to law enforcement if needed |

### Sanction steps

Warning → 7-day suspension → 30-day suspension → permanent suspension. Illegal/sexual content, spam accounts and impersonation can skip straight to permanent suspension.

| Item | Rule |
| --- | --- |
| While suspended | Log in, view, appeal, delete account only. No posts, comments, chat, applications, follows |
| Display | Suspension is not shown on the profile |
| Step reset | Back to the first step after 1 year without violations since the last sanction |
| Re-signup | Deleting and re-signing up with the same GitHub account while suspended continues the remaining suspension. Permanently suspended GitHub accounts can't sign up again (only the GitHub id is kept separately; retention per Privacy Policy) |
| Notification | Sanction reason and period sent as a notification |

### Reports

| Policy | Details |
| --- | --- |
| Targets | Users, posts, comments, recruit posts, team chat messages, 1:1 chat messages, job ads |
| Reasons | Reasons in the table above + other (free text) |
| Duplicate reports | Multiple reports of the same target by the same person count as 1. Reported targets are hidden from the reporter immediately |
| Auto temporary hide | Content reported by 5 different people is temporarily hidden until an operator reviews it |
| Handling target | Within 2 business days of receipt. Reporter is told only the outcome (sanctions on the other party are private) |
| Chat reports | Only the reported message and 10 messages before/after are copied and kept at report time. Operators can't see the rest of the conversation (same for team and 1:1 chat) |
| False reports | 5 rejected reports within 30 days → can't report for 30 days, and their reports are excluded from the auto-hide count |
| Conflicts of interest | Reports involving the operator or their acquaintances are handled by another operator |
| Action log | All actions recorded with operator, time and reason (PRD O-5) |

### Rights-infringement reports and temporary measures

People whose copyright, reputation or privacy is infringed (including non-members) can request deletion or posting of a rebuttal (Korean Information and Communications Network Act art. 44-2).

1. Collect requester info, location of the post, reason for infringement and supporting material through the rights-infringement report channel.
2. Take necessary action without delay and notify the requester and poster. If judgment is difficult or a dispute is expected, hide it temporarily for up to 30 days (temporary measure).
3. The poster can request re-posting within the temporary period; the operator reviews both sides and decides to restore or delete. Without a request, delete when the period ends.
4. For rights issues with the repo itself (e.g. license-violating code), also point to GitHub's reporting process.

### Appeals

- One appeal can be filed from a sanction/deletion notification.
- Reviewed by a different operator than the original handler (permanent suspension: lead operator); result within 5 business days.
- If accepted, content is restored and the sanction history erased.

### Blocking

| Item | Rule |
| --- | --- |
| Effect | Each other's posts, comments and profiles become invisible; follows removed; 1:1 chat and applications blocked |
| Notification | The other party isn't notified |
| Within a team | Team chat in the same team isn't blocked, for work. Guide team issues to reports or the owner |
| 1:1 chat | Room hidden from my list; their messages aren't delivered to me. Unblocking doesn't reveal messages from the blocked period |
| Unblock | Anytime in Settings > Block list |

### Exceptions

- **Team owner suspended** → admins exercise owner permissions during the suspension. If permanent, follow the ownership succession in Teams & permissions exceptions.
- **Reported person deletes their account first** → report material and sanction records kept for the retention period; handling proceeds.
- **Rights-infringement report and normal report on the same content** → apply the rights-infringement process (temporary measure) first.

## 10. Operators & back office

| Role | Can do |
| --- | --- |
| Operator | Handle reports, hide/delete content (incl. hiding job ads), warn, suspend up to 30 days (incl. recruiters; MVP has no recruiter pre-approval and no ad pre-review) |
| Lead operator | Operator permissions + permanent suspension, lifting sanctions, reviewing appeals, managing operator accounts |

- Only Linker accounts designated as operators can enter the back office, with 2FA (OTP) on every entry. Logged out after 30 minutes of inactivity.
- Permanent suspension and content deletion require a reason.
- Email addresses are masked in the back office too (e.g. jun\*\*\*@gmail.com); viewing in full requires recording a reason.
- Operators can't post on behalf of users or join teams.

## 11. Subscription

Subscription principles, plans and prices are set in [PRD ch. 6](02-prd.md#6-revenue-model). This chapter defines limits per benefit and payment behavior.

### Free on every plan

Follow/like/comment, writing and sharing posts, 1:1 chat, team chat, Find Team, and teams/issues/calendar/status board work regardless of subscription. Everything that works on free keeps working on a paid plan; subscriptions only add on top.

### Pro benefits (individual, ₩2,900/month / ₩29,000/year)

| Benefit | Free | Pro |
| --- | --- | --- |
| Recruiter profile-view alert | None | Number of recruiters who viewed my profile this week (notification every Monday 09:00 when 1 or more) and weekly counts in My stats |
| Post stats | Likes, comments, views | Free numbers + views by traffic source (feed, profile, recruit post, chat share, external link), 30-day trend, README expands |
| Post photos | 5 per post | 10 per post |
| Pinned featured posts | 1 | 5 |
| Recruit posts | 3 concurrent | 10 concurrent |

- The core of Pro post stats is the traffic source: see where each post gets seen and choose which posts to pin as featured.
- Stats are visible only to the user. The recruiter view alert shows **only the count**, never who or which company. The same recruiter viewing several times on one day counts once. Guest, developer and own views are not counted.
- Recruiters are told at sign-up, via the Business Member Supplementary Terms, that viewing a profile is shown to the developer as a count.

### Flex benefits (team, from ₩7,900/month)

| Benefit | Free team | Flex |
| --- | --- | --- |
| Price | ₩0 | ₩7,900/month (up to 6 members), ₩1,900/month per member from the 7th (e.g. 7 members ₩9,800) |
| Team members | 6 | No limit |
| Team chat search & scroll-back | Last 60 days | All history |
| Team chat image originals | 90 days | While the team exists |
| AI chat summary (minutes) | Only during the 7-day free trial, then Flex prompt | 10/day per person, results kept 7 days |
| Project progress graph (POL-T-7) | None; Flex prompt in the card's place | Progress card on the issue tab |

- The per-member price uses the **team headcount on the billing date**. Headcount changes during a period apply from the next billing date; no pro-rating. Checkout and the day-before notice show "next payment: N members, amount".
- Free GitHub orgs have a daily org invite limit (50 for new orgs), so even without a member limit, inviting many people at once may spill into the next day.
- Detailed AI chat summary rules are in [ch. 8 POL-C-5](#ai-chat-summary-pol-c-5).

### Scout benefits (recruiter, ₩14,900/month)

| Benefit | Free (recruiter) | Scout |
| --- | --- | --- |
| Recruiting offers (1:1 chat) | 10/day | 50/day |
| Feed job ad | None; the my-page job ad sheet shows a Scout prompt | 1, shown by job-category match |

Detailed job ad rules are in [ch. 3 "Job ads"](#job-ads-pol-h-5789). The offer limit is never unlimited: to avoid unwanted contact for developers, Scout stops at 50/day, and the ch. 8 rules (no new offer while one is pending, none for 30 days after rejection) still apply.

### Decided not to include

- Full-history contribution graph, Pro badge on profile, team data export
- Profile visit count stats (replaced by the recruiter view alert), recruit post bump, portfolio export
- Limit on linked repos (none even for free teams)
- Limit on 1:1 message requests (none even for free members)
- AI chat summary on Pro (individual). Summaries are team outputs viewed together, so Flex only
- Separate free AI summary uses for free teams. The 7-day Flex free trial serves that role
- Unlimited recruiting offers. Scout is also 50/day

### Payment & cancellation

| Item | Rule |
| --- | --- |
| Payment method | Card payment in Toss Payments test mode (no real money). Browser and WebView app use the same checkout and apply to the same account |
| Payment confirmation | Never trust the client's success response; unlock benefits only after the server confirms via the Toss Payments approval API |
| Free trial | Pro once per account, Flex once per team, 7 days (no trial for Scout). During the Flex trial, AI summary, the progress graph and full chat history all work. Notify billing date and amount one day before it ends |
| Auto-renewal | Monthly/annual auto-renewal. Annual: notice 7 days before renewal. Price increases notified 30 days ahead with consent |
| Cancellation | Anytime. Benefits continue until the paid period ends; no pro-rated refund |
| Refund | Full refund within 7 days of payment if benefits unused. Refund flow demonstrated via payment cancellation even in test mode |
| Payment failure | Benefits kept for 7 days while retrying; if still failing, switch to free |
| Switching to free | Existing photos, pinned posts and recruit posts stay; free limits apply when writing or editing from then on. If team members exceed 6, existing members stay and only new members are blocked. No new AI summaries; shared cards remain. The progress graph turns into a Flex prompt; snapshots keep accumulating. Job ads stop showing (content kept); offer limit becomes 10/day |
| Flex grace period | When Flex ends, full chat history and image originals stay as they are for **30 days**. The whole team is notified 7 days before Flex ends and 7 days before the grace period ends. After 30 days, messages older than 60 days are hidden (not deleted; visible again on resubscribing) and image originals older than 90 days are deleted, leaving previews (not restored on resubscribing). Resubscribing within the grace period changes nothing |
| Minors | Under 19 pay after legal guardian consent |
| While suspended | Subscription continues; not extended by the suspension period |
| Flex payer | Owner by default. Owner can hand billing to an admin; billing manager stays even if owner changes |

## 12. UI copy guide

Error and empty-state copy says what didn't work and what to do next. Tone: polite "~해요" style, never blaming the user. Representative draft copy (use the Korean as-is):

| Situation | Copy |
| --- | --- |
| Rate limit reached | 오늘은 더 할 수 없어요. 내일 다시 시도해 주세요. |
| No GitHub permission | 이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요. |
| GitHub connection failed | GitHub에 연결하지 못했어요. 작성한 내용은 저장해 두었어요. |
| Not org owner | GitHub 조직 오너만 앱을 설치할 수 있어요. 오너에게 설치를 요청할까요? |
| Suspended account | 운영 정책 위반으로 N월 N일까지 이용이 제한됐어요. 이의 제기하기 |
| Deleted post | 삭제되었거나 볼 수 없는 게시물이에요. |
| Empty feed | 아직 볼 글이 없어요. 비슷한 스택의 개발자를 팔로우해 보세요. |
| Empty my issues | 배정된 이슈가 없어요. |
| Empty recruit list (filter result) | 조건에 맞는 모집 글이 없어요. 필터를 줄여 보세요. |
| Offline | 인터넷 연결이 끊겼어요. 연결되면 자동으로 다시 불러올게요. |
| AI summary on free team | Flex 구독 팀만 쓸 수 있어요. 오너에게 Flex를 요청해 보세요. |
| Progress graph on free team | Flex를 구독하면 팀 달성률과 최근 14일 추이를 그래프로 볼 수 있어요. |
| Shared to chat room | ○○에 공유했어요. · 채팅방으로 가기 |
| No chat room to share to | 공유할 수 있는 채팅방이 없어요. 팀에 참여하거나 대화를 시작해 보세요. |
| Recruiter view alert (Pro) | 이번 주 채용 담당자 N명이 내 프로필을 봤어요. |
| Chat history limit (free team) | 무료 팀은 최근 60일 대화만 볼 수 있어요. Flex를 구독하면 전체 기간을 볼 수 있어요. |
| Job ad (no subscription) | Scout를 구독하면 관심 직군이 맞는 개발자의 피드에 채용 광고를 띄울 수 있어요. |
| Job ad URL rejected | 회사 메일 도메인(@abc.com)과 같은 주소이거나 허용 채용 사이트(잡코리아·사람인·원티드·고용24)의 공고만 넣을 수 있어요. |
| Job ad closed | 광고를 닫았어요. 7일 동안 보이지 않아요. · 되돌리기 |
| Job ad hidden | 이 광고는 다시 보이지 않아요. |
| AI summary used up | 오늘은 AI 요약을 다 썼어요(10/10). 내일 다시 쓸 수 있어요. |

## 13. Policies for later-phase features

Built after MVP, but rules that affect the current data structure are written now. AI chat summary entered the MVP as a Flex benefit and moved to ch. 8.

### Formal offer box (phase 3)

Structured offers replacing MVP's 1:1 chat recruiting offers (ch. 8). Added in phase 3 together with operator company verification.

| Item | Rule |
| --- | --- |
| Sender | Only recruiters whose company was verified by an operator (company email + company name and business registration number, target 2 business days, re-verify yearly) |
| Recipient | Developers with job-seeking status Seeking or Open to offers (POL-H-4) |
| Content | Required: company, role, employment type, location, message (1,000 chars). Salary range optional |
| Limits | 10/day per recruiter (Scout 50); 1 per 30 days to the same developer |
| Response | Interested / not interested. Interested opens a 1:1 chat. Not interested only notifies the recruiter of the result |
| Expiry | Expires after 14 days without response |
| Personal data | Email/contact not shown until the developer taps interested |
| Blocking | Developers can block a recruiter or an entire company (e.g. current employer) |

## 14. To be decided

- [ ] Finalize tentative numbers (character counts, photo counts/sizes, team sizes, auto-expiry periods, rate limits)
- [ ] Minimum sign-up age (tentatively 14+)
- [ ] Who handles reports and target handling time
- [ ] Retention period for 1:1 chat image originals (tentatively 1 year)
- [ ] Retention period for GitHub ids of permanently suspended accounts (with the Privacy Policy)
- [ ] Whether to refund remaining subscription on permanent suspension (with Terms review)
- [ ] Recruiter company verification method (phase 3; MVP is company email only)
- [ ] Final scope of the free email block list (MVP recruiter sign-up)
- [ ] AI summary daily count (tentatively 10) and model (Ollama open model / low-cost API)
- [ ] Final job category list and allowed job sites (tentatively JobKorea, Saramin, Wanted, Work24), Pro/Flex/Scout prices (tentatively Pro ₩2,900/month, Flex ₩7,900/month + ₩1,900 per member from the 7th, Scout ₩14,900/month) and plan names (Flex and Scout are working names)
