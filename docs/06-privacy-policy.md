# Linker Privacy Policy

> Question this document answers: **How does Linker collect, use, retain and destroy members' personal data?**
> Rights and duties of members and the company are in the [Terms of Service](./05-terms-of-service.md); feature behavior rules in the [Policy](./04-policy.md).
>
> **This is an English reference translation.** The text shown to users is the Korean original; render the Korean source in the app.

**This is a draft, not legal advice. It must be reviewed by a lawyer before launch.** Written against the Korean Personal Information Protection Act (PIPA), Information and Communications Network Act and Electronic Commerce Act.

| Document | When shown | Applies from |
| --- | --- | --- |
| 1. Privacy Policy | Always-on link at the bottom of app/web (not a consent item; disclosure duty) | MVP |
| 2. Sign-up consent text | Consent screen right after first GitHub login; first step of recruiter sign-up | MVP |

**Notation**

- `[brackets]` are values to fill in.
- Numbers marked `(tentative)` are copied from the Policy's tentative values; change them here when the Policy changes.
- Processor names must be replaced with the vendors actually used. Remove unused vendors and always add new ones (omission can lead to fines).
- The Location Information Act is judged not to apply: region is user-selected text, and photo location data (EXIF) is stripped on upload.

## 1. Privacy Policy

Effective date: [effective date]

[Company name] (the "Company") maintains this policy under PIPA art. 30 to explain how it processes Linker users' personal data. The Company collects only what the service needs and keeps data fetched from GitHub only as a copy for display.

### Article 1. Items and purposes

| Category | Items | Purpose | Legal basis |
| --- | --- | --- | --- |
| Sign-up (required) | GitHub user id, handle, name, profile photo, email, GitHub access token | Login, member identification, account notices, GitHub integration | Consent |
| Profile (optional) | Display name, bio, blog link, tech stack, looking-for-team flag, job-seeking status, job categories of interest | Profile display, team finding, recommendations, receiving recruiting offers, showing job ads matching chosen job categories | Consent |
| GitHub activity | Public contributions (graph), repo info, org memberships, issue/PR/assignee info | Graph and post card display, team collaboration features | Performance of contract |
| Generated during use | Posts and photos, comments, like/follow/block relationships, recruit posts and applications, team and 1:1 chat messages and images | Social, team and chat features | Performance of contract |
| Reports & sanctions | Report content, copies of reported messages and 10 before/after (tentative), sanction history | Report handling, abuse prevention | Legitimate interest / law |
| Automatically collected | Access time, IP address, device info (OS, app version), push token, service usage logs, cookies | Security, abuse prevention, notifications, service improvement stats | Contract / law |
| Notification email | Email entered separately when GitHub has no public email | Account notices | Consent |
| Marketing (optional) | Email, push token | Event and new-feature notices | Separate consent |
| AI summary (Flex teams) | Team chat messages in the requested range, summary results | Generating AI summaries | Performance of contract |
| Business member (recruiter) | Name, company email, password (one-way hashed), company name, job title, company website (optional) | Business member sign-up, company email verification, recruiting offer messages | Consent |
| Profile view records | Date a business member viewed a developer profile and the business member identifier (1 per day) | Weekly view **count** notice to Pro members (who viewed is never disclosed) | Performance of contract |
| Job ads (Scout subscription) | Posting title, job category, external posting URL, closing date, per-ad daily impression/click counts (aggregates that don't identify individuals), ad close/hide records | Showing feed job ads, keeping closed ads hidden, handling reports of abusive ads | Contract performance |
| Business member verification | Email verification codes / password reset links (stored hashed) | Confirming mailbox ownership, password reset | Performance of contract |

- Location data (EXIF) is stripped from uploaded photos before storage.
- Private repo and private org activity is never shown on profiles or the feed without the member's consent.
- When using team features, other people in the same GitHub org (including non-Linker users) have their GitHub handle, profile photo and issue activity shown on team screens. This is fetched only within the scope the GitHub org owner allowed when installing the Linker app, and deleted when deleted on GitHub.
- The Company does not collect resident registration numbers, sensitive data or precise location data.

### Article 2. Retention period

Destroyed without delay on account deletion or when the purpose is fulfilled. The following are kept for the periods shown (all tentative).

| Item | Retention | Reason |
| --- | --- | --- |
| Member info | 30 days after deletion request | Withdrawal of deletion (restore by logging in) |
| Email verification codes / reset links | One day after use or expiry (codes valid 10 min, links 30 min) | Verifying authentication attempts |
| GitHub access token | Deleted immediately on account deletion / disconnect | Integration ends |
| Posts, comments, photos | Immediately on deletion; from backups within 30 days | Backup cycle |
| Team chat messages | While the team exists. After account deletion, kept with author changed to "deleted user" | Preserving team work records |
| 1:1 chat | Deleted when both parties leave | The other party's right to access |
| Chat image originals | Free teams 90 days, Flex teams while the team exists (free-team rules 30 days after Flex ends), 1:1 chat 1 year. Then previews only | Storage management |
| Profile view records | 90 days | Counting weekly views |
| Report material | 1 year after handling | Appeals and disputes |
| Sanction history | 1 year after sanction. For permanent suspension, only the GitHub id for [N years] | Preventing sanction evasion via re-signup |
| Access logs (login time, IP) | 3 months | Protection of Communications Secrets Act |
| Service usage logs | 90 days | Security and abuse response |
| Push token | Immediately on logout / account deletion | Notifications end |
| AI summary results | 7 days | Re-check by requester |
| Marketing consent records | Until withdrawn | Information and Communications Network Act |

**For paid subscriptions**: The Company does not store payment instrument information such as card numbers; it processes only payment history (product, amount, payment time, transaction id). Under the Electronic Commerce Act, records of contracts and withdrawals and of payment and supply are kept 5 years, and records of consumer complaints and dispute handling 3 years.

### Article 3. Provision to third parties

The Company does not provide users' personal data to third parties, except:

1. When information a user chose to publish or send is visible to other users. E.g. profiles (name, avatar, bio, tech stack, graph, completion record, posts), posts and recruit posts are visible to logged-out visitors. This information may also appear in search results of search engines such as Google and Naver (business member profiles are not exposed to search engines). On account deletion or content deletion it disappears from Linker immediately, but copies left in search engines are removed when the search engine re-crawls. Applying to a recruit post shows the profile to its author. Setting job-seeking status to "Open to offers" makes that visible only to business members (recruiters).
2. The Company does not provide members' email or contact details to business members during recruiting offers. Information a member shares directly in a 1:1 chat is transmitted by the member themselves.
3. When required by specific legal provisions or requested by investigative agencies through legally prescribed procedures.

### Article 4. Processing outsourcing and overseas transfer

The Company entrusts processing to the vendors below to provide the service. Some vendors are overseas, so personal data is transferred abroad. This transfer is necessary to perform the service contract and is disclosed through this policy under PIPA art. 28-8(1)(3). Vendor names must be finalized to those actually used before launch.

| Recipient (country) | Task | Items transferred | When / how | Retention |
| --- | --- | --- | --- | --- |
| [Backend hosting vendor] ([country]) | Servers, DB, file storage | Everything in art. 1 | Continuously during use, network transfer | Until the outsourcing contract ends |
| Vercel Inc. (USA) | Serving web screens, access logs | IP, device info, access records | On access | Same as above |
| GitHub, Inc. (USA) | Login, GitHub integration | GitHub account info, issues/assignments written by the user | On feature use | Per GitHub policy |
| 650 Industries, Inc. (USA, Expo Push) / Google LLC (USA, FCM) | Sending push notifications | Push token, notification content | On sending | Until the outsourcing contract ends |
| [Email vendor] ([country]) | Account notices and verification emails | Email | On sending | Same as above |
| [Analytics: PostHog / Google Analytics] ([country]) | Usage statistics | Device info, usage records (pseudonymous id) | Continuously during use | [period] |
| [Error tracking vendor] ([country]) | Error analysis | Device info, error logs | On error | [period] |
| [AI vendor] ([country]) (remove this row if processed with Ollama on Company servers) | Team chat summary | Chat messages in the summary range | On summary request | Not stored after processing, not used for training |

Card payment processing for paid subscriptions is entrusted to Toss Payments Co., Ltd. (Republic of Korea). The Company does not receive card numbers.

Users who don't want overseas transfer may delete their account or contact the privacy officer. However, the vendors above are needed for core features, so refusing the transfer makes those features unusable.

### Article 5. Destruction procedure and method

1. Destroyed within 5 days after the retention period ends or the purpose is fulfilled.
2. Electronic files are erased irrecoverably; backups are purged within the backup cycle (30 days, tentative).
3. Information retained under law is stored separately from other information and used only for that purpose.

### Article 6. Users' rights and how to exercise them

1. Users may request access, correction/deletion, suspension of processing, or withdrawal of consent at any time.
2. Profiles and posts can be edited or deleted directly in the app; other requests to [privacy officer email] are handled within 10 days.
3. Downloading my data (profile, posts) will be provided in settings in phase 2. Until then, it can be requested by email.
4. Exercising rights through an agent requires a power of attorney.
5. Some requests may be limited by law where they could infringe other users' rights (e.g. 1:1 messages the other party received, team chat records).

### Article 7. Automatic collection devices and behavioral data

1. Web and in-app screens use cookies and device storage to keep users logged in. Cookies can be blocked in browser settings, but login may not work.
2. The Company collects screen navigation and button usage via analytics tools to improve the service. These records are not used for advertising.
3. Feed recommendations are determined by follow relationships, like/comment counts and tech stack tags, and the reason is shown on each post.
4. Job ads in the feed are chosen only by the job categories of interest the member picked in profile edit, never by behavioral data such as screen navigation or clicks. If job categories are left empty, no job ads are shown, and the Company does not tell business members which members saw an ad.

### Article 8. Security measures

- Administrative: internal management plan, minimal operator permissions (operator / lead operator), regular training
- Technical: encryption of GitHub tokens and passwords, HTTPS end to end, back-office 2FA and 30-minute auto logout, masked emails in the back office, access logs retained
- Operators can't see chats that haven't been reported, and every operator action is logged with operator, time and reason.

### Article 9. Children under 14

The Company does not accept sign-ups from children under 14. If a member is confirmed to be under 14 after sign-up, the account and personal data are deleted.

### Article 10. Privacy officer and complaints

| Role | Details |
| --- | --- |
| Privacy officer | [name], [title], [email], [phone] |
| Complaints handling | [department or person], [email] |

For help with personal data infringement, contact:

- Personal Information Dispute Mediation Committee: 1833-6972, www.kopico.go.kr
- Personal Information Infringement Report Center: 118, privacy.kisa.or.kr
- Supreme Prosecutors' Office Cyber Investigation Division: 1301, www.spo.go.kr
- Korean National Police Agency Cyber Bureau: 182, ecrm.police.go.kr

### Article 11. Changes to this policy

Changes are announced in-app from 7 days before taking effect; important changes that expand collected items, purposes or third-party provision are announced 30 days ahead, with renewed consent if needed. Previous versions can be viewed in settings.

Addendum: This policy takes effect from [effective date].

## 2. Sign-up consent text

Text shown on one screen right after the first GitHub login. Required and optional items are checked separately; "agree to all" is only a convenience and never forces optional items. Sign-up must be possible without agreeing to optional items.

**Screen layout** (labels shown in Korean in the app)

- [ ] Agree to all (incl. optional) — 전체 동의 (선택 항목 포함)
- [ ] (Required) I am 14 or older — (필수) 만 14세 이상입니다
- [ ] (Required) Agree to Terms of Service — view — (필수) 서비스 이용약관 동의 — 보기
- [ ] (Required) Agree to collection and use of personal data — view — (필수) 개인정보 수집·이용 동의 — 보기
- [ ] (Optional) Agree to collection and use of additional profile info — view — (선택) 프로필 추가 정보 수집·이용 동의 — 보기
- [ ] (Optional) Agree to receive marketing — view — (선택) 마케팅 정보 수신 동의 — 보기

* View Privacy Policy (not a consent item, link only) — 개인정보 처리방침 보기

**(Required) Consent to collection and use of personal data**

| Items | Purpose | Retention |
| --- | --- | --- |
| GitHub user id, handle, name, profile photo, email, GitHub access token | Member identification and login, account notices, GitHub integration | **30 days after account deletion** (token immediately). Legal and sanction records kept for the periods in the policy |

You may refuse consent, but then you can't sign up.

**(Optional) Consent to collection and use of additional profile info**

| Items | Purpose | Retention |
| --- | --- | --- |
| Bio, blog link, tech stack, looking-for-team flag, job-seeking status, job categories of interest | Profile display, team matching, personalized recommendations, receiving recruiting offers, showing job ads matching chosen job categories (job categories visible only to the member) | **Until account deletion or consent withdrawal** |

You can sign up without agreeing; those items won't show on your profile and recommendations may be less accurate.

**Recruiter (business member) sign-up consent screen**

Shown in the first step of recruiter sign-up. The marketing option is the same as for developers.

- [ ] (Required) I am 19 or older — (필수) 만 19세 이상입니다
- [ ] (Required) Agree to Terms of Service — view
- [ ] (Required) Agree to Business Member (recruiter) Supplementary Terms — view — (필수) 기업회원(채용 담당자) 추가약관 동의
- [ ] (Required) Agree to collection and use of business member personal data — view — (필수) 기업회원 개인정보 수집·이용 동의
- [ ] (Optional) Agree to receive marketing — view

| Items | Purpose | Retention |
| --- | --- | --- |
| Name, company email, password (one-way hashed), company name, job title, company website (optional) | Business member identification and login, company email verification, profile display, recruiting offer messages | **30 days after account deletion**. Legal and sanction records kept for the periods in the policy |

You may refuse consent, but then you can't sign up as a business member.

**(Optional) Consent to receive marketing**

Receive Linker's new features, events and hackathon/recruiting news via app push and email. Not agreeing doesn't affect use of the service; can be turned off anytime in Settings > Notifications.

- Let users choose channels separately: [ ] App push [ ] Email
- No advertising notifications 9 PM–8 AM (separate consent needed to send then).
- After consenting/withdrawing, send "[date]에 마케팅 수신에 동의(철회)했어요" (you agreed to / withdrew from marketing on [date]), and re-confirm consent every 2 years.
- Advertising messages are prefixed "(광고)" in the title and state how to opt out.

**When renewed consent is required**

- When collected items or purposes expand. Job categories of interest (job ads) are included in the MVP optional profile consent from the start, so no separate re-consent
- First use of voice chat / meeting recording (later phase) (recording consent from all participants)
- When collected items or purposes expand

## 3. Pre-launch checklist

- [ ] Appoint a privacy officer (the representative may double up in a small company) and list contact details
- [ ] Finalize vendors in the outsourcing/overseas transfer table to those actually used (backend hosting, Postgres/Redis, email, analytics, error tracking, image storage)
- [ ] Sign a DPA with each vendor; if AI summary is processed by an external AI vendor, confirm no-training and retention terms (not applicable if Ollama is self-hosted)
- [ ] Decide [N years] retention for GitHub ids of permanently suspended accounts (with Policy ch. 9)
- [ ] Public URL for the policy and a page to view previous versions
- [ ] Store consent records (who agreed to which version, when)

**Aligned with the Policy**

- Advertising notifications not sent 9 PM–8 AM (reflected in Policy ch. 8 POL-N-1).
- Access logs: login records (3 months, Protection of Communications Secrets Act) and service usage logs (90 days) listed separately.
- 1:1 chats are "deleted when both leave", so my messages remain in the other party's room after I delete my account. Listed in the retention table; needs lawyer confirmation.

**Questions for the lawyer**

1. Whether keeping team chat messages as "deleted user" after account deletion conflicts with the right to erasure
2. Legal basis (org owner's app install consent, legitimate interest) and notice method for showing info of GitHub org members who haven't joined Linker on team screens
3. Whether overseas transfer can be handled by policy disclosure alone or requires separate consent (especially AI vendors)
4. Whether "auto temporary hide (5 reports)" and feed recommendations count as automated decisions (PIPA art. 37-2)
