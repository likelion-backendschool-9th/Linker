package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.notification.response.NotificationItemResponse;
import com.linker.backend.dto.notification.response.NotificationItemResponse.AppealState;
import com.linker.backend.dto.notification.response.NotificationPageResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.entity.notification.PushToken;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.moderation.Sanction;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.time.DatabaseInstant;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.AppealRepository;
import com.linker.backend.repository.moderation.SanctionRepository;
import com.linker.backend.repository.notification.NotificationRepository;
import com.linker.backend.repository.notification.PushTokenRepository;

import org.springframework.data.domain.PageRequest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notification creation, list, read, and Android token storage for the user access boundary.
 * Recipients of {@code create} may be developers or recruiters. Creation joins the caller's
 * transaction and never sends push. List and read stay on this service. Does not delegate to
 * another role's notification service.
 */
@Service("userNotificationService")
public class NotificationService {

	/** Technical page size, not a Policy limit. */
	static final int PAGE_SIZE = 20;

	private static final int CURSOR_VERSION = 1;
	private static final int MAX_CURSOR_LENGTH = 160;

	private final UserRepository users;
	private final NotificationRepository notifications;
	private final PushTokenRepository tokens;
	private final SanctionRepository sanctions;
	private final AppealRepository appeals;
	private final Clock clock;
	private final JsonMapper json = JsonMapper.builder().build();

	public NotificationService(
			UserRepository users,
			NotificationRepository notifications,
			Clock clock,
			PushTokenRepository tokens,
			SanctionRepository sanctions,
			AppealRepository appeals
	) {
		this.users = users;
		this.notifications = notifications;
		this.clock = clock;
		this.tokens = tokens;
		this.sanctions = sanctions;
		this.appeals = appeals;
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

	/** Header bell. Quiet-hours rows stay hidden until {@code deliver_after}. */
	@Transactional(readOnly = true)
	public long unreadCount(AuthenticatedUser user) {
		return notifications.countVisibleUnread(user.userId(), Instant.now(clock));
	}

	@Transactional(readOnly = true)
	public NotificationPageResponse list(AuthenticatedUser user, String rawCursor) {
		Instant now = Instant.now(clock);
		Cursor cursor = decodeCursor(user.userId(), rawCursor);
		PageRequest limit = PageRequest.of(0, PAGE_SIZE + 1);
		List<Notification> rows = cursor == null
				? notifications.findFirstVisiblePage(user.userId(), now, limit)
				: notifications.findVisiblePageAfter(user.userId(), now, cursor.createdAt(), cursor.id(), limit);
		boolean more = rows.size() > PAGE_SIZE;
		List<Notification> page = more ? rows.subList(0, PAGE_SIZE) : rows;
		Map<Long, Sanction> owned = ownedSanctions(user.userId(), page);
		Set<Long> appealed = appealedSanctions(owned.keySet());
		List<NotificationItemResponse> items = new ArrayList<>();
		for (Notification row : page) {
			items.add(toItem(row, owned, appealed));
		}
		String next = null;
		if (more && !page.isEmpty()) {
			Notification last = page.get(page.size() - 1);
			next = encodeCursor(user.userId(), last.getCreatedAt(), last.getId());
		}
		return new NotificationPageResponse(items, next);
	}

	@Transactional
	public void markRead(AuthenticatedUser user, long notificationId) {
		Notification row = notifications.findById(notificationId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요"));
		if (!row.getUser().getId().equals(user.userId())) {
			throw new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		row.markRead(DatabaseInstant.now(clock));
	}

	@Transactional
	public void markAllRead(AuthenticatedUser user) {
		notifications.markVisibleUnread(user.userId(), DatabaseInstant.now(clock));
	}

	/** Stores an Android Expo token. This does not send a push or set {@code pushed_at}. */
	@Transactional
	public void registerPushToken(AuthenticatedUser principal, String rawToken, String rawPlatform) {
		String token = rawToken == null ? "" : rawToken.trim();
		if (token.isEmpty() || token.length() > 512 || !android(rawPlatform)) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		User owner = requireActiveUser(principal.userId());
		Instant now = DatabaseInstant.now(clock);
		PushToken existing = tokens.findByExpoPushToken(token).orElse(null);
		if (existing != null) {
			existing.reassign(owner, now);
			return;
		}
		tokens.save(PushToken.register(owner, token, now));
	}

	@Transactional
	public void deletePushToken(AuthenticatedUser user, String rawToken) {
		String token = rawToken == null ? "" : rawToken.trim();
		PushToken row = token.isEmpty() ? null : tokens.findByExpoPushToken(token).orElse(null);
		if (row == null || !row.getUser().getId().equals(user.userId())) {
			throw new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없어요");
		}
		tokens.delete(row);
	}

	/** Push preference only. In-app notification rows stay in place when this is off. */
	@Transactional
	public boolean setPushEnabled(AuthenticatedUser principal, Boolean pushEnabled) {
		if (pushEnabled == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		User user = requireActiveUser(principal.userId());
		user.setPushEnabled(pushEnabled);
		return user.isPushEnabled();
	}

	private User requireActiveUser(long userId) {
		return users.findById(userId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
	}

	private Map<Long, Sanction> ownedSanctions(long userId, List<Notification> rows) {
		Set<Long> ids = new HashSet<>();
		for (Notification row : rows) {
			Long sanctionId = sanctionId(row.getPayload());
			if (sanctionId != null) {
				ids.add(sanctionId);
			}
		}
		if (ids.isEmpty()) {
			return Map.of();
		}
		Map<Long, Sanction> owned = new HashMap<>();
		for (Sanction sanction : sanctions.findAllById(ids)) {
			if (sanction.getUser().getId().equals(userId)) {
				owned.put(sanction.getId(), sanction);
			}
		}
		return owned;
	}

	private Set<Long> appealedSanctions(Set<Long> sanctionIds) {
		if (sanctionIds.isEmpty()) {
			return Set.of();
		}
		return new HashSet<>(appeals.findSanctionIds(sanctionIds));
	}

	private NotificationItemResponse toItem(Notification row, Map<Long, Sanction> owned, Set<Long> appealed) {
		PayloadText text = payloadText(row.getPayload());
		String title = text.title() != null ? text.title() : text.message() != null ? text.message() : row.getNotificationType();
		String body = text.body() != null ? text.body() : text.reason();
		Long sanctionId = sanctionId(row.getPayload());
		AppealState appeal = sanctionId != null && owned.containsKey(sanctionId)
				? new AppealState(sanctionId, appealed.contains(sanctionId))
				: null;
		return new NotificationItemResponse(
				row.getId(),
				row.getNotificationType(),
				title,
				body,
				row.getLinkPath() == null ? "" : row.getLinkPath(),
				row.getReadAt() != null,
				row.getCreatedAt(),
				appeal
		);
	}

	private PayloadText payloadText(String payload) {
		JsonNode node = payloadNode(payload);
		if (node == null) {
			return new PayloadText(null, null, null, null);
		}
		return new PayloadText(text(node, "title"), text(node, "message"), text(node, "body"), text(node, "reason"));
	}

	private Long sanctionId(String payload) {
		JsonNode node = payloadNode(payload);
		JsonNode value = node == null ? null : node.get("sanctionId");
		if (value == null || !value.isNumber()) {
			return null;
		}
		double wide = value.doubleValue();
		long exact = value.longValue();
		if (wide != exact || exact < 1) {
			return null;
		}
		return exact;
	}

	private JsonNode payloadNode(String payload) {
		if (payload == null || payload.isBlank()) {
			return null;
		}
		try {
			JsonNode node = json.readTree(payload);
			return node.isObject() ? node : null;
		}
		catch (RuntimeException exception) {
			return null;
		}
	}

	private static String text(JsonNode node, String field) {
		JsonNode value = node.get(field);
		if (value == null || !value.isString()) {
			return null;
		}
		return value.asString();
	}

	private Cursor decodeCursor(long userId, String rawCursor) {
		if (rawCursor == null || rawCursor.isBlank()) {
			return null;
		}
		if (rawCursor.length() > MAX_CURSOR_LENGTH) {
			throw badCursor();
		}
		final String decoded;
		try {
			byte[] bytes = Base64.getUrlDecoder().decode(rawCursor);
			if (bytes.length > 96) {
				throw badCursor();
			}
			decoded = new String(bytes, StandardCharsets.UTF_8);
		}
		catch (IllegalArgumentException exception) {
			throw badCursor();
		}
		String[] parts = decoded.split(":", -1);
		if (parts.length != 4) {
			throw badCursor();
		}
		try {
			int version = canonicalInt(parts[0]);
			long ownerId = canonicalLong(parts[1]);
			int dot = parts[2].indexOf('.');
			if (version != CURSOR_VERSION || ownerId != userId || dot <= 0 || dot != parts[2].lastIndexOf('.')) {
				throw badCursor();
			}
			long seconds = canonicalLong(parts[2].substring(0, dot));
			int nanos = canonicalInt(parts[2].substring(dot + 1));
			long id = canonicalLong(parts[3]);
			if (nanos < 0 || nanos > 999_999_999 || id < 1) {
				throw badCursor();
			}
			Instant createdAt = Instant.ofEpochSecond(seconds, nanos);
			if (createdAt.getEpochSecond() != seconds || createdAt.getNano() != nanos) {
				throw badCursor();
			}
			return new Cursor(createdAt, id);
		}
		catch (NumberFormatException | DateTimeException exception) {
			throw badCursor();
		}
	}

	private static String encodeCursor(long userId, Instant createdAt, long id) {
		String raw = CURSOR_VERSION + ":" + userId + ":" + createdAt.getEpochSecond() + "." + createdAt.getNano() + ":" + id;
		return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	private static int canonicalInt(String raw) {
		if (raw.isEmpty() || raw.length() > 9) {
			throw new NumberFormatException();
		}
		int value = Integer.parseInt(raw);
		if (!Integer.toString(value).equals(raw)) {
			throw new NumberFormatException();
		}
		return value;
	}

	private static long canonicalLong(String raw) {
		if (raw.isEmpty() || raw.length() > 20) {
			throw new NumberFormatException();
		}
		long value = Long.parseLong(raw);
		if (!Long.toString(value).equals(raw)) {
			throw new NumberFormatException();
		}
		return value;
	}

	private static boolean android(String platform) {
		return platform != null && platform.trim().equalsIgnoreCase("android");
	}

	private static ApiException badCursor() {
		return new ApiException(400, "VALIDATION_ERROR", "목록 위치를 확인해 주세요");
	}

	private record Cursor(Instant createdAt, long id) {
	}

	private record PayloadText(String title, String message, String body, String reason) {
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
