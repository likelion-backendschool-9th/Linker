package com.linker.backend.integration.ai;

/**
 * Reply text plus the model's own timing, used to calibrate progress estimates. Durations are in
 * nanoseconds and 0 when the model does not report them.
 */
public record LlmResult(
		String content,
		int promptTokens,
		long promptNanos,
		int outputTokens,
		long outputNanos,
		String doneReason
) {
}
