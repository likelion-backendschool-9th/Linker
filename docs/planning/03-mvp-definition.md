# Linker MVP Definition

> Question this document answers: **How much do we build for the first release?**
> Why each feature is needed and its completion conditions are in the [PRD](02-prd.md), screens and flows in the [Service Plan](01-service-plan.md), and limits and exception rules in the [Policy](04-policy.md).

## 1. MVP goals

The MVP aims to **complete one flow — "find a team → work with the team → show the result as a project post" — seamlessly on mobile**. It includes only the features that minimally solve each of the three pain points (PRD PP-1~3).

| Goal | Problem solved | What to verify in the MVP |
| --- | --- | --- |
| Developers looking for a team apply to a recruit post and join | PP-2 Recruiting | Can recruiters judge applicants from the profile alone? |
| Teams handle issues, schedule, chat and PRs in one place on mobile | PP-1 Fragmentation | Do teams open Linker instead of Discord? |
| Finished projects become project posts that create reactions and connections | PP-3 Portfolio & network | Do posts get comments and follows? |
| Recruiters who saw the work send offers to job-seeking developers via 1:1 chat | PP-3 Portfolio & network | Does the feed lead beyond project sharing to hiring connections? |

**Recruiting is included minimally**, because the feed is both a place to share projects and a path to hiring. Developers turn on job-seeking status; recruiters sign up with company email and make offers through the existing 1:1 chat (C-4). A recruiter with a Scout subscription shows their external job posting as an ad in the feed of developers whose job categories match. Talent search, formal offer box and operator company verification are not included.

**Assumptions**: As a portfolio project, the app is not published to stores but installed as a development build, and subscription payments are demonstrated in Toss Payments test mode.

## 2. MVP scope

### 2-1. Included

Every item follows the PRD completion conditions as-is. **Required** = without it the core flow breaks (PRD P0); **Included** = in scope, but can slip to right after launch if the schedule slips (PRD P1).

| Area | Required | Included |
| --- | --- | --- |
| Account & profile | A-1 GitHub login, A-2 auto-filled profile, A-3 tech stack & looking for team, A-5 completion record, A-9 guest browsing, H-4 job-seeking status | A-4 GitHub contribution graph, A-6 pin featured posts |
| Posts & social | P-1 repo post, P-2 body/photos/optional fields, P-4 following + recommended feed, P-5 likes/comments/follows | P-3 view README, P-7 post sharing (copy link / share to chat room) |
| Find Team | R-1 write recruit post, R-2 list & filters, R-3 apply, R-4 accept/reject | |
| Team & workspace | T-1 create team, T-2 invite, T-3 link repos, T-4 project completion | |
| Issues & schedule | I-1 template issues, I-2 assignees/labels, I-3 dates/status, I-4 calendar & status board | I-5 my issues list |
| Chat & notifications | C-1 team chat, C-3 auto-post PRs, C-4 1:1 chat, N-1 push notifications (in-app list + Android app push, on/off) | C-2 issue card sharing, C-5 AI chat summary (Flex teams only), C-7 Linker link card |
| Recruiting (minimal) | | H-1 recruiter sign-up (company email verification), H-3 recruiting offers via 1:1 chat + sent offers list on recruiter my page, H-5 Scout plan, H-7 job ad registration, H-8 job categories of interest, H-9 feed job ads (close/hide/report) |
| Operations | O-1 report handling, O-2 content action, O-3 user action, O-5 action log | O-4 view 1:1 chat reports |
| Subscription | S-1~S-3 start subscription (Toss Payments test checkout), manage subscription, apply benefits | S-4~S-10 post stats, team chat search & retention, Flex AI chat summary, Flex project progress graph (T-7), Pro recruiter view alert |

### 2-2. Excluded

| Area | Excluded feature | Reason | Phase |
| --- | --- | --- | --- |
| Account & profile | A-7 data download | Can be handled by email request early on | 2 |
| Account & profile | A-8 Linker activity graph | Meaningful only with recruiting expansion | 3 |
| Posts & social | P-6 explore, P-9 bookmark, P-8 progress updates | Feed alone handles first exposure; add once posts accumulate | 2 |
| Find Team | R-5 proactive offers/recommendations | Recommendations need enough profiles | 2 |
| Team & workspace | T-5 commit activity, T-6 bottleneck dashboard | Validate the basic flow with issues/calendar first | 2 |
| Issues & schedule | I-6 sub-issue creation, I-7 drag scheduling, I-8 issue form attachments | High cost, can be done on GitHub | 2 |
| Chat & notifications | N-2 detailed notifications & web push | First confirm team chat gets used | 2 |
| Chat & notifications | C-6 voice chat & minutes | Needs separate consent and retention policy | Later |
| Recruiting | H-2 talent search, H-6 formal offer box (interested/not, contact sharing, company block), operator company verification | Needs a developer pool first; MVP uses feed filter and 1:1 chat instead | 3 |
| Job ads | Ad stats screen, multiple ads per recruiter, hide all ads from a company, generic ads for guests or people without job categories, targeting beyond job category (stack, experience, region), operator pre-review, in-app posting detail, ad images, impression-based pricing/bidding, ad push | Check with the minimal version first that ads don't hurt feed trust; impressions/clicks are already aggregated daily | 4 |

## 3. Launch conditions

All of the following must be met before going public.

**Features**

- [ ] The 10 steps of the core flow (Service Plan 5-1) connect without breaks for one real team.
- [ ] Recruiter sign-up → view a job-seeking developer's post → send offer via 1:1 chat → developer accepts → confirm "In conversation" in the sent offers list on my page, demonstrated in one go (Service Plan 5-7).
- [ ] Recruiter pays for Recruiter → registers a job ad → an "광고" (Ad) card appears in the feed of a developer with the same job category → opens the external posting, close and hide work, demonstrated (Service Plan 5-7-1).
- [ ] All Required items in 2-1 meet the PRD completion conditions.
- [ ] Subscription demonstrated in one go: test payment → benefits applied → cancel → back to free.

**Policy & safety**

- [ ] Limits, states and exceptions from the Policy are implemented.
- [ ] Report/block and the operations back office work.
- [ ] Terms of Service and Privacy Policy are linked from the sign-up screen and settings.

**Quality**

- [ ] The core flow works in mobile browsers (iOS Safari, Android Chrome) and the WebView app.
- [ ] Issues/PRs stay consistent via periodic sync even if GitHub webhooks are missed.
- [ ] No critical errors remain in Sentry.

## 4. Build order

Earlier bundles must exist for later ones to work. Per-screen order is in the [screen map](https://claude.ai/artifact/NusmaEiai4A7bHj7uT6RW2).

| Order | Bundle | IDs | Why this order |
| --- | --- | --- | --- |
| 1 | Login and my profile | A-1~A-4, A-9, H-4 | Read screens are open to guests, but every write/reaction assumes a logged-in user, so login comes first (not meant to gate the entrance). Job-seeking status is just one option in profile edit, so it's built here |
| 2 | Team creation and invites | T-1~T-3 | Issues, team chat and recruit acceptance all assume a team |
| 3 | Issues and schedule | I-1~I-5 | Core of PP-1: write, assign and track due dates on mobile |
| 4 | Team chat and notifications | C-1~C-3, N-1 | At this point a team can actually try it |
| 5 | Find Team | R-1~R-4 | Accepting joins the team from 2 and the chat room from 4 |
| 6 | Posts and social | P-1~P-5, C-4, T-4, A-5, A-6 | Post finished projects and connect via follows/1:1 chat |
| 7 | Trust, safety, operations | O-1~O-5 | Reports open in 6, so required before going public |
| 8 | Subscription | S-1~S-10, C-5, T-7 | Screens with benefits (profile, posts, recruit posts, team chat, issues) must exist first. AI chat summary is a Flex benefit, so attached to the team chat room (4) here, and the progress graph to the issue list (3). The progress snapshot batch starts running in bundle 3 |
| 9 | Recruiting (minimal) | H-1, H-3, H-5, H-7~H-9 | Reuses feed, profile, 1:1 chat (6), report/block/ops (7) and payment (8). Only email sign-up/login, the sent offers list, the job ad sheet and the feed ad card are new, so attached last and first to be deferred if the schedule slips (ads go before offers) |

## 5. First users after launch

First users are bootcamp, club and side-project teams working between Discord and GitHub without Jira/Slack. Launch together team by team to avoid an empty feed and empty recruit list.

## 6. Criteria for moving to the next phase

Metric definitions follow [PRD ch. 7](02-prd.md#7-success-metrics-kpi). Move to phase 2 when both metrics below exceed targets. Targets are set before launch.

| Metric | Target |
| --- | --- |
| Weekly active teams | [TBD] |
| 4-week team retention | [TBD] |

## 7. To be decided

- [ ] Targets in ch. 6
- [ ] Bootcamps/clubs for the first launch
- [ ] Backend hosting and service domain
- [ ] AI chat summary model (Ollama open model, free / low-cost API)
