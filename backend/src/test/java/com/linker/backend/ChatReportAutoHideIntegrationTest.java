package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.moderation.request.ReportActionRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Chat reports reaching {@link PlanLimits#REPORT_AUTO_HIDE_REPORTERS} distinct reporters hide the message
 * for everyone at once, and an operator dismissal of that case shows it again (Policy ch. 9).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class ChatReportAutoHideIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final String HIDDEN_COPY = "운영 정책에 따라 숨겨진 메시지예요";

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
	private ChatMessageRepository messages;
	@Autowired
	private com.linker.backend.service.admin.ModerationService adminModeration;

	@Test
	void theFifthReporterHidesTheMessageLiveAndADismissalShowsItAgain() throws Exception {
		User sender = user("auto-sender");
		User viewer = user("auto-viewer");
		List<User> reporters = reporters("auto-reporter");
		ChatRoom team = team(sender, viewer, reporters);
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "신고될 원문"));
		StompSession socket = connect(viewer);
		List<String> topic = frames(socket, "/topic/chat-rooms/" + team.getId());

		for (int i = 0; i < reporters.size() - 1; i++) {
			report(reporters.get(i), target).andExpect(status().isNoContent());
		}
		Thread.sleep(300);
		assertThat(visibility(target)).isEqualTo("VISIBLE");
		assertThat(topic).isEmpty();

		report(reporters.get(reporters.size() - 1), target).andExpect(status().isNoContent());

		assertThat(visibility(target)).isEqualTo("HIDDEN");
		assertThat(jdbc.queryForObject("select auto_hidden_at from report_cases where id = ?",
				Timestamp.class, caseId(target))).isNotNull();
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=EDIT") && frame.contains(HIDDEN_COPY)));
		assertThat(topic).noneMatch(frame -> frame.contains("신고될 원문"));
		assertThat(history(viewer, team)).contains(HIDDEN_COPY).doesNotContain("신고될 원문");
		report(user("auto-late"), target).andExpect(status().isNotFound());

		topic.clear();
		adminModeration.act(operator(), caseId(target), new ReportActionRequest("DISMISS", null));

		assertThat(visibility(target)).isEqualTo("VISIBLE");
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=EDIT") && frame.contains("신고될 원문")));
		assertThat(history(viewer, team)).contains("신고될 원문").doesNotContain(HIDDEN_COPY);
		socket.disconnect();
	}

	@Test
	void aDismissalUndoesOnlyTheHideAndKeepsTheSendersDeletion() throws Exception {
		User sender = user("undo-sender");
		List<User> reporters = reporters("undo-reporter");
		ChatRoom team = team(sender, null, reporters);
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "지워질 원문"));
		for (User reporter : reporters) {
			report(reporter, target).andExpect(status().isNoContent());
		}
		assertThat(visibility(target)).isEqualTo("HIDDEN");
		Instant deletedAt = Instant.parse("2026-11-07T00:00:00Z");
		jdbc.update("update chat_messages set deleted_at = ? where id = ?", Timestamp.from(deletedAt), target.getId());

		adminModeration.act(operator(), caseId(target), new ReportActionRequest("DISMISS", null));

		assertThat(visibility(target)).isEqualTo("VISIBLE");
		assertThat(jdbc.queryForObject("select deleted_at from chat_messages where id = ?",
				Timestamp.class, target.getId()).toInstant()).isEqualTo(deletedAt);
	}

	@Test
	void aDismissalBelowTheThresholdLeavesAnOperatorHiddenMessageAlone() throws Exception {
		User sender = user("below-sender");
		List<User> reporters = reporters("below-reporter");
		ChatRoom team = team(sender, null, reporters);
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "한 명만 신고"));
		report(reporters.get(0), target).andExpect(status().isNoContent());
		jdbc.update("update chat_messages set visibility = 'HIDDEN' where id = ?", target.getId());

		adminModeration.act(operator(), caseId(target), new ReportActionRequest("DISMISS", null));

		assertThat(visibility(target)).isEqualTo("HIDDEN");
	}

	private ResultActions report(User reporter, ChatMessage message) throws Exception {
		return mockMvc.perform(post("/api/v1/user/reports")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"targetType\":\"TEAM_MESSAGE\",\"targetId\":%d,\"reason\":\"ABUSE\"}".formatted(message.getId()))
				.cookie(cookie(reporter)));
	}

	private String visibility(ChatMessage message) {
		return jdbc.queryForObject("select visibility from chat_messages where id = ?", String.class, message.getId());
	}

	private long caseId(ChatMessage message) {
		return jdbc.queryForObject("select id from report_cases where target_type = 'TEAM_MESSAGE' and target_id = ?",
				Long.class, message.getId());
	}

	private String history(User user, ChatRoom room) throws Exception {
		return mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(user)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}

	private AuthenticatedUser operator() {
		User operator = user("auto-operator");
		jdbc.update("insert into admins (user_id, admin_role, created_at, updated_at) values (?, 'OPERATOR', now(), now())",
				operator.getId());
		return new AuthenticatedUser(operator.getId(), operator.getUsername(), UserType.DEVELOPER, UserStatus.ACTIVE,
				null, true, true, true, 1L);
	}

	private List<User> reporters(String prefix) {
		List<User> reporters = new ArrayList<>();
		for (int i = 0; i < PlanLimits.REPORT_AUTO_HIDE_REPORTERS; i++) {
			reporters.add(user(prefix + i));
		}
		return reporters;
	}

	private ChatRoom team(User sender, User viewer, List<User> reporters) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		if (viewer != null) {
			members.saveAndFlush(ChatRoomMember.join(room, viewer.getId()));
		}
		for (User reporter : reporters) {
			members.saveAndFlush(ChatRoomMember.join(room, reporter.getId()));
		}
		return room;
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	private StompSession connect(User user) throws Exception {
		WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
		client.setMessageConverter(new JacksonJsonMessageConverter());
		WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
		handshake.add(HttpHeaders.COOKIE, "linker_session=" + sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
		return client.connectAsync("ws://127.0.0.1:" + port + "/ws", handshake, new StompSessionHandlerAdapter() {
		}).get(5, TimeUnit.SECONDS);
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

	private void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
		while (System.nanoTime() < deadline) {
			if (condition.getAsBoolean()) {
				return;
			}
			Thread.sleep(50);
		}
		throw new AssertionError("timed out waiting for a chat frame");
	}
}
