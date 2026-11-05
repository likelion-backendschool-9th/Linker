package com.linker.backend.global.config;

import java.time.ZoneId;

/**
 * Policy numbers used by the common foundation and D chat/notification/subscription contracts.
 * Safety caps not in the policy are named at the call site.
 */
public final class PlanLimits {

	public static final ZoneId APP_ZONE = ZoneId.of("Asia/Seoul");

	public static final int IMAGE_MAX_BYTES = 10 * 1024 * 1024;
	public static final int IMAGE_LONG_SIDE = 2048;
	public static final int SESSION_DAYS = 30;
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
	public static final int PUBLIC_READS_PER_MINUTE = 60;
	public static final int SITEMAP_PAGE_SIZE = 50_000;
	/** Policy ch. 6 — archived teams do not consume this personal membership cap. */
	public static final int TEAMS_PER_USER_MAX = 10;
	/** Policy ch. 6 — archive after this many days in read-only following App removal. */
	public static final int TEAM_READ_ONLY_ARCHIVE_DAYS = 30;
	public static final int REPORT_AUTO_HIDE_REPORTERS = 5;
	/** Policy ch. 9 — chat report evidence: reported message ± this many neighbors. */
	public static final int REPORT_CHAT_CONTEXT_MESSAGES = 10;
	public static final int ADMIN_OTP_IDLE_MINUTES = 30;
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

	private PlanLimits() {
	}

	/** Flex monthly amount for headcount on the billing date (no mid-period pro-rate). */
	public static int flexMonthlyAmount(int seats) {
		if (seats < 1) {
			throw new IllegalArgumentException("seats must be >= 1");
		}
		int extra = Math.max(0, seats - FLEX_INCLUDED_SEATS);
		return FLEX_BASE_MONTHLY_KRW + (extra * FLEX_EXTRA_SEAT_KRW);
	}
}
