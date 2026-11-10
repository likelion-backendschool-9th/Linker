package com.linker.backend.integration.ai;

import java.time.Instant;
import java.util.Map;

/**
 * One chat completion. {@code schema} is the JSON schema the reply must follow; {@code deadline} stops a
 * reply that is still streaming.
 */
public record LlmRequest(
		String system,
		String user,
		Map<String, Object> schema,
		int maxOutputTokens,
		Instant deadline
) {
}
