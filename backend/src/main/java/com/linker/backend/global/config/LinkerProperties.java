package com.linker.backend.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "linker")
public record LinkerProperties(
		Session session,
		Security security,
		Storage storage,
		Github github,
		Webhook webhook,
		Payment payment
) {

	public record Session(
			String cookieName,
			String sameSite,
			boolean secure,
			String domain,
			String path,
			int lifetimeDays
	) {
	}

	public record Security(
			int publicReadPerMinute,
			boolean enforceOrigin,
			String allowedOrigins,
			boolean trustForwardedFor
	) {
	}

	public record Storage(String mode, String localDir) {
	}

	public record Github(String webhookSecret) {
	}

	public record Webhook(boolean consumerEnabled, String queueKey) {
	}

	/**
	 * Toss Payments. Secret key is server-only; leave blank to keep the unconfigured gateway.
	 * Test keys start with {@code test_sk} / {@code test_ck}.
	 */
	public record Payment(
			String secretKey,
			String clientKey,
			String baseUrl
	) {
	}
}
