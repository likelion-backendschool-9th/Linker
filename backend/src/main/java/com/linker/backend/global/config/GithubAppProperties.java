package com.linker.backend.global.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("linker.github.app")
public record GithubAppProperties(
		@DefaultValue("") String id,
		@DefaultValue("") String slug,
		@DefaultValue("") String privateKey,
		@DefaultValue("https://api.github.com") String apiBaseUrl,
		@DefaultValue("2026-03-10") String apiVersion,
		@DefaultValue("10s") Duration requestTimeout,
		@DefaultValue("10m") Duration stateTtl
) {
	public GithubAppProperties {
		if (requestTimeout == null || requestTimeout.isNegative() || requestTimeout.isZero()
				|| stateTtl == null || stateTtl.isNegative() || stateTtl.isZero()) {
			throw new IllegalArgumentException("Check linker.github.app timeout settings");
		}
	}

	@Override
	public String toString() {
		return "GithubAppProperties[credentials=REDACTED]";
	}
}
