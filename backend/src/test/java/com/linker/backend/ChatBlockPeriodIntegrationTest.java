package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.ChatService;
import com.linker.backend.service.user.ModerationService;
import com.linker.backend.support.TeamTestFixtures;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Blocked-period DMs stay out of the blocker's unread badge and notifications, during and after the
 * block, while team chat is exempt (Policy ch. 9 "Blocking", WBS P17 server item). The sender's own
 * view does not reveal the block.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatBlockPeriodIntegrationTest {

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
	private ChatService chat;
	@Autowired
	private ModerationService moderation;

	@Test
	void unreadBadgeLeavesOutClosedBlockPeriodsAndDropsActivelyBlockedRoomsButCountsTeamChat() throws Exception {
		User viewer = user("badge-viewer");
		User other = user("badge-other");
		User requester = user("badge-requester");
		ChatRoom direct = direct(other, viewer, DmStatus.ACCEPTED);
		Instant start = Instant.now().minus(Duration.ofDays(3));
		Instant end = Instant.now().minus(Duration.ofDays(1));
		text(direct, other, "차단 전", start.minus(Duration.ofHours(1)));
		text(direct, other, "차단 중", start.plus(Duration.ofHours(1)));
		text(direct, other, "해제 후", end.plus(Duration.ofHours(1)));
		ChatRoom team = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(team, viewer.getId()));
		members.saveAndFlush(ChatRoomMember.join(team, other.getId()));
		text(team, other, "팀 메시지", start.plus(Duration.ofHours(1)));
		ChatRoom request = direct(requester, viewer, DmStatus.REQUESTED);
		text(request, requester, "요청", Instant.now().minusSeconds(60));
		closedBlock(viewer, other, start, end);

		summary(viewer)
				.andExpect(jsonPath("$.TEAM").value(1))
				.andExpect(jsonPath("$.DIRECT").value(2))
				.andExpect(jsonPath("$.REQUEST").value(1))
				.andExpect(jsonPath("$.requestCount").value(1))
				.andExpect(jsonPath("$.total").value(4));

		moderation.block(viewer.getId(), other.getId());
		moderation.block(viewer.getId(), requester.getId());
		summary(viewer)
				.andExpect(jsonPath("$.TEAM").value(1))
				.andExpect(jsonPath("$.DIRECT").value(0))
				.andExpect(jsonPath("$.REQUEST").value(0))
				.andExpect(jsonPath("$.requestCount").value(0))
				.andExpect(jsonPath("$.total").value(1));
	}

	@Test
	void aBlockedSendersDirectMessageCreatesNoNotificationEvenAfterUnblockingButLaterOnesDo() {
		User viewer = user("notify-viewer");
		User sender = user("notify-sender");
		ChatRoom room = direct(sender, viewer, DmStatus.ACCEPTED);
		moderation.block(viewer.getId(), sender.getId());

		send(sender, room, "차단 중 메시지", Map.of());
		assertThat(chatNotifications(viewer, "CHAT")).isZero();

		moderation.unblock(viewer.getId(), sender.getId());
		assertThat(chatNotifications(viewer, "CHAT")).isZero();
		send(sender, room, "해제 후 메시지", Map.of());
		assertThat(chatNotifications(viewer, "CHAT")).isEqualTo(1);
		assertThat(chatNotifications(sender, "CHAT")).isZero();
	}

	@Test
	void teamMentionsStillNotifyABlockerBecauseTeamChatIsExempt() {
		User viewer = user("team-viewer");
		User sender = user("team-sender");
		long teamId = TeamTestFixtures.team(jdbc, sender.getId(), "차단 예외 팀", "ACTIVE");
		joinTeam(teamId, sender, "OWNER");
		joinTeam(teamId, viewer, "MEMBER");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(teamId));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, viewer.getId()));
		moderation.block(viewer.getId(), sender.getId());

		send(sender, room, "@확인 부탁해요", Map.of("mentionedUserIds", List.of(viewer.getId())));

		assertThat(chatNotifications(viewer, "CHAT_MENTION")).isEqualTo(1);
	}

	@Test
	void theSenderStillSeesAMessageTheBlockerCannotReadAsUnread() throws Exception {
		User viewer = user("unread-viewer");
		User sender = user("unread-sender");
		ChatRoom room = direct(sender, viewer, DmStatus.ACCEPTED);
		moderation.block(viewer.getId(), sender.getId());

		send(sender, room, "보이지 않는 메시지", Map.of());
		long messageId = jdbc.queryForObject(
				"select id from chat_messages where room_id = ? and body = ?", Long.class, room.getId(), "보이지 않는 메시지");

		assertThat(chat.currentTranscript(viewer.getId(), room.getId(), messageId)).isNull();
		assertThat(chat.currentTranscript(sender.getId(), room.getId(), messageId).unreadCount()).isEqualTo(1);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(sender)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].id").value(messageId))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1));
	}

	private org.springframework.test.web.servlet.ResultActions summary(User viewer) throws Exception {
		return mockMvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(cookie(viewer)))
				.andExpect(status().isOk());
	}

	private void send(User sender, ChatRoom room, String text, Map<String, Object> extra) {
		Map<String, Object> payload = new HashMap<>(extra);
		payload.put("clientMessageId", UUID.randomUUID().toString());
		payload.put("text", text);
		chat.sendMessage(sender.getId(), room.getId(), payload);
	}

	private long chatNotifications(User recipient, String type) {
		return jdbc.queryForObject(
				"select count(*) from notifications where user_id = ? and notification_type = ?",
				Long.class, recipient.getId(), type);
	}

	private ChatMessage text(ChatRoom room, User sender, String body, Instant createdAt) {
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, sender.getId(), body));
		jdbc.update("update chat_messages set created_at = ? where id = ?", Timestamp.from(createdAt), message.getId());
		return message;
	}

	private void closedBlock(User blocker, User blocked, Instant start, Instant end) {
		jdbc.update("""
				insert into user_blocks (blocker_id, blocked_id, unblocked_at, created_at, updated_at)
				values (?, ?, ?, ?, ?)
				""", blocker.getId(), blocked.getId(), Timestamp.from(end), Timestamp.from(start), Timestamp.from(start));
	}

	private void joinTeam(long teamId, User user, String role) {
		jdbc.update("""
				insert into team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)
				values (?,?,?,'MEMBER',now(),now(),now())
				""", teamId, user.getId(), role);
	}

	private ChatRoom direct(User requester, User recipient, DmStatus status) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(), recipient.getId(), status, RequestKind.GENERAL,
				status == DmStatus.REQUESTED ? Instant.now().plus(Duration.ofDays(30)) : null));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
