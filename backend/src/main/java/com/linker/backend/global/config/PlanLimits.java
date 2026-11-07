package com.linker.backend.global.config;

import java.time.ZoneId;
import java.util.List;

/**
 * Policy numbers used by the common foundation and D chat/notification/subscription contracts.
 * Safety caps not in the policy are named at the call site.
 */
public final class PlanLimits {

	public static final ZoneId APP_ZONE = ZoneId.of("Asia/Seoul");

	public static final int IMAGE_MAX_BYTES = 10 * 1024 * 1024;
	public static final int IMAGE_LONG_SIDE = 2048;
	public static final int SESSION_DAYS = 30;
	/** Policy ch. 3 — pending withdrawal before anonymization. */
	public static final int ACCOUNT_WITHDRAWAL_DAYS = 30;
	/** Policy ch. 2 — login during pending deletion restores the account. */
	public static final int ACCOUNT_WITHDRAWAL_RESTORE_DAYS = 30;
	/** Terms version stored with onboarding agreement. Matches the page 02 client. */
	public static final String TERMS_VERSION = "2026-10-01";
	/** POL-A-2 display name length. */
	public static final int PROFILE_DISPLAY_NAME_MIN = 1;
	public static final int PROFILE_DISPLAY_NAME_MAX = 20;
	/** POL-A-2 bio length. */
	public static final int PROFILE_BIO_MAX = 160;
	/** POL-A-3 predefined tech stack tags. */
	public static final int PROFILE_TECH_STACK_MAX = 10;
	/** POL-P-5 follows created per viewer per Seoul day. */
	public static final int FOLLOWS_PER_DAY = 200;
	/** POL-A-3. Looking-for-team turns off after this many days without a login. */
	public static final int PROFILE_LOOKING_FOR_TEAM_IDLE_DAYS = 30;
	/** POL-H-4. Job seeking turns off after this many days without a login. */
	public static final int PROFILE_JOB_SEEKING_IDLE_DAYS = 90;
	public static final int PUBLIC_READS_PER_MINUTE = 60;
	public static final int SITEMAP_PAGE_SIZE = 50_000;
	/** Policy ch. 6 — archived teams do not consume this personal membership cap. */
	public static final int TEAMS_PER_USER_MAX = 10;
	/** Policy ch. 6 — archive after this many days in read-only following App removal. */
	public static final int TEAM_READ_ONLY_ARCHIVE_DAYS = 30;
	public static final int REPORT_AUTO_HIDE_REPORTERS = 5;
	/** List page size for recruit feeds (WBS cursor pages). */
	public static final int RECRUIT_PAGE_SIZE = 20;
	/** POL-R-1 — concurrent OPEN recruit posts (free / Pro). */
	public static final int OPEN_RECRUIT_POSTS_FREE = 3;
	public static final int OPEN_RECRUIT_POSTS_PRO = 10;
	/** Policy ch. 2 — recruit post creates per user per rolling day. */
	public static final int RECRUIT_POSTS_PER_DAY = 5;
	public static final int RECRUIT_POSTS_PER_DAY_WINDOW_SECONDS = 86_400;
	/** POL-R-1 field bounds. */
	public static final int RECRUIT_TITLE_MAX = 40;
	public static final int RECRUIT_INTRO_MAX = 1000;
	public static final int RECRUIT_HEADCOUNT_MIN = 1;
	public static final int RECRUIT_HEADCOUNT_MAX = 10;
	public static final int RECRUIT_TECH_TAGS_MAX = 10;
	public static final int RECRUIT_DEADLINE_WITHIN_DAYS = 60;
	/** POL-R-3 — apply message and daily cap. */
	public static final int APPLICATION_MESSAGE_MAX = 300;
	public static final int APPLICATIONS_PER_DAY = 20;
	public static final int APPLICATIONS_PER_DAY_WINDOW_SECONDS = 86_400;
	/** POL-R-3 — one re-apply after cancel (attempt 1 then 2). */
	public static final int APPLICATION_MAX_ATTEMPTS = 2;
	/** POL-R-4 — unhandled pending applications expire after this many days. */
	public static final int APPLICATION_EXPIRE_DAYS = 14;
	/** Policy ch. 11 — free team member cap (Flex unlimited later). */
	public static final int TEAM_MEMBERS_FREE = 6;
	/** Policy ch. 6 — deleted teams keep chat for this many days before removal. */
	public static final int TEAM_DELETED_CHAT_RETENTION_DAYS = 30;
	/** POL-P-2 / ch. 2 — project post writes and photo caps. */
	public static final int POSTS_PER_DAY = 10;
	public static final int POSTS_PER_DAY_WINDOW_SECONDS = 86_400;
	public static final int POST_INTRO_MIN = 1;
	public static final int POST_INTRO_MAX = 60;
	public static final int POST_BODY_MAX = 2_000;
	public static final int POST_ROLE_MAX = 40;
	public static final int POST_DEMO_LINKS_MAX = 3;
	public static final int POST_TAGS_MAX = 5;
	public static final int POST_TEAM_SIZE_MIN = 1;
	public static final int POST_TEAM_SIZE_MAX = 50;
	public static final int POST_PHOTOS_FREE = 5;
	public static final int POST_PHOTOS_PRO = 10;
	/** Policy ch. 4 / ch. 11 — featured posts on a profile. Pro ends do not unpin what is already saved. */
	public static final int PINNED_POSTS_FREE = 1;
	public static final int PINNED_POSTS_PRO = 5;
	/** POL-P-4 / FE p24 mock — home feed cursor page size. */
	public static final int FEED_PAGE_SIZE = 10;
	/** POL-P-4 — following posts per one recommendation slot. */
	public static final int FEED_FOLLOWING_PER_RECOMMENDATION = 4;
	/** POL-P-4 — max consecutive posts from the same author. */
	public static final int FEED_MAX_CONSECUTIVE_SAME_AUTHOR = 2;
	/** POL-P-4 — recommendation pool window and new-account like exclusion. */
	public static final int FEED_RECOMMENDATION_DAYS = 7;
	public static final int FEED_NEW_ACCOUNT_LIKE_EXCLUSION_DAYS = 7;
	/** POL-P-5 / ch. 2 — comment rate and length. */
	public static final int POST_COMMENT_MAX = 500;
	public static final int POST_COMMENTS_PER_MINUTE = 10;
	public static final int POST_COMMENTS_PER_MINUTE_WINDOW_SECONDS = 60;
	public static final int POST_COMMENTS_PER_DAY = 300;
	public static final int POST_COMMENTS_PER_DAY_WINDOW_SECONDS = 86_400;
	/** Policy ch. 9 — chat report evidence: reported message ± this many neighbors. */
	public static final int REPORT_CHAT_CONTEXT_MESSAGES = 10;
	public static final int ADMIN_OTP_IDLE_MINUTES = 30;
	/** Policy ch. 9 — handling target, counted in Seoul weekdays. */
	public static final int REPORT_HANDLING_BUSINESS_DAYS = 2;
	/** Policy ch. 9 — dismissed reports inside this window restrict reporting. */
	public static final int REPORT_DISMISS_WINDOW_DAYS = 30;
	public static final int REPORT_DISMISS_LIMIT = 5;
	public static final int REPORT_RESTRICTION_DAYS = 30;
	public static final int REPORT_DETAIL_MAX_CHARS = 1000;
	/** Reject decoded images larger than this on either side before they are resized. */
	public static final int IMAGE_MAX_SOURCE_SIDE = 8_192;

	/** Policy ch. 2 / ch. 8 — chat send rate and message shape. */
	public static final int CHAT_SENDS_PER_SECOND = 5;
	public static final int CHAT_MESSAGE_MAX_CHARS = 2_000;
	public static final int CHAT_IMAGES_PER_SEND = 10;
	public static final int CHAT_EDIT_WITHIN_HOURS = 24;
	public static final int CHAT_OFFER_MESSAGE_MAX_CHARS = 1_000;
	public static final int CHAT_CATCH_UP_MAX = 500;
	public static final int CHAT_AUTO_RETRIES = 3;
	/** Policy ch. 8 "1:1 chat request status": a request expires unanswered, and a rejected sender waits, this long. */
	public static final int CHAT_REQUEST_DAYS = 30;
	/** Policy ch. 2 — share actions, separate from normal message sends. */
	public static final int CHAT_SHARES_PER_MINUTE = 10;
	public static final int CHAT_SHARES_PER_DAY = 100;

	/** Policy ch. 11 — free team history window (Flex = unlimited). */
	public static final int TEAM_CHAT_HISTORY_DAYS_FREE = 60;
	/** Policy ch. 8 / ch. 11 — free-team image originals, not message retention. */
	public static final int TEAM_CHAT_IMAGE_ORIGINAL_RETENTION_DAYS_FREE = 90;

	/** Policy ch. 11 — recruiting offer daily caps. */
	public static final int RECRUITING_OFFERS_PER_DAY_FREE = 10;
	public static final int RECRUITING_OFFERS_PER_DAY_SCOUT = 50;
	/** POL-H-3. Rejection stays hidden, then looks like no reply. */
	public static final int RECRUITING_OFFER_REPLY_DAYS = 30;

	/** POL-H-1 company-email code and password. */
	public static final int RECRUITER_EMAIL_CODE_DIGITS = 6;
	public static final int RECRUITER_EMAIL_CODE_MINUTES = 10;
	public static final int RECRUITER_EMAIL_CODE_ATTEMPTS = 5;
	public static final int RECRUITER_EMAIL_RESEND_SECONDS = 60;
	public static final int RECRUITER_PASSWORD_MIN = 8;
	public static final int RECRUITER_PASSWORD_MAX = 64;
	public static final int RECRUITER_LOGIN_ATTEMPTS = 5;
	public static final int RECRUITER_LOGIN_LOCK_MINUTES = 10;
	public static final int RECRUITER_PASSWORD_RESET_MINUTES = 30;
	public static final int RECRUITER_COMPANY_MIN = 2;
	public static final int RECRUITER_COMPANY_MAX = 40;
	public static final int RECRUITER_JOB_TITLE_MAX = 30;

	/** POL-H-8. Interest categories stay off the public profile. */
	public static final int JOB_CATEGORIES_MAX = 3;
	/** POL-A-4. One month inside the last year, refreshed once a day. */
	public static final int CONTRIBUTION_MONTHS = 12;
	/** Policy ch. 3. Old GitHub login keeps resolving for this many days. */
	public static final int USERNAME_REDIRECT_DAYS = 90;
	/** ERD profile_visits. Rows older than this are deleted. */
	public static final int PROFILE_VISIT_RETENTION_DAYS = 90;
	/** POL-H-7. */
	public static final int JOB_AD_TITLE_MIN = 2;
	public static final int JOB_AD_TITLE_MAX = 40;
	public static final int JOB_AD_CLOSING_DAYS = 90;
	public static final int JOB_AD_EDITS_PER_DAY = 10;
	public static final List<String> JOB_AD_ALLOWED_HOSTS = List.of(
			"jobkorea.co.kr",
			"saramin.co.kr",
			"wanted.co.kr",
			"work24.go.kr");

	/** Policy ch. 8 / ch. 11 — Flex AI daily cap per person (KST), still tentative. */
	public static final int AI_SUMMARY_PER_DAY_FLEX = 10;
	/** Policy ch. 8 / ch. 11 — summary results only; shared cards follow chat retention. */
	public static final int AI_SUMMARY_RETENTION_DAYS = 7;

	/** POL-N-1 quiet hours (KST). Non-chat held from start hour until end hour. */
	public static final int QUIET_HOURS_START_HOUR = 22;
	public static final int QUIET_HOURS_END_HOUR = 8;
	/** Marketing opt-in notifications use a tighter evening start. */
	public static final int MARKETING_QUIET_HOURS_START_HOUR = 21;

	/** Policy ch. 11 / To-be-decided — tentative KRW prices (server is source of truth). */
	public static final int PRO_MONTHLY_KRW = 2_900;
	public static final int PRO_YEARLY_KRW = 29_000;
	public static final int FLEX_BASE_MONTHLY_KRW = 7_900;
	public static final int FLEX_EXTRA_SEAT_KRW = 1_900;
	public static final int FLEX_INCLUDED_SEATS = 6;
	public static final int SCOUT_MONTHLY_KRW = 14_900;
	public static final int SUBSCRIPTION_TRIAL_DAYS = 7;
	public static final int PAYMENT_REFUND_WITHIN_DAYS = 7;
	public static final int PAYMENT_FAILURE_GRACE_DAYS = 7;
	public static final int FLEX_POST_EXPIRY_GRACE_DAYS = 30;
	/** Policy ch. 11 — whole-team notice before both Flex expiry and grace-period end. */
	public static final int FLEX_EXPIRY_NOTICE_DAYS_BEFORE = 7;

	/** Policy ch. 7 / page 11 — shared issue sync contract. */
	public static final int ISSUE_REFRESH_INTERVAL_SECONDS = 60;
	public static final int ISSUE_ACTIVE_SYNC_MINUTES = 15;
	public static final int ISSUE_PROGRESS_DAYS = 14;
	/** Policy POL-I-2: GitHub maximum, not a team-size limit. */
	public static final int ISSUE_ASSIGNEES_MAX = 10;
	/** Policy ch.2: issue creation per author per KST day. */
	public static final int ISSUE_CREATES_PER_DAY = 100;
	/** Policy POL-N-1 / Page 15: one day before due, 09:00 KST. */
	public static final int ISSUE_DUE_REMINDER_DAYS_BEFORE = 1;
	public static final int ISSUE_DUE_REMINDER_HOUR = 9;

	private PlanLimits() {
	}

	/** Policy ch. 9: account-sanction ladder and inactivity reset. */
	public static final int SANCTION_FIRST_DAYS = 7;
	public static final int SANCTION_SECOND_DAYS = 30;
	public static final int SANCTION_RESET_YEARS = 1;

	/** Flex monthly amount for headcount on the billing date (no mid-period pro-rate). */
	public static int flexMonthlyAmount(int seats) {
		if (seats < 1) {
			throw new IllegalArgumentException("seats must be >= 1");
		}
		int extra = Math.max(0, seats - FLEX_INCLUDED_SEATS);
		return FLEX_BASE_MONTHLY_KRW + (extra * FLEX_EXTRA_SEAT_KRW);
	}
}
