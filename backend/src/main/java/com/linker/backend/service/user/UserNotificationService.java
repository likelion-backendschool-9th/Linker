package com.linker.backend.service.user;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notification creation for the user access boundary. The caller supplies a
 * trusted command after checking its use-case permissions; recipients may be
 * developers or recruiters. Joins the caller's transaction and never sends push.
 * Does not delegate to another role's notification service.
 */
@Service
public class UserNotificationService {

	private final UserRepository users;
	private final NotificationRepository notifications;
	private final Clock clock;

	public UserNotificationService(UserRepository users, NotificationRepository notifications, Clock clock) {
		this.users = users;
		this.notifications = notifications;
		this.clock = clock;
	}

	@Transactional
	public Notification create(CreateNotificationCommand command) {
		User recipient = requireActiveUser(command.recipientUserId());
		User actor = command.actorUserId() == null ? null : requireActiveUser(command.actorUserId());
		Instant deliverAfter = deliverAfter(command.notificationType(), Instant.now(clock));
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

	private Instant deliverAfter(String type, Instant now) {
		if (NotificationTypes.CHAT.equals(type)) {
			return null;
		}
		ZonedDateTime local = now.atZone(PlanLimits.APP_ZONE);
		int startHour = NotificationTypes.MARKETING.equals(type)
				? PlanLimits.MARKETING_QUIET_HOURS_START_HOUR : PlanLimits.QUIET_HOURS_START_HOUR;
		LocalTime time = local.toLocalTime();
		LocalTime end = LocalTime.of(PlanLimits.QUIET_HOURS_END_HOUR, 0);
		if (time.isBefore(LocalTime.of(startHour, 0)) && !time.isBefore(end)) {
			return null;
		}
		LocalDate day = time.isBefore(end) ? local.toLocalDate() : local.toLocalDate().plusDays(1);
		return day.atTime(end).atZone(PlanLimits.APP_ZONE).toInstant();
	}
}
