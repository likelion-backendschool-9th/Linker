package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.ChatService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Page 18: header bell realtime frame, chat notification copy, and one in-app row per chat room. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class NotificationRealtimeIntegrationTest {

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
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		// No push job during the test; delivery is covered elsewhere.
		registry.add("linker.notifications.delivery-delay-ms", () -> "3600000");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@LocalServerPort
	private int port;
	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private ChatService chat;
	@Autowired
	private com.linker.backend.service.user.NotificationService userNotifications;
	@Autowired
	private com.linker.backend.service.recruiter.NotificationService recruiterNotifications;
	@Autowired
	private com.linker.backend.service.admin.NotificationService adminNotifications;

	@Test
	void aChatMessageRingsTheBellLiveWithTheSenderAndAPreview() throws Exception {
		User sender = user("bell-sender", "보낸사람");
		User recipient = user("bell-recipient", null);
		ChatRoom room = direct(sender, recipient);
		StompSession socket = connect(recipient);
		List<String> bell = frames(socket, "/user/queue/notifications");

		send(sender, room, "  안녕하세요\n\n오늘 회의   몇 시죠?  ");

		waitUntil(() -> bell.stream().anyMatch(frame -> frame.contains("event=UPDATED")));
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(recipient)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].type").value("CHAT"))
				.andExpect(jsonPath("$.items[0].title").value("보낸사람님이 메시지를 보냈어요"))
				.andExpect(jsonPath("$.items[0].body").value("안녕하세요 오늘 회의 몇 시죠?"))
				.andExpect(jsonPath("$.items[0].targetUrl").value("/chats/" + room.getId()));
		socket.disconnect();
	}

	@Test
	void unreadChatNotificationsOfOneRoomStayOneRowAndAMentionKeepsItsOwn() throws Exception {
		User sender = user("bundle-sender", "묶음");
		User recipient = user("bundle-recipient", null);
		ChatRoom room = direct(sender, recipient);
		userNotifications.create(new CreateNotificationCommand(recipient.getId(), NotificationTypes.CHAT_MENTION,
				sender.getId(), "CHAT_ROOM", room.getId(), "/chats/" + room.getId(), null, "chat:" + room.getId()));

		send(sender, room, "첫 번째");
		send(sender, room, "두 번째");
		send(sender, room, "세 번째");

		assertThat(rows(recipient, "CHAT")).isEqualTo(1);
		assertThat(rows(recipient, "CHAT_MENTION")).isEqualTo(1);
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(recipient)))
				.andExpect(jsonPath("$.items[0].body").value("세 번째"));

		long read = jdbc.queryForObject("select id from notifications where user_id=? and notification_type='CHAT'",
				Long.class, recipient.getId());
		mockMvc.perform(patch("/api/v1/user/notifications/" + read + "/read").cookie(cookie(recipient)))
				.andExpect(status().isNoContent());
		send(sender, room, "읽은 뒤 새 메시지");

		// A message after the room was read starts a new row; the read one stays in the history.
		assertThat(rows(recipient, "CHAT")).isEqualTo(2);
	}

	@Test
	void aMessageRequestNamesTheSenderAndAnImageOnlyPreviewSaysPhoto() throws Exception {
		User sender = user("request-sender", "요청자");
		User target = user("request-target", null);
		mockMvc.perform(post("/api/v1/user/chat-rooms/direct").cookie(cookie(sender))
						.contentType("application/json")
						.content("{\"userId\":" + target.getId() + ",\"message\":\"처음 인사드려요\"}"))
				.andExpect(status().isOk());
		// Between 22:00 and 08:00 KST a non-chat row is held until morning and hidden from the list.
		// This test checks the wording, not quiet hours, so it must not depend on when CI runs.
		jdbc.update("update notifications set deliver_after = null where user_id = ?", target.getId());

		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(target)))
				.andExpect(jsonPath("$.items[0].type").value("MESSAGE_REQUEST"))
				.andExpect(jsonPath("$.items[0].title").value("요청자님이 메시지 요청을 보냈어요"))
				.andExpect(jsonPath("$.items[0].body").value("처음 인사드려요"));
	}

	@Test
	void aLongMessageIsCutAtThePreviewLimitByCodePoint() throws Exception {
		User sender = user("long-sender", "긴글");
		User recipient = user("long-recipient", null);
		ChatRoom room = direct(sender, recipient);
		String emoji = "😀";
		send(sender, room, emoji.repeat(PlanLimits.CHAT_NOTIFICATION_PREVIEW_MAX_CHARS + 5));

		String body = jdbc.queryForObject("select payload->>'body' from notifications where user_id=?",
				String.class, recipient.getId());
		assertThat(body).isEqualTo(emoji.repeat(PlanLimits.CHAT_NOTIFICATION_PREVIEW_MAX_CHARS) + "…");
	}

	@Test
	void readsAndEveryRoleServiceRingTheBell() throws Exception {
		User recipient = user("roles-recipient", null);
		StompSession socket = connect(recipient);
		List<String> bell = frames(socket, "/user/queue/notifications");

		for (var create : List.<java.util.function.Consumer<CreateNotificationCommand>>of(
				userNotifications::create, recruiterNotifications::create, adminNotifications::create)) {
			bell.clear();
			// Chat rows skip quiet hours, so the frame does not depend on the time the test runs.
			create.accept(command(recipient, NotificationTypes.CHAT));
			waitUntil(() -> !bell.isEmpty());
		}

		// Old rows without text show the push default instead of a type code.
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(recipient)))
				.andExpect(jsonPath("$.items[0].title").value("새 알림이 도착했어요"));

		bell.clear();
		mockMvc.perform(post("/api/v1/user/notifications/read-all").cookie(cookie(recipient)))
				.andExpect(status().isNoContent());
		waitUntil(() -> !bell.isEmpty());

		bell.clear();
		mockMvc.perform(post("/api/v1/user/notifications/read-all").cookie(cookie(recipient)))
				.andExpect(status().isNoContent());
		Thread.sleep(300);
		assertThat(bell).as("nothing changed, nothing to announce").isEmpty();
		socket.disconnect();
	}

	private CreateNotificationCommand command(User recipient, String type) {
		return new CreateNotificationCommand(recipient.getId(), type, null, null, null, null, null, null);
	}

	private long rows(User user, String type) {
		return jdbc.queryForObject("select count(*) from notifications where user_id=? and notification_type=?",
				Long.class, user.getId(), type);
	}

	private void send(User sender, ChatRoom room, String text) {
		chat.sendMessage(sender.getId(), room.getId(), Map.of("clientMessageId", UUID.randomUUID().toString(), "text", text));
	}

	private List<String> frames(StompSession session, String destination) throws InterruptedException {
		List<String> frames = new CopyOnWriteArrayList<>();
		session.subscribe(destination, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				frames.add(String.valueOf(payload));
			}
		});
		Thread.sleep(300);
		return frames;
	}

	private StompSession connect(User user) throws Exception {
		WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
		client.setMessageConverter(new JacksonJsonMessageConverter());
		WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
		handshake.add(HttpHeaders.COOKIE, "linker_session=" + sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
		return client.connectAsync("ws://127.0.0.1:" + port + "/ws", handshake, new StompSessionHandlerAdapter() {
		}).get(5, TimeUnit.SECONDS);
	}

	private void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
		while (System.nanoTime() < deadline) {
			if (condition.getAsBoolean()) {
				return;
			}
			Thread.sleep(50);
		}
		throw new AssertionError("timed out waiting for a notification frame");
	}

	private User user(String prefix, String displayName) {
		User user = User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER);
		user.completeOnboarding(Instant.now());
		User saved = users.saveAndFlush(user);
		if (displayName != null) {
			jdbc.update("update users set display_name=? where id=?", displayName, saved.getId());
		}
		return users.findById(saved.getId()).orElseThrow();
	}

	private ChatRoom direct(User first, User second) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(first.getId(), second.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
		members.saveAndFlush(ChatRoomMember.join(room, first.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, second.getId()));
		return room;
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
