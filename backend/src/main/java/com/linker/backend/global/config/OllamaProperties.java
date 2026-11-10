package com.linker.backend.global.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code numThread} should match the Ollama container's CPU cap ({@code deploy/ollama}, 2 CPUs).
 * {@code numCtx} 4096 fits the 4 GiB memory cap with {@code qwen3:4b}.
 */
@ConfigurationProperties("linker.ollama")
public record OllamaProperties(
		String baseUrl,
		String model,
		Duration connectTimeout,
		Duration readTimeout,
		Integer numThread,
		Integer numCtx
) {
}
