# Linker PRD

> Question this document answers: **Why are we building it, and what should it achieve?**
> How the service is structured (IA, screens, flows) is in the [Service Plan](01-service-plan.md), how much ships in the first release in the [MVP Definition](03-mvp-definition.md), and per-feature limits and exception rules in the [Policy](04-policy.md).

## 1. Overview

**Product definition**: A social network + team workspace + team-finding service for developers. Developers sign up with a GitHub account and use GitHub orgs, repos, issues and PRs as the source of truth. Recruiters sign up with a company email, make offers to job-seeking developers via 1:1 chat, and with a Scout subscription show a job ad in the feed of developers whose job categories match (phase 1 has only the minimal feature set).

**Scope of this document**: Defines problems, goals, functional requirements and success metrics for all phases (phase 1 MVP through phase 4 recruiting monetization). Every feature has an ID, phase and priority.

**Project nature**: A portfolio project. Demonstrated as a responsive browser web app and a WebView app, not published to app stores. Payments use Toss Payments test mode, only to demonstrate PG integration.

## 2. Problem definition

Developers on team projects hit different problems at three points: **before finding a team, while working together, and after finishing**. Linker solves these three as one flow. Scenes illustrating each problem are in [Service Plan ch. 2](01-service-plan.md#2-user-pain-points-and-how-linker-solves-them).

| # | Pain point | When | One-sentence definition |
| --- | --- | --- | --- |
| PP-1 | Fragmented workspace | While working together | Issues, chat, schedule and PRs are scattered across tools, so the team's progress can't be seen in one place |
| PP-2 | Hard to recruit teammates | Before forming a team | Recruit posts are scattered and there's no basis to judge applicants' skill and reliability, so trustworthy teammates are hard to find |
| PP-3 | Lack of portfolio sharing, feedback and network | After finishing | A repo alone doesn't convey context or contribution, and there's no place for work to get reactions/feedback or for developers to connect |

### PP-1. Fragmented workspace

| Item | Description |
| --- | --- |
| Who | Team leaders, team members |
| Symptom | Tasks in GitHub issues, chat in Discord/KakaoTalk, schedule in Notion/Google Calendar, PR notices by email. Seeing "who does what by when" on mobile means hopping between apps |
| Current alternatives & limits | GitHub mobile can't show issue due dates/status at a glance and has weak chat. Messengers aren't linked to issues/PRs. Jira/Slack are heavy for small teams with high setup cost |
| Result | Progress exists only in the leader's head, decisions get buried in chat, PR reviews are delayed. If the leader is busy, the team stops |
| Success criterion | Members open one app on mobile to see their tasks, deadlines, team chat and PR flow, and can create issues. GitHub stays the source of truth so existing habits are kept |
| Related requirements | T-1~T-4, T-7 (Flex), I-1~I-5, C-1~C-3, C-5 (Flex), C-7, N-1 (phase 2: T-5, T-6, I-6, I-7) |

### PP-2. Hard to recruit teammates

| Item | Description |
| --- | --- |
| Who | Recruiters forming a team, applicants wanting to join |
| Symptom | Recruit posts are repeatedly posted to multiple communities and open chats. Applicants send a few lines of intro; recruiters can't verify their code or reliability. After matching, setup (GitHub org invite, chat room, docs sharing) takes long |
| Current alternatives & limits | Community boards and open chats don't structure applicant info and don't connect to collaboration tools after matching |
| Result | Team formation takes long; unverified members vanish midway and projects collapse. No record of dropouts, so it repeats |
| Success criterion | Recruiters judge applicants by posts, contribution graph and completion record. On accept, work starts immediately in the same team space. A record of finishing together becomes the basis of trust for the next match |
| Related requirements | R-1~R-4, A-3, A-5, T-4 (phase 2: R-5) |

### PP-3. Lack of portfolio sharing, feedback and developer network

| Item | Description |
| --- | --- |
| Who | Developers who want to share their work, developers who want to connect with similar developers |
| Symptom | A GitHub repo link doesn't convey what was built, why, or my role. Blog retrospectives aren't read, dev talk gets buried on general social media, and business social networks center on experienced hires and job ads |
| Current alternatives & limits | GitHub is a code repository with weak context and reactions. Blogs get no traffic. Code-review communities are scattered and can't show a whole project |
| Result | Work gets buried without feedback, contribution in team projects can't be proven, and no relationships form for the next collaboration |
| Success criterion | Choosing a repo produces a post with context (role, problem & solution, demo) and contribution evidence (my commit count, issues handled). Even without followers, it is exposed in the recommended feed and gets reactions and comments. People met in the feed connect via 1:1 chat and become the next team. Turning on job-seeking status also leads to offers from recruiters who saw the work |
| Related requirements | P-1~P-5, A-4, A-6, C-4, S-4, H-1, H-3, H-4 (phase 2: P-6~P-8) |

## 3. Target users

**Primary**: Junior / job-seeking developers in bootcamp, club, side-project and hackathon teams who work between Discord and GitHub without Jira/Slack.

**Secondary**: Recruiters looking for junior developers through the project feed. Phase 1: sign-up and 1:1 chat offers only; talent search and formal offer box come in phase 3 once a developer pool exists.

| Persona | Situation | Main problems | What they get from Linker |
| --- | --- | --- | --- |
| Team leader Jisu (org owner) | Runs a 4–6 person side project | PP-1, PP-2 | Issue creation/assignment, calendar, team chat with PRs, verified applicants |
| Team member Minho | Backend on a hackathon team | PP-1, PP-3 | My issues list, deadline alerts, posting a finished project |
| Job seeker Seoyeon | Looking for a team for her portfolio | PP-2, PP-3 | Profile as application, completion record, feedback on posts and follows |
| Recruiter | Seeks juniors with skill and consistency | Lack of evidence | Profiles combining posts, graph and completion record; job-seeking status; 1:1 chat offers |

## 4. Product goals

| Goal | Problem | Achieved when |
| --- | --- | --- |
| G-1. Become the workspace teams open daily | PP-1 | Teams create issues and chat mainly in Linker and still use it after 4 weeks |
| G-2. Form trustworthy teams fast | PP-2 | Recruit posts lead to real joins, and joined teams finish their projects |
| G-3. Work gets reactions and connects people | PP-3 | Posts generate comments and follows, which lead to 1:1 chats and the next team |
| G-4. Accumulated records become opportunities | PP-2, PP-3 | Recruiters send 1:1 chat offers based on job-seeking developers' posts and profiles (phase 1 minimal, phase 3 search/offer box) |

## 5. Functional requirements

Read each item as "The user can …". It is done only when all completion conditions are met. Limits, character counts and exception handling follow the Policy item with the same ID (`POL-<ID>`).

**Priority criteria**

| Priority | Meaning |
| --- | --- |
| P0 | Without it the core flow (find team → collaborate → project post) breaks. Required in phase 1 |
| P1 | Included in phase 1; greatly increases problem-solving impact |
| P2 | Added after phase 1 settles (phase 2) |
| P3 | Recruiting/expansion phases (phase 3+) |

### 5-1. Account & profile

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| A-1 | Sign up / log in with GitHub | Return to Linker after GitHub auth (WebView app: authenticate in system browser, then return to app); stay logged in on reopen | Common | 1 | P0 |
| A-2 | Auto-filled profile | Name, avatar, bio, blog, GitHub link loaded from GitHub and editable | PP-3 | 1 | P0 |
| A-3 | Set tech stack and "looking for team" status | Choose tags, toggle status | PP-2 | 1 | P0 |
| A-4 | GitHub contribution graph on profile | Daily contributions for this month (calendar shape), swipe to previous months (last 12 months), monthly total, refreshed once a day | PP-2, PP-3 | 1 | P1 |
| A-5 | Completion record | Number of completed Linker projects and completion rate of assigned issues | PP-2 | 1 | P0 |
| A-6 | Pin featured posts | Pin my posts at the top of profile, reorder | PP-3 | 1 | P1 |
| A-7 | Data download | Download my posts and profile data as a file | Common | 2 | P2 |
| A-8 | Linker activity graph | Collaboration activity inside Linker accumulates on profile in addition to GitHub commits | PP-2 | 3 | P3 |
| A-9 | Guest browsing | Feed, posts, recruit posts and profiles readable without login. Reacting, writing, applying and messaging show the login-prompt sheet and return to the same screen after login | PP-2, PP-3 | 1 | P0 |

**Account structure**: Linker members and login methods are stored separately. Developers log in only with GitHub; recruiters sign up with company email and password (H-1). Member type (developer / recruiter) is set at sign-up and never changes; recruiter accounts can't use developer features (contribution graph, repo posts, teams, Find Team).

### 5-2. Project posts & social

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| P-1 | Write a post by choosing my repo | Repo card (name, language, stars, URL) automatic; body pre-filled with repo description | PP-3 | 1 | P0 |
| P-2 | Body, photos, tags, optional fields | Required: repo and one-line intro. Optional: my role, problem & solution, demo links, period, team size. Multiple photos, first is cover (repo card if none). Auto-shows my commit count in the repo and issues handled in Linker | PP-3 | 1 | P0 |
| P-3 | View README | Toggle-expand on detail; wide tables/code scroll horizontally | PP-3 | 1 | P1 |
| P-4 | Home feed (following + recommended) | Mix recommended posts (popular in last 7 days, 2nd-degree, same stack) between following posts with a "why shown" line; infinite scroll | PP-3 | 1 | P0 |
| P-5 | Likes, comments, follows | One level of replies; notify the author | PP-3 | 1 | P0 |
| P-6 | Explore | Browse posts and people by tech stack, popularity, newness | PP-3 | 2 | P2 |
| P-7 | Post sharing | The share button opens a bottom sheet with exactly two options: "링크 복사" (Copy link) / "채팅방에 공유" (Share to chat room). "Share to chat room" lists my chat rooms (team chat rooms and open 1:1 rooms); picking one sends a post card. Recruit posts and profiles use the same button | PP-3 | 1 | P1 |
| P-9 | Bookmark | Save posts for later | PP-3 | 2 | P2 |
| P-8 | Progress updates | Append progress to a project post | PP-3 | 2 | P2 |

### 5-3. Find Team

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| R-1 | Write recruit post | Intro, needed roles/headcount/stack, period, online/offline, region, goal, deadline | PP-2 | 1 | P0 |
| R-2 | Recruit post list & filters | Role, stack, online/offline filters; filters persist in URL | PP-2 | 1 | P0 |
| R-3 | Apply | Choose role + short message, profile auto-attached, cancel application | PP-2 | 1 | P0 |
| R-4 | Accept / reject | On accept: added as team member and joins team chat; GitHub org invite button for owner | PP-2 | 1 | P0 |
| R-5 | Proactive offers / recommendations | Recruiter gets matching developers recommended and invites them first | PP-2 | 2 | P2 |

### 5-4. Team & workspace

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| T-1 | Create team | Choose org on the GitHub App install screen; after install and return, server verifies installation and creates the team. Guide to GitHub's create-org if there's no org | PP-1 | 1 | P0 |
| T-2 | Invite members | Linker invite link for external join (`/invite/[code]`); logged-in developers can also get a team-invite notification that opens the same URL; owner may send GitHub org invite at the same time | PP-1, PP-2 | 1 | P0 |
| T-3 | Choose repos to link | Choose among repos where the app is installed | PP-1 | 1 | P0 |
| T-4 | Mark project complete | Reflected in members' completion records; prompt to post the project | PP-2, PP-3 | 1 | P0 |
| T-5 | Commit activity | See per-member commit/PR activity in team repos on the team screen | PP-1 | 2 | P2 |
| T-6 | Bottleneck dashboard | Due-soon, long-stalled issues, PRs awaiting review, load per assignee on one screen | PP-1 | 2 | P2 |
| T-7 | Project progress graph | **Flex teams only.** A "진행 현황" (Progress) card at the top of the issue tab: completion rate (Done / total), counts for the 4 status columns, status trend for the last 14 days, open issues per assignee (as load, no ranking). The trend is drawn from daily snapshots, which are stored for free teams too so the history shows as soon as a team subscribes. Each chart has a one-sentence numeric summary and "표로 보기" (View as table) | PP-1 | 1 | P1 |

### 5-5. Issues & schedule

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| I-1 | Create issues from templates | Default templates (bug/feature/task) + repo/org templates; render markdown templates and issue forms (YAML) as in-app inputs. Created on GitHub under user's name | PP-1 | 1 | P0 |
| I-2 | Set assignees and labels | Applied to the GitHub issue immediately. If no repo write permission, disable buttons + explain why | PP-1 | 1 | P0 |
| I-3 | Start date, due date, status | Stored in the team's linked GitHub Projects board fields; values changed on GitHub are reflected | PP-1 | 1 | P0 |
| I-4 | Calendar & status board | Calendar (month/week, assignee filter, overdue highlight); status board (Todo / In Progress / Blocked / Done) with drag to change status | PP-1 | 1 | P0 |
| I-5 | My issues list | Pick one of my teams (default: most recently joined); show issues assigned to me in that team only, sorted by due date. Changing the team updates the list | PP-1 | 1 | P1 |
| I-6 | Sub-issues | Split work into GitHub sub-issues and see progress | PP-1 | 2 | P2 |
| I-7 | Drag scheduling | Drag an issue on the calendar to change dates, reflected on GitHub | PP-1 | 2 | P2 |
| I-8 | Issue form attachments | Attach images/files when creating issues | PP-1 | 2 | P2 |

### 5-6. Chat & notifications

| ID | Requirement | Completion condition | Problem | Phase | Priority |
| --- | --- | --- | --- | --- | --- |
| C-1 | Team chat | Text and images, realtime delivery, read indicators | PP-1 | 1 | P0 |
| C-2 | Share issue cards | Send issues as cards in chat, tap to open detail; turn a message into an issue | PP-1 | 1 | P1 |
| C-3 | Auto-post PRs | PR opened / review requested / merged posted as system messages in team chat; PR list tab | PP-1 | 1 | P0 |
| C-4 | 1:1 chat | Start from profile/post; message-request box unless mutual follow or same team; block/report. A recruiter's first message appears in requests as "Recruiting offer" (H-3) | PP-3 | 1 | P0 |
| N-1 | Push notifications | Chat, assignment, 1 day before due, application/accept, comments/follows, team invite (opens `/invite/[code]`). Tap to open the relevant screen. In-app notification list plus Android app push (iOS excluded because it needs a paid Apple developer account). Push on/off in settings | Common | 1 | P0 |
| C-5 | AI chat summary (minutes) | **Flex teams only** (including the 7-day free trial). A button in the team chat room summarizes messages since last read into minutes (one-line summary, decisions, to-dos, open questions); "Share to chat" posts to the team; to-dos become issues after review. Free teams see a Flex prompt | PP-1 | 1 | P1 |
| C-7 | Linker link card | If a chat message contains a Linker post, recruit post or profile URL, show it as a card read from the server DB (same look as cards sent via P-7) instead of an external OG preview. Deletion, hiding, blocks and private state are reflected immediately. Shown without the mutual-follow condition in 1:1 chat | PP-3 | 1 | P1 |
| N-2 | Detailed notification settings & web push | Per-type settings, browser push | Common | 2 | P2 |
| C-6 | Voice chat & minutes | Team voice chat and AI minutes | PP-1 | Later | P3 |

### 5-7. Subscription

| ID | Requirement | Completion condition | Phase | Priority |
| --- | --- | --- | --- | --- |
| S-1 | Start subscription | Choose Pro/Flex on plan comparison, Toss Payments test checkout, one-time free trial | 1 | P0 |
| S-2 | Manage subscription | Show current plan and next billing date, cancel, payment-failure grace notice | 1 | P0 |
| S-3 | Apply benefits | Limits lift as soon as server confirms payment; after expiry/cancel, free limits (existing content kept); hitting a limit shows the subscription prompt | 1 | P0 |
| S-4 | Post stats | Free: likes, comments, views. Pro: the free numbers plus views by traffic source (feed, profile, recruit post, chat share, external link), 30-day trend, README expands. The goal is to see where each post gets seen and pick featured posts. Visible only to self | 1 | P1 |
| S-5 | Extended recruit posts | Pro: more concurrent recruit posts | 1 | P1 |
| S-6 | Team chat search & retention | Keyword search and scrolling back: free teams recent period only, Flex all history. Chat images: free teams lose originals after a set period, Flex keeps them while the team exists. When Flex ends, free rules apply after a grace period | 1 | P1 |
| S-7 | Flex billing | Owner pays per team. Base price up to a base headcount, extra price per additional member (headcount on the billing date). No team member limit | 1 | P1 |
| S-8 | Flex AI summary | C-5 AI chat summary is Flex only (including the 7-day free trial; daily per-person cap). When the subscription ends, only new summaries are blocked; already shared summaries remain in chat | 1 | P1 |
| S-9 | Flex progress graph | T-7 project progress graph is Flex only. Free teams see a Flex prompt in the card's place | 1 | P1 |
| S-10 | Recruiter view alert | Pro developers get "이번 주 채용 담당자 N명이 프로필을 봤어요" (N recruiters viewed your profile this week) as a notification and in My stats. Only the count is shown, never who or which company | 1 | P1 |

### 5-8. Recruiting

The feed is both a place to share projects and a path to hiring. Phase 1 includes only **job-seeking status + recruiter sign-up + offers via existing 1:1 chat + job-category-matched feed job ads (Scout subscription)**; the only new screens are recruiter sign-up/login and the sent-offers list. Job ads attach as a feed card and a my-page sheet, and the posting detail is handed off to the external job site. Search and a formal offer box come in phase 3 once a developer pool exists.

| ID | Requirement | Completion condition | Phase | Priority |
| --- | --- | --- | --- | --- |
| H-4 | Job-seeking status | Developer chooses Seeking / Open to offers / Off (default). Seeking shows a badge on profile and feed cards; Open to offers is visible only to recruiters. When Off, recruiters can't message. Separate from "looking for team" | 1 | P0 |
| H-1 | Recruiter sign-up / login | Verify company-domain email (no free email) with a code → enter password, name, company, job title → use immediately. Password reset. Profile shows company and "company email verified". No operator pre-approval (handled after the fact via reports) | 1 | P1 |
| H-3 | Recruiting offer (1:1 chat) | When a recruiter (free 10 per day, Scout 50 per day) messages a Seeking/Open-to-offers developer from their profile or post, it arrives in requests as "Recruiting offer". Accept → normal 1:1 chat; delete → sender not notified. Recruiter my page shows company info and a "Sent offers" list (in conversation / awaiting reply / no reply; tap for profile or chat room) instead of a developer profile. Recruiter feed has an "only developers open to offers" filter | 1 | P1 |
| H-5 | Scout plan | Recruiter pays on my page (Toss Payments test, same payment flow as Pro/Flex). Benefits: one job ad (H-7) and a higher offer limit (10 → 50 per day). When it ends the ad stops showing and the offer limit returns to free | 1 | P1 |
| H-7 | Job ad registration | A recruiter with Scout enters, in the my-page job ad sheet, one job category, posting title (40 chars), external posting URL and closing date (within 90 days from today), and turns showing on/off. One ad per recruiter. URL must be https and on an allowed job site (JobKorea, Saramin, Wanted, Work24) or the verified company email domain and its subdomains. Stops automatically when the closing date passes or the subscription ends. No operator pre-review (handled via reports). No posting detail screen in Linker | 1 | P1 |
| H-8 | Job categories of interest | Developer picks up to 3 job categories in profile edit. Optional, empty by default, visible only to the developer. Empty = no job ads | 1 | P1 |
| H-9 | Feed job ads | Shown only to logged-in developers whose job categories include the ad's category (none for guests, recruiters, or empty categories). One per 10 posts, max 3 per day, same ad once per day. Card shows "광고" (Ad), company, posting title, job category, closing date. Tap records the click, then opens an external browser after the leave-site confirmation. X close hides for 7 days, "이 광고 숨기기" (Hide this ad) hides permanently, reportable. Impressions/clicks aggregated daily only (stats screen later) | 1 | P1 |
| H-2 | Talent search | Search developers by stack, activity, job-seeking status | 3 | P3 |
| H-6 | Formal offer box | Offer with company, role, employment type, location; interested / not interested reply; 14-day expiry; contact shared after consent; company-level block; operator company verification | 3 | P3 |

### 5-9. Operations back office

Operator-only web screens (/admin, desktop). Only admin accounts can enter, and every action is logged. Needed in phase 1 because opening reports requires a handling screen.

| ID | Requirement | Completion condition | Phase | Priority |
| --- | --- | --- | --- | --- |
| O-1 | Report queue | Pending/handled filter, report reasons, reported content, grouping of reports on the same target | 1 | P0 |
| O-2 | Content action | Hide/delete posts, comments, recruit posts; notify author with reason | 1 | P0 |
| O-3 | User action | User search, warning, temporary/permanent suspension, lift | 1 | P0 |
| O-4 | View 1:1 chat reports | Show only the reported message and a few messages around it at report time | 1 | P1 |
| O-5 | Action log | Record who handled what, when, and why | 1 | P0 |

Metrics such as sign-ups and active teams are not built into the back office; use an analytics tool (PostHog or GA4).

## 6. Revenue model

**Principles**

- **Collaboration and connection are free.** Teams, issues, calendar, team chat, Find Team, 1:1 chat and block/report work regardless of subscription, because teams must gather for the feed and recruiting to thrive. Phase 1 recruiter features (sign-up, 1:1 chat offers up to 10 per day) are also free; only feed job ads and the higher offer limit need the Scout subscription.
- **Trust is not for sale.** Contribution graph, completion record, issue completion rate, feed ranking and application ordering never change with a subscription.
- **Subscriptions widen limits, stats and expression.** Everything that works on free keeps working on a paid plan; subscriptions only add on top.
- **Ads say they are ads and go only to people who want them.** Job ads carry the "광고" (Ad) label, show only when they match job categories the developer picked, and always offer close/hide. Ad spend never affects feed ranking.
- **AI that costs money attaches to team subscriptions.** Team chat is free, but AI summarizing it (C-5) costs model compute, so it's a Flex benefit. A summary is a shared team output, so it belongs to the team plan, not individual Pro.

| Plan | For | Price (tentative) | Benefits |
| --- | --- | --- | --- |
| Free | All developers | ₩0 | All collaboration and social features |
| Pro | Individual | ₩2,900/month / ₩29,000/year | Recruiter profile-view alert, post traffic-source stats, higher limits for post photos, featured posts, recruit posts |
| Flex | Team (owner pays) | ₩7,900/month (up to 6 members), ₩1,900/month per member from the 7th | No team member limit, full-history team chat search/scroll and image retention, AI chat summary (minutes), project progress graph |
| Scout | Recruiters | ₩14,900/month | One feed job ad (job-category matched), recruiting offers 10 → 50 per day. Phase 4 may add talent search filters and ad stats |

Flex and Scout are working names. Free on every plan: follow/like/comment, 1:1 chat, team chat, Find Team, teams/issues/calendar. Exact limits per benefit and payment/cancel/refund rules are in [Policy: Subscription](04-policy.md#11-subscription).

## 7. Success metrics (KPI)

Targets are set before launch. Criteria for moving from phase 1 to 2 are in the [MVP Definition](03-mvp-definition.md#6-criteria-for-moving-to-the-next-phase).

**North star metric**: **Weekly active teams** (teams with issue creation/status change or team chat in Linker within a week). Teams must work in Linker for completion records and posts to accumulate, which in turn feed Find Team and social.

| Problem | Metric | What it measures |
| --- | --- | --- |
| PP-1 Fragmentation | Share of issues created in Linker | Share of team issues created in Linker |
| PP-1 Fragmentation | 4-week team retention | Share of created teams still weekly-active after 4 weeks |
| PP-1 Fragmentation | Weekly active team chat members | Share of members who read or wrote team chat at least once a week |
| PP-2 Recruiting | Recruit post match rate | Share of recruit posts with at least one join |
| PP-2 Recruiting | Time to match | Median time from recruit post to first acceptance |
| PP-2 Recruiting | Completion rate | Share of members who stayed until the end in completed projects |
| PP-3 Portfolio & network | Reactions per post | Likes and comments per post |
| PP-3 Portfolio & network | Share of posts with feedback | Share of posts with at least one comment from someone other than the author |
| PP-3 Portfolio & network | New connections | Weekly new follows and 1:1 chats started |
| Recruiting (minimal) | Share with job-seeking status on | Share of active developers with Seeking / Open to offers on |
| Recruiting (minimal) | Offer acceptance rate | Share of recruiter offers accepted by developers, opening a conversation |
| Recruiting (minimal) | Job ad click rate / hide rate | Clicks per impression, and close/hide rate (if hide rate is high, lower frequency or tighten targeting) |
| Revenue (demo) | Subscription flow completion | Share of users who saw the prompt and finished a test payment |

## 8. GitHub integration requirements

Linker handles login and org integration with one GitHub App. GitHub is the source of truth for issues, PRs and orgs; the Linker DB is a copy refreshed via webhooks. The integration structure is explained in [Service Plan 7-2](01-service-plan.md#7-2-github-integration).

| Permission / webhook | Used for |
| --- | --- |
| User authorization (PKCE) | A-1 login, creating issues under the user's name |
| Metadata, Contents read | P-1 repo card & README, I-1 repo issue templates |
| Issues read/write | I-1, I-2 |
| Organization Projects read/write | I-3 date and status fields |
| Pull requests read | C-3 PR list |
| Org Members read/write | T-2 org invite (owner only), org member sync |
| Webhooks: issues, pull_request, projects_v2_item, organization, installation | Copy refresh, C-3 auto-posting |
| GraphQL contributionCalendar | A-4 contribution graph |

**Constraints**

- Only org owners can send org invites; free orgs less than 1 month old are limited to 50/day, others 500/day.
- Rate limits: user tokens 5,000/hour (shared with other apps); installation tokens 5,000–12,500/hour per org. Screens read the Linker DB copy, sync uses installation tokens, and only writes that need the user's identity use user tokens.
- GitHub Projects owned by personal accounts can't be handled by a GitHub App.
- Files can't be uploaded to issues via the GitHub API.

API and permission verification per feature is in the [GitHub API verification results](https://claude.ai/artifact/MDgMdRF8ZLs2skyt2yFnmp).

## 9. Non-functional requirements

| Item | Requirement |
| --- | --- |
| Supported environments | Responsive browser web (mobile-first, desktop supported) and an Expo WebView app wrapping the same screens. App installed as a development build |
| Performance | Virtual scroll for feed and chat; animate only transform/opacity; no layout animations on long lists |
| Realtime | Chat over WebSocket (STOMP); auto-reconnect and reload missed messages |
| AI summary | One interface for the server's LLM connection; default is self-hosted Ollama open model (free, conversations stay in-house). Switch to a low-cost LLM API if quality falls short. On-demand (button), no recording or transcription |
| Security | GitHub tokens encrypted on server, webhook signature verification, httpOnly cookie login, 2FA for back office, recruiter passwords one-way hashed (bcrypt) |
| Privacy | Private org activity shown only with consent; data deleted on account deletion. Details in the [Privacy Policy](06-privacy-policy.md) |
| Trust & safety | Block/report (chat, posts, comments, recruit posts), 1:1 message request box, recruiters can only request developers with job-seeking status on |
| Accessibility | Respect the device's "reduce motion" setting; touch targets ≥ 44px |
| Monitoring | Sentry for frontend and backend errors |

## 10. Release phases

Phases advance by criteria, not dates.

| Phase | Name | Core content | Criterion for next phase |
| --- | --- | --- | --- |
| 1 | MVP: an app teams use | Find Team, workspace, posts & social, chat, subscriptions (incl. Flex AI chat summary and progress graph), operations, minimal recruiting (job-seeking status, recruiter sign-up, 1:1 chat offers) | Weekly active teams and 4-week team retention exceed targets |
| 2 | Deep GitHub integration | Commit activity, bottleneck dashboard, sub-issues, explore, bookmarks | Enough active developer profiles (target TBD) |
| 3 | Recruiting expansion | Operator company verification, talent search, formal offer box, Linker activity graph | Offer acceptance rate exceeds target |
| 4 | Recruiting monetization | Job postings, Scout plan expansion (talent search filters, ad stats screen) | |

Phase 1 scope and launch conditions are in the [MVP Definition](03-mvp-definition.md).

## 11. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Early recruit posts and feed look empty | First visitors leave | Launch with bootcamps, clubs, hackathons; empty feed recommends same-stack developers |
| Team leader isn't the org owner | Can't install app or send org invites | Provide a request-install-from-owner flow; Linker invites are the default |
| Contribution graph can be inflated with empty commits | Trust signal distorted | Show completion record and issue completion rate alongside |
| New org members' default repo permission is read | Assignee/label settings silently dropped | Check permissions at team creation and guide the owner; disable buttons if read-only (I-2) |
| Commit email not registered to GitHub account | Commit count and graph show 0 | Guide email registration; never use commit counts as evidence for plagiarism or sanctions |
| GitHub API can't upload files to issues | Hard to attach images to issues | Store on Linker server and embed hard-to-guess links in the body; test early whether they show in private repos |
| Chat implementation burden | Schedule slips | Both chats share the same message storage structure |
| Recruiting chicken-and-egg | No recruiters early on | Phase 1 adds only job-seeking status and 1:1 chat offers; search/offer box deferred to phase 3 |
| Recruiter impersonation / spam | Unwanted contact, fake hiring | Company-domain email only, only to developers with job-seeking on, 10/day (Scout 50), first message via request box, report/block |
| Job ads hurt feed trust | Phishing links, repeated irrelevant ads | URLs only on allowed job sites or the company email domain, only to people who picked the job category, 1 per 10 posts and 3/day, close/hide/report, "광고" (Ad) label |

## 12. Open questions

- [ ] Success metric targets
- [ ] Backend hosting (AWS, GCP Cloud Run, Railway, etc.) and service domain
- [ ] Whether to store start/due dates in GitHub issue fields instead of GitHub Projects. Decide after testing on a free org
- [ ] Whether to add an optional "feedback I want" field to project posts (e.g. code structure, UI) (strengthens PP-3 feedback)
- [ ] Recruiter company verification: manual by operators or business-registration lookup API (phase 3; phase 1 is company email only)
- [ ] AI summary model: whether an Ollama open model (free) is enough or switch to a low-cost API (after checking demo server specs and Korean summary quality)
