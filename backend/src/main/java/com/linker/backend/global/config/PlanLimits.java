package com.linker.backend.global.config;

import java.time.ZoneId;

/**
 * Policy numbers used by the common foundation and D chat/notification/subscription contracts.
 * Prices stay with later payment steps; safety caps not in the policy are named at the call site.
 */
public final class PlanLimits {

	public static final ZoneId APP_ZONE = ZoneId.of("Asia/Seoul");

	public static final int IMAGE_MAX_BYTES = 10 * 1024 * 1024;
	public static final int IMAGE_LONG_SIDE = 2048;
	public static final int SESSION_DAYS = 30;
	public static final int PUBLIC_READS_PER_MINUTE = 60;
	public static final int SITEMAP_PAGE_SIZE = 50_000;
	public static final int REPORT_AUTO_HIDE_REPORTERS = 5;
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

	/** Policy ch. 11 — free team history window (Flex = unlimited). */
	public static final int TEAM_CHAT_HISTORY_DAYS_FREE = 60;

	/** Policy ch. 11 — recruiting offer daily caps. */
	public static final int RECRUITING_OFFERS_PER_DAY_FREE = 10;
	public static final int RECRUITING_OFFERS_PER_DAY_SCOUT = 50;

	/** Policy ch. 11 — Flex AI summary daily cap per person (KST). */
	public static final int AI_SUMMARY_PER_DAY_FLEX = 10;

	/** POL-N-1 quiet hours (KST). Non-chat held from start hour until end hour. */
	public static final int QUIET_HOURS_START_HOUR = 22;
	public static final int QUIET_HOURS_END_HOUR = 8;
	/** Marketing opt-in notifications use a tighter evening start. */
	public static final int MARKETING_QUIET_HOURS_START_HOUR = 21;

	private PlanLimits() {
	}
}
