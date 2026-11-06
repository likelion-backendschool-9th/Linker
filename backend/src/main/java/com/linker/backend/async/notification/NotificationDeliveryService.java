package com.linker.backend.async.notification;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.linker.backend.entity.notification.Notification;
import com.linker.backend.integration.push.PushGateway;
import com.linker.backend.integration.push.PushMessage;
import com.linker.backend.repository.notification.NotificationRepository;
import com.linker.backend.repository.notification.PushTokenRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Delivers pending in-app notifications to Android Expo tokens. */
@Service
public class NotificationDeliveryService {

	private static final int BATCH_SIZE = 500;

	private final NotificationRepository notifications;
	private final PushTokenRepository tokens;
	private final PushGateway gateway;
	private final Clock clock;
	private final JsonMapper json = JsonMapper.builder().build();

	public NotificationDeliveryService(NotificationRepository notifications, PushTokenRepository tokens,
			PushGateway gateway, Clock clock) {
		this.notifications = notifications;
		this.tokens = tokens;
		this.gateway = gateway;
		this.clock = clock;
	}

	@Scheduled(fixedDelayString = "${linker.notifications.chat-delivery-delay-ms:60000}")
	public void deliverChat() {
		deliver(notifications.findDueChat(PageRequest.of(0, BATCH_SIZE)));
	}

	@Scheduled(cron = "0 0 8 * * *", zone = "Asia/Seoul")
	public void deliverDeferred() {
		deliver(notifications.findDueDeferred(Instant.now(clock), PageRequest.of(0, BATCH_SIZE)));
	}

	void deliver(List<Notification> rows) {
		if (rows.isEmpty()) return;
		Map<Long, List<Notification>> byUser = rows.stream().collect(Collectors.groupingBy(n -> n.getUser().getId(), LinkedHashMap::new, Collectors.toList()));
		Map<Long, List<com.linker.backend.entity.notification.PushToken>> byTokenUser = tokens.findByUser_IdIn(byUser.keySet()).stream()
				.collect(Collectors.groupingBy(t -> t.getUser().getId()));
		List<Notification> sentRows = new ArrayList<>();
		for (Map.Entry<Long, List<Notification>> entry : byUser.entrySet()) {
			List<Notification> selected = bundle(entry.getValue());
			for (var token : byTokenUser.getOrDefault(entry.getKey(), List.of())) {
				List<PushMessage> messages = selected.stream().map(n -> message(token.getExpoPushToken(), n)).toList();
				Set<String> successful = gateway.send(messages);
				if (successful.contains(token.getExpoPushToken())) sentRows.addAll(selected);
			}
		}
		markSent(sentRows);
	}

	@Transactional
	void markSent(List<Notification> rows) {
		Instant now = Instant.now(clock);
		rows.forEach(row -> row.markPushed(now));
	}

	private List<Notification> bundle(List<Notification> rows) {
		Map<String, Notification> bundled = new LinkedHashMap<>();
		for (Notification row : rows) {
			String key = row.getNotificationType() + "\u0000" + (row.getGroupKey() == null ? row.getId() : row.getGroupKey());
			bundled.put(key, row);
		}
		return new ArrayList<>(bundled.values());
	}

	private PushMessage message(String token, Notification row) {
		String title = row.getNotificationType();
		String body = "새 알림이 도착했어요";
		try {
			JsonNode node = row.getPayload() == null ? null : json.readTree(row.getPayload());
			if (node != null && node.isObject()) {
				if (node.get("title") != null && node.get("title").isString()) title = node.get("title").asString();
				else if (node.get("message") != null && node.get("message").isString()) title = node.get("message").asString();
				if (node.get("body") != null && node.get("body").isString()) body = node.get("body").asString();
			}
		}
		catch (RuntimeException ignored) {
		}
		return new PushMessage(token, title, body, row.getLinkPath(), Map.of("notificationId", row.getId()));
	}
}
