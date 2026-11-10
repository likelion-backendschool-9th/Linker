package com.linker.backend.integration.ai;

/**
 * The model gave no usable reply. {@code unreachable} means the call never reached the model (not
 * configured, connection refused, unknown host), the only case worth an immediate retry.
 */
public class LlmException extends RuntimeException {

	private final boolean unreachable;

	public LlmException(boolean unreachable, String message) {
		super(message);
		this.unreachable = unreachable;
	}

	public LlmException(boolean unreachable, String message, Throwable cause) {
		super(message, cause);
		this.unreachable = unreachable;
	}

	public boolean unreachable() {
		return unreachable;
	}
}
