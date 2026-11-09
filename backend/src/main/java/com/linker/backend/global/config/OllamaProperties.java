package com.linker.backend.global.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("linker.ollama")
public record OllamaProperties(
		String baseUrl,
		String model,
		Duration connectTimeout,
		Duration readTimeout
) {
}
