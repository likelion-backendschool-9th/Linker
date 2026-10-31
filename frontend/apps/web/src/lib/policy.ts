/**
 * Every number the screens show or validate, copied from docs/04-policy.md.
 * When the policy changes, edit only this file (CLAUDE.md "Keep the docs consistent").
 * The server enforces the same values (`PlanLimits`, server config); these are for UI and form checks.
 */

const MB = 1024 * 1024;

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

/** 04 ch. 3 POL-A-2, POL-A-3, POL-H-8 */
export const PROFILE = {
  displayName: { min: 1, max: 20 },
  bioMax: 160,
  techStackMax: 10,
  jobCategoriesMax: 3,
} as const;

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
} as const;

/** 04 ch. 8 */
export const CHAT = {
  /** Policy ch. 2 rate limits/network failures; TODO 17 reconnect limit. */
  sendsPerSecond: 5,
  autoRetries: 3,
  catchUpMax: 500,
  messageMax: 2000,
  imagesPerSend: 10,
  editWithinHours: 24,
  offerMessageMax: 1000,
} as const;

/** `null` = no limit. 04 ch. 11 (Pro / Flex / Scout tables) */
export const PLAN_LIMITS = {
  photosPerPost: { free: 5, pro: 10 },
  pinnedPosts: { free: 1, pro: 5 },
  openRecruitPosts: { free: 3, pro: 10 },
  teamMembers: { free: 6, flex: null },
  teamChatHistoryDays: { free: 60, flex: null },
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
  scoutMonthly: 14900,
  trialDays: 7,
} as const;
