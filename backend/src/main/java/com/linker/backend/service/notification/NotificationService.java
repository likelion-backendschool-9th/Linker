package com.linker.backend.service.notification;

import java.time.Clock;
import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sole writer of {@code notifications}. Feature producers call {@link #create};
 * push and quiet-hours flush are handled by later workers, not by callers.
 */
@Service
public class NotificationService {

	private final UserRepository users;
	private final NotificationRepository notifications;
	private final Clock clock;

	public NotificationService(UserRepository users, NotificationRepository notifications, Clock clock) {
		this.users = users;
		this.notifications = notifications;
		this.clock = clock;
	}

	@Transactional
	public Notification create(CreateNotificationCommand command) {
		User recipient = requireActiveUser(command.recipientUserId());
		User actor = command.actorUserId() == null ? null : requireActiveUser(command.actorUserId());
		Instant deliverAfter = NotificationDeliverySchedule.deliverAfter(command.notificationType(), Instant.now(clock));
		Notification notification = Notification.create(
				recipient,
				command.notificationType(),
				actor,
				command.targetType(),
				command.targetId(),
				command.linkPath(),
				command.payloadJson(),
				command.groupKey(),
				deliverAfter
		);
		return notifications.save(notification);
	}

	private User requireActiveUser(long userId) {
		return users.findById(userId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
	}
}
