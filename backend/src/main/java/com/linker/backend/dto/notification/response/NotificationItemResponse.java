package com.linker.backend.dto.notification.response;

import java.time.Instant;

public record NotificationItemResponse(
		long id,
		String type,
		String title,
		String body,
		String targetUrl,
		boolean read,
		Instant createdAt,
		AppealState appeal
) {

	public record AppealState(long sanctionId, boolean submitted) {
	}
}
