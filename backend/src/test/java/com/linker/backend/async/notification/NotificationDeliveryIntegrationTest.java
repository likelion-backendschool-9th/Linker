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
import com.linker.backend.repository.notification.NotificationRepository;
import com.linker.backend.repository.notification.PushTokenRepository;
import com.linker.backend.service.user.NotificationService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Chat push rules (Policy ch. 8): muted rooms get no chat push, a {@code @person} mention is pushed
 * even when muted and also during quiet hours, and notifications of one room go out as one push.
 * The fixed clock is 23:30 KST, inside quiet hours. Non-chat timing (POL-N-1) sets {@code deliver_after}
 * directly: a row made between 08:00 and 22:00 KST has none and goes out on the next run, a held row goes
 * out once its 08:00 has passed. A chat push also needs the recipient to still be in the room.
 */
@SpringBootTest
@Testcontainers
class NotificationDeliveryIntegrationTest {

	private static final Instant NOW = Instant.parse("2026-11-05T14:30:00Z");
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
		// keep the scheduled job out of the way: the tests call the delivery methods themselves
		registry.add("linker.notifications.delivery-delay-ms", () -> "3600000");
	}

	/** Records every message and reports every token as delivered. */
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
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private PushTokenRepository tokens;
	@Autowired
	private NotificationService notifications;
	@Autowired
	private NotificationRepository notificationRows;
	@Autowired
	private NotificationDeliveryService delivery;

	@BeforeEach
	void clean() {
		SENT.clear();
		// notifications from earlier tests must not leak into this one
		jdbc.update("update notifications set pushed_at = now() where pushed_at is null");
	}

	@Test
	void chatNotificationIsPushedOnceAndMarkedPushed() {
		User recipient = withToken("plain");
		User sender = user("sender");
		ChatRoom room = room(sender, recipient, false);
		long id = chat(recipient, sender, room, NotificationTypes.CHAT);

		delivery.deliverChat();

		assertThat(SENT).hasSize(1);
		assertThat(pushed(id)).isTrue();
		delivery.deliverChat();
		assertThat(SENT).as("a pushed row is not sent again").hasSize(1);
	}

	@Test
	void mutedRoomGetsNoChatPushButStillKeepsTheRow() {
		User recipient = withToken("muted");
		User sender = user("sender-m");
		ChatRoom room = room(sender, recipient, true);
		long id = chat(recipient, sender, room, NotificationTypes.CHAT);

		delivery.deliverChat();

		assertThat(SENT).isEmpty();
		assertThat(pushed(id)).isFalse();
		assertThat(jdbc.queryForObject("select count(*) from notifications where id = ?", Long.class, id)).isEqualTo(1);
	}

	@Test
	void mentionIsPushedEvenWhenTheRoomIsMuted() {
		User recipient = withToken("mention-muted");
		User sender = user("sender-mm");
		ChatRoom room = room(sender, recipient, true);
		long id = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);

		delivery.deliverChat();

		assertThat(SENT).hasSize(1);
		assertThat(pushed(id)).isTrue();
	}

	@Test
	void mentionStillRespectsThePushSwitch() {
		User recipient = withToken("mention-off");
		recipient.setPushEnabled(false);
		users.saveAndFlush(recipient);
		User sender = user("sender-off");
		ChatRoom room = room(sender, recipient, true);
		long id = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);

		delivery.deliverChat();

		assertThat(SENT).isEmpty();
		assertThat(pushed(id)).isFalse();
	}

	@Test
	void chatAndMentionSkipQuietHoursButOtherTypesAreHeld() {
		User recipient = user("quiet");
		User sender = user("sender-q");
		ChatRoom room = room(sender, recipient, false);

		long chat = chat(recipient, sender, room, NotificationTypes.CHAT);
		long mention = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);
		long follow = notifications.create(new CreateNotificationCommand(
				recipient.getId(), NotificationTypes.FOLLOW, sender.getId(), "USER", sender.getId(), "/u/x", null, null)).getId();

		assertThat(deliverAfter(chat)).isNull();
		assertThat(deliverAfter(mention)).isNull();
		assertThat(deliverAfter(follow)).isNotNull();
	}

	@Test
	void oneRoomIsOnePushAndEveryRowOfTheBundleIsMarkedPushed() {
		User recipient = withToken("bundle");
		User sender = user("sender-b");
		ChatRoom room = room(sender, recipient, false);
		long first = chat(recipient, sender, room, NotificationTypes.CHAT);
		long second = chat(recipient, sender, room, NotificationTypes.CHAT);
		long third = chat(recipient, sender, room, NotificationTypes.CHAT);

		delivery.deliverChat();

		assertThat(SENT).hasSize(1);
		assertThat(pushed(first)).isTrue();
		assertThat(pushed(second)).isTrue();
		assertThat(pushed(third)).isTrue();
		delivery.deliverChat();
		assertThat(SENT).as("covered rows must not come back as a second push").hasSize(1);
	}

	@Test
	void aMentionRepresentsItsRoomBundleEvenWhenNewerChatRowsExist() {
		User recipient = withToken("bundle-mention");
		User sender = user("sender-bm");
		ChatRoom room = room(sender, recipient, false);
		long before = chat(recipient, sender, room, NotificationTypes.CHAT);
		long mention = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);
		long after = chat(recipient, sender, room, NotificationTypes.CHAT);

		delivery.deliverChat();

		assertThat(SENT).hasSize(1);
		assertThat(SENT.get(0).data()).containsEntry("notificationId", mention);
		assertThat(pushed(before)).isTrue();
		assertThat(pushed(mention)).isTrue();
		assertThat(pushed(after)).isTrue();
	}

	@Test
	void differentRoomsAreNotBundledTogether() {
		User recipient = withToken("two-rooms");
		User sender = user("sender-tr");
		ChatRoom one = room(sender, recipient, false);
		ChatRoom two = room(sender, recipient, false);
		chat(recipient, sender, one, NotificationTypes.CHAT);
		chat(recipient, sender, two, NotificationTypes.CHAT);

		delivery.deliverChat();

		assertThat(SENT).hasSize(2);
	}

	@Test
	void pushTitleDefaultsToTheServiceNameAndBodyToTheGenericLine() {
		User recipient = withToken("copy");
		User sender = user("sender-c");
		chat(recipient, sender, room(sender, recipient, false), NotificationTypes.CHAT_MENTION);

		delivery.deliverChat();

		assertThat(SENT).hasSize(1);
		assertThat(SENT.get(0).title()).isEqualTo("Linker");
		assertThat(SENT.get(0).body()).isEqualTo("새 알림이 도착했어요");
	}

	@Test
	void usersWithoutAPushTokenAreNeverSelectedForDelivery() {
		User noToken = user("no-token");
		User sender = user("sender-nt");
		long id = chat(noToken, sender, room(sender, noToken, false), NotificationTypes.CHAT);

		assertThat(notificationRows.findDueChat(PageRequest.of(0, 500)))
				.extracting(row -> row.getId()).doesNotContain(id);
		delivery.deliverChat();
		assertThat(SENT).isEmpty();
		assertThat(jdbc.queryForObject("select count(*) from notifications where id = ?", Long.class, id))
				.as("the in-app row stays").isEqualTo(1);
	}

	@Test
	void daytimeNonChatRowsArePushedOnTheNextRunAndOnlyOnce() {
		User recipient = withToken("day");
		User actor = user("day-actor");
		long follow = daytime(nonChat(recipient, actor, NotificationTypes.FOLLOW));
		long request = daytime(nonChat(recipient, actor, NotificationTypes.MESSAGE_REQUEST));

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
		long due = holdUntil(nonChat(recipient, actor, NotificationTypes.FOLLOW), NOW.minus(Duration.ofHours(4)));
		long later = holdUntil(nonChat(recipient, actor, NotificationTypes.FOLLOW), NOW.plus(Duration.ofHours(20)));

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
		long follow = daytime(nonChat(recipient, user("day-off-actor"), NotificationTypes.FOLLOW));

		delivery.deliverDue();

		assertThat(SENT).isEmpty();
		assertThat(pushed(follow)).isFalse();
	}

	@Test
	void aChatPushIsDroppedForSomeoneWhoLeftTheRoomButTheInAppRowStays() {
		User recipient = withToken("left");
		User sender = user("left-sender");
		ChatRoom room = room(sender, recipient, false);
		long chat = chat(recipient, sender, room, NotificationTypes.CHAT);
		long mention = chat(recipient, sender, room, NotificationTypes.CHAT_MENTION);
		jdbc.update("update chat_room_members set left_at = now() where room_id = ? and user_id = ?",
				room.getId(), recipient.getId());

		delivery.deliverDue();

		assertThat(SENT).isEmpty();
		assertThat(pushed(chat)).isFalse();
		assertThat(pushed(mention)).isFalse();
		assertThat(jdbc.queryForObject("select count(*) from notifications where id in (?, ?)", Long.class, chat, mention))
				.isEqualTo(2);
	}

	// ---- fixtures --------------------------------------------------------------------

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private User withToken(String prefix) {
		User user = user(prefix);
		tokens.saveAndFlush(PushToken.register(user, "ExponentPushToken[" + prefix + System.nanoTime() + "]", NOW));
		return user;
	}

	private ChatRoom room(User sender, User recipient, boolean recipientMuted) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		ChatRoomMember member = members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		if (recipientMuted) {
			member.mute(true);
			members.saveAndFlush(member);
		}
		return room;
	}

	private long chat(User recipient, User actor, ChatRoom room, String type) {
		return notifications.create(new CreateNotificationCommand(
				recipient.getId(), type, actor.getId(), "CHAT_ROOM", room.getId(), "/chats/" + room.getId(),
				"{\"roomId\":" + room.getId() + "}", "chat:" + room.getId())).getId();
	}

	private long nonChat(User recipient, User actor, String type) {
		return notifications.create(new CreateNotificationCommand(
				recipient.getId(), type, actor.getId(), "USER", actor.getId(), "/user/" + actor.getUsername(), null, null)).getId();
	}

	/** What a row made between 08:00 and 22:00 KST looks like (see RoleNotificationServiceTest). */
	private long daytime(long notificationId) {
		jdbc.update("update notifications set deliver_after = null where id = ?", notificationId);
		return notificationId;
	}

	private long holdUntil(long notificationId, Instant at) {
		jdbc.update("update notifications set deliver_after = ? where id = ?", Timestamp.from(at), notificationId);
		return notificationId;
	}

	private boolean pushed(long notificationId) {
		return jdbc.queryForObject("select pushed_at is not null from notifications where id = ?", Boolean.class, notificationId);
	}

	private Object deliverAfter(long notificationId) {
		return jdbc.queryForObject("select deliver_after from notifications where id = ?", Object.class, notificationId);
	}
}
