package com.linker.backend.async.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.notification.PushToken;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.push.PushGateway;
import com.linker.backend.integration.push.PushMessage;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.notification.PushTokenRepository;
import com.linker.backend.service.user.NotificationService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Non-chat push timing (Policy POL-N-1): outside 22:00–08:00 KST a follow, comment or application alert
 * is pushed on the next run; a row held for quiet hours goes out once its 08:00 has passed. A chat push
 * also needs the recipient to still be in the room when it is sent.
 * The fixed clock is 12:00 KST.
 */
@SpringBootTest
@Testcontainers
class NotificationDueDeliveryIntegrationTest {

	private static final Instant NOW = Instant.parse("2026-11-05T03:00:00Z");
	private static final RsaMaterial KEYS = RsaMaterial.generate();

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		registry.add("linker.storage.mode", () -> "local");
		registry.add("linker.github.webhook-secret", () -> "test-webhook-secret");
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
		// the tests run the job themselves
		registry.add("linker.notifications.delivery-delay-ms", () -> "3600000");
	}

	static final List<PushMessage> SENT = new CopyOnWriteArrayList<>();

	@org.springframework.boot.test.context.TestConfiguration
	static class Fixed {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}

		@Bean
		@Primary
		PushGateway recordingGateway() {
			PushGateway gateway = mock(PushGateway.class);
			when(gateway.send(anyList())).thenAnswer(invocation -> {
				List<PushMessage> messages = invocation.getArgument(0);
				SENT.addAll(messages);
				Set<String> tokens = new HashSet<>();
				messages.forEach(message -> tokens.add(message.token()));
				return tokens;
			});
			return gateway;
		}
	}

	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private PushTokenRepository tokens;
	@Autowired
	private NotificationService notifications;
	@Autowired
	private NotificationDeliveryService delivery;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;

	@BeforeEach
	void clean() {
		SENT.clear();
		jdbc.update("update notifications set pushed_at = now() where pushed_at is null");
	}

	@Test
	void daytimeNonChatNotificationsArePushedOnTheNextRunAndOnlyOnce() {
		User recipient = withToken("day");
		User actor = user("day-actor");
		long follow = create(recipient, actor, NotificationTypes.FOLLOW);
		long request = create(recipient, actor, NotificationTypes.MESSAGE_REQUEST);
		assertThat(deliverAfter(follow)).isNull();
		assertThat(deliverAfter(request)).isNull();

		delivery.deliverDue();

		assertThat(SENT).extracting(message -> message.data().get("notificationId"))
				.containsExactlyInAnyOrder(follow, request);
		assertThat(pushed(follow)).isTrue();
		assertThat(pushed(request)).isTrue();
		delivery.deliverDue();
		assertThat(SENT).as("a pushed row is not sent again").hasSize(2);
	}

	@Test
	void aQuietHoursRowWaitsUntilItsMorningAndThenGoesOut() {
		User recipient = withToken("held");
		User actor = user("held-actor");
		long due = create(recipient, actor, NotificationTypes.FOLLOW);
		long later = create(recipient, actor, NotificationTypes.FOLLOW);
		holdUntil(due, NOW.minus(Duration.ofHours(4)));
		holdUntil(later, NOW.plus(Duration.ofHours(20)));

		delivery.deliverDue();

		assertThat(SENT).extracting(message -> message.data().get("notificationId")).containsExactly(due);
		assertThat(pushed(due)).isTrue();
		assertThat(pushed(later)).isFalse();
	}

	@Test
	void daytimeNonChatRespectsThePushSwitch() {
		User recipient = withToken("day-off");
		recipient.setPushEnabled(false);
		users.saveAndFlush(recipient);
		long follow = create(recipient, user("day-off-actor"), NotificationTypes.FOLLOW);

		delivery.deliverDue();

		assertThat(SENT).isEmpty();
		assertThat(pushed(follow)).isFalse();
	}

	@Test
	void aChatPushIsDroppedForSomeoneWhoLeftTheRoomButTheInAppRowStays() {
		User recipient = withToken("left");
		User sender = user("left-sender");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		ChatRoomMember member = members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		long chat = chat(recipient, sender, room, NotificationTypes.CHAT);
		long mention = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);
		member.leave(NOW);
		members.saveAndFlush(member);

		delivery.deliverDue();

		assertThat(SENT).isEmpty();
		assertThat(pushed(chat)).isFalse();
		assertThat(pushed(mention)).isFalse();
		assertThat(jdbc.queryForObject("select count(*) from notifications where id in (?, ?)", Long.class, chat, mention))
				.isEqualTo(2);
	}

	private long chat(User recipient, User actor, ChatRoom room, String type) {
		return notifications.create(new CreateNotificationCommand(
				recipient.getId(), type, actor.getId(), "CHAT_ROOM", room.getId(), "/chats/" + room.getId(),
				"{\"roomId\":" + room.getId() + "}", "chat:" + room.getId())).getId();
	}

	private long create(User recipient, User actor, String type) {
		return notifications.create(new CreateNotificationCommand(
				recipient.getId(), type, actor.getId(), "USER", actor.getId(), "/u/" + actor.getUsername(), null, null)).getId();
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private User withToken(String prefix) {
		User user = user(prefix);
		tokens.saveAndFlush(PushToken.register(user, "ExponentPushToken[" + prefix + System.nanoTime() + "]", NOW));
		return user;
	}

	private void holdUntil(long notificationId, Instant at) {
		jdbc.update("update notifications set deliver_after = ? where id = ?", Timestamp.from(at), notificationId);
	}

	private boolean pushed(long notificationId) {
		return jdbc.queryForObject("select pushed_at is not null from notifications where id = ?", Boolean.class, notificationId);
	}

	private Object deliverAfter(long notificationId) {
		return jdbc.queryForObject("select deliver_after from notifications where id = ?", Object.class, notificationId);
	}
}
