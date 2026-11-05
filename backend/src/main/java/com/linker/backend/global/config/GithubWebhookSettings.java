package com.linker.backend.global.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Operational retry settings; independent of the public error and API contracts. */
@ConfigurationProperties("linker.webhook")
public record GithubWebhookSettings(
		@DefaultValue("5") int maxAttempts,
		@DefaultValue("30s") Duration retryDelay,
		@DefaultValue("60s") Duration receivedTimeout,
		@DefaultValue("100") int recoveryBatchSize
) {
	public GithubWebhookSettings {
		if (maxAttempts < 1 || recoveryBatchSize < 1 || recoveryBatchSize > 1000
				|| retryDelay == null || retryDelay.isNegative() || retryDelay.isZero()
				|| receivedTimeout == null || receivedTimeout.isNegative() || receivedTimeout.isZero()) {
			throw new IllegalArgumentException("Check linker.webhook retry settings");
		}
	}
}
