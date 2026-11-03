package com.linker.backend.service.notification;

/**
 * Input for {@link NotificationService#create(CreateNotificationCommand)}.
 * Every feature that needs an in-app notification must go through this command.
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
