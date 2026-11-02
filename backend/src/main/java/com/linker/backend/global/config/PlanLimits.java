package com.linker.backend.global.config;

/**
 * Policy numbers used by the common foundation. Prices and plan benefits stay with later steps.
 * Safety caps that are not in the policy are named separately at the call site.
 */
public final class PlanLimits {

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

	private PlanLimits() {
	}
}
