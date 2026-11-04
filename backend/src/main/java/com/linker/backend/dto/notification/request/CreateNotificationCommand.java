package com.linker.backend.dto.notification.request;

/**
 * Shared input contract for role-specific notification creation services.
 * This is an internal command, not a new public HTTP endpoint.
 */
public record CreateNotificationCommand(
		long recipientUserId,
		String notificationType,
		Long actorUserId,
		String targetType,
		Long targetId,
		String linkPath,
		String payloadJson,
		String groupKey
) {

	public CreateNotificationCommand {
		if (notificationType == null || notificationType.isBlank()) {
			throw new IllegalArgumentException("notificationType is required");
		}
		notificationType = notificationType.trim();
		if (targetType != null) {
			targetType = targetType.isBlank() ? null : targetType.trim();
		}
		if (linkPath != null) {
			linkPath = linkPath.isBlank() ? null : linkPath.trim();
		}
		if (groupKey != null) {
			groupKey = groupKey.isBlank() ? null : groupKey.trim();
		}
		if (payloadJson != null && payloadJson.isBlank()) {
			payloadJson = null;
		}
	}
}
