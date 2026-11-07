package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.user.AccountService;
import com.linker.backend.service.user.ChatService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Repeating the same request does not create a second notification: a 1:1 message resent with the same
 * clientMessageId and a follow sent twice each leave one row. (Team mention resends are covered in
 * {@code ChatTeamMentionIntegrationTest}; one push per row in {@code NotificationDeliveryIntegrationTest}.)
 */
@SpringBootTest
@Testcontainers
class NotificationDuplicateIntegrationTest {

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
	private ChatService chat;
	@Autowired
	private AccountService accounts;

	@Test
	void aDirectMessageResentWithTheSameClientIdNotifiesOnce() {
		User sender = user("dup-sender");
		User recipient = user("dup-recipient");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				sender.getId(), recipient.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		Map<String, Object> payload = new HashMap<>();
		payload.put("clientMessageId", UUID.randomUUID().toString());
		payload.put("text", "한 번만 알림");

		chat.sendMessage(sender.getId(), room.getId(), payload);
		chat.sendMessage(sender.getId(), room.getId(), payload);

		assertThat(count(recipient, NotificationTypes.CHAT)).isEqualTo(1);
	}

	@Test
	void followingTheSamePersonTwiceNotifiesOnce() {
		User follower = user("dup-follower");
		User target = user("dup-target");

		accounts.follow(principal(follower), target.getUsername());
		accounts.follow(principal(follower), target.getUsername());

		assertThat(count(target, NotificationTypes.FOLLOW)).isEqualTo(1);
	}

	private long count(User recipient, String type) {
		return jdbc.queryForObject("select count(*) from notifications where user_id = ? and notification_type = ?",
				Long.class, recipient.getId(), type);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private static AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(user.getId(), user.getUsername(), user.getUserType(), UserStatus.ACTIVE,
				null, false, false, true, 1L);
	}
}
