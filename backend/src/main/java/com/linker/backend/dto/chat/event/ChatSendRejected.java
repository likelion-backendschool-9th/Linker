package com.linker.backend.dto.chat.event;

/**
 * Sender-only failure on the existing user queue. Not a broker receipt and not a saved message.
 */
public record ChatSendRejected(
		long userId,
		long roomId,
		String clientMessageId,
		String code,
		String message,
		boolean retryable,
		Long retryAfterSeconds
) {
}
