/**
 * Every number the screens show or validate, copied from docs/planning/04-policy.md.
 * When the policy changes, edit only this file (CLAUDE.md "Keep the docs consistent").
 * The server enforces the same values (`PlanLimits`, server config); these are for UI and form checks.
 */

const MB = 1024 * 1024;

/** WBS 00 / frontend blueprint §8-1: maximum URLs in each sitemap. */
export const SITEMAP = { pageSize: 50_000 } as const;

/** 04 ch. 2 "Input and display" */
export const INPUT = {
  maxConsecutiveLineBreaks: 2,
} as const;

/** 04 ch. 2 "Input and display" — images */
export const IMAGE = {
  maxBytes: 10 * MB,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  /** Resize target on the server; shown in helper text only */
  longSidePx: 2048,
} as const;

/** 04 ch. 2 "Network and failures" */
export const DRAFT = {
  keepDays: 7,
} as const;

/** 04 ch. 2 — login within this window restores a pending deletion. */
export const ACCOUNT = {
  withdrawalRestoreDays: 30,
} as const;

/** 04 ch. 3 POL-A-2, POL-A-3, POL-H-8 */
export const PROFILE = {
  displayName: { min: 1, max: 20 },
  bioMax: 160,
  techStackMax: 10,
  jobCategoriesMax: 3,
  /** POL-A-3. The server turns the badge off after this many days without login. */
  lookingForTeamIdleDays: 30,
  /** POL-H-4. The server turns job seeking off and notifies on the next session read. */
  jobSeekingIdleDays: 90,
} as const;

/** POL-P-5. The server rejects the next follow with this daily cap. */
export const FOLLOW = { perDay: 200 } as const;

/** 04 ch. 3 "Recruiter accounts" */
export const RECRUITER = {
  name: { min: 1, max: 20 },
  company: { min: 2, max: 40 },
  jobTitle: { min: 1, max: 30 },
  password: { min: 8, max: 64 },
  emailCode: { length: 6, validMinutes: 10, maxAttempts: 5, resendSeconds: 60 },
} as const;

/** 04 ch. 3 "Job ads" POL-H-7 */
export const JOB_AD = {
  title: { min: 2, max: 40 },
  closesWithinDays: 90,
} as const;

/** 04 ch. 4 POL-P-2, POL-P-5 */
export const POST = {
  intro: { min: 1, max: 60 },
  bodyMax: 2000,
  roleMax: 40,
  demoLinksMax: 3,
  teamSize: { min: 1, max: 50 },
  tagsMax: 5,
  commentMax: 500,
} as const;

/** 04 ch. 5 POL-R-1, POL-R-3 */
export const RECRUIT = {
  titleMax: 40,
  introMax: 1000,
  headcountPerRole: { min: 1, max: 10 },
  deadlineWithinDays: 60,
  techTagsMax: 10,
  applyMessageMax: 300,
} as const;

/** 04 ch. 6 */
export const TEAM = {
  maxTeamsPerUser: 10,
  inviteValidDays: 7,
  completionUndoDays: 7,
  completionMembershipDays: 14,
  chatDeletionDays: 30,
  removedApplyBlockedDays: 7,
} as const;

/** 04 ch. 2 rate limits, ch. 7 POL-I-2, POL-I-4 and "Sync" */
export const ISSUE = {
  createPerDay: 100,
  /** GitHub caps assignees at 10 (POL-I-2) */
  assigneesMax: 10,
  /** Pull to refresh: that screen's issues, once a minute */
  refreshIntervalSeconds: 60,
} as const;

/** 04 ch. 8 */
export const CHAT = {
  /** Policy ch. 2 rate limits/network failures; TODO 17 reconnect limit. */
  sendsPerSecond: 5,
  sharesPerMinute: 10,
  sharesPerDay: 100,
  autoRetries: 3,
  catchUpMax: 500,
  messageMax: 2000,
  imagesPerSend: 10,
  editWithinHours: 24,
  offerMessageMax: 1000,
  teamImageOriginalRetentionDaysFree: 90,
  /** Summary results only; shared cards follow chat retention. */
  aiSummaryRetentionDays: 7,
} as const;

/** 04 ch. 10 — operator admin session is locked after 30 minutes without activity. */
export const ADMIN = {
  otpIdleMinutes: 30,
} as const;

/** `null` = no limit. 04 ch. 11 (Pro / Flex / Scout tables) */
export const PLAN_LIMITS = {
  photosPerPost: { free: 5, pro: 10 },
  pinnedPosts: { free: 1, pro: 5 },
  openRecruitPosts: { free: 3, pro: 10 },
  teamMembers: { free: 6, flex: null },
  teamChatHistoryDays: { free: 60, flex: null },
  /** Policy ch. 8 / ch. 14: daily count remains tentative. */
  aiSummaryPerDay: { free: 0, flex: 10 },
  recruitingOffersPerDay: { free: 10, scout: 50 },
  jobAds: { free: 0, scout: 1 },
} as const;

/** Policy ch. 11. UI prices come from the API; these values seed the mock/server contract. */
export const SUBSCRIPTION_PRICE = {
  proMonthly: 2900,
  proYearly: 29000,
  flexMonthly: 7900,
  flexExtraMember: 1900,
  /** Billing inclusion, independent of the free-team member cap. */
  flexIncludedSeats: 6,
  scoutMonthly: 14900,
  trialDays: 7,
} as const;

/** Policy ch. 11 payment and expiry rules. */
export const SUBSCRIPTION_RULES = {
  refundWithinDays: 7,
  flexGraceDays: 30,
  paymentFailureGraceDays: 7,
  /** Whole-team notice before both Flex expiry and grace-period end. */
  flexExpiryNoticeDaysBefore: 7,
} as const;

/** Page TODO 30 / WBS 30: displayed analytics periods. */
export const STATS = { trendDays: 30, recruiterWeeks: 8 } as const;
