package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.chat.request.EditChatMessageRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.entity.chat.MessageType;
import com.linker.backend.entity.chat.MessageVisibility;
import com.linker.backend.entity.chat.RequestKind;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.PublicAuthService;
import com.linker.backend.service.user.UserChatService;
import com.linker.backend.service.user.UserModerationService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class ChatRoomBasicsIntegrationTest {

	private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");
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

	@org.springframework.boot.test.context.TestConfiguration
	static class FixedClock {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
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
	private PublicAuthService sessions;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private ChatMessageRepository messages;
	@Autowired
	private UserChatService chat;
	@Autowired
	private UserModerationService moderation;
	@Autowired
	private PlatformTransactionManager transactions;
	@Autowired
	private SimpMessagingTemplate template;

	@Test
	void authorCanEditInsideTheWindowAndOthersCannot() throws Exception {
		User author = user("edit");
		User other = user("edit-other");
		User operator = user("edit-operator");
		jdbc.update(
				"insert into admins (user_id, admin_role, created_at, updated_at) values (?, 'OPERATOR', now(), now())",
				operator.getId()
		);
		ChatRoom room = direct(author, other, DmStatus.ACCEPTED);
		members.saveAndFlush(ChatRoomMember.join(room, operator.getId()));
		ChatMessage mine = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "원문"));
		ChatMessage older = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "오래됨"));
		ChatMessage newest = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "최근"));
		stamp(mine.getId(), NOW.minus(Duration.ofHours(4)));
		stamp(older.getId(), NOW.minus(Duration.ofHours(3)));
		stamp(newest.getId(), NOW.minus(Duration.ofHours(2)));
		ChatRoom later = direct(author, user("edit-later"), DmStatus.ACCEPTED);
		ChatMessage laterMessage = messages.saveAndFlush(ChatMessage.text(later, author.getId(), "더 최근"));
		stamp(laterMessage.getId(), NOW.minus(Duration.ofHours(1)));
		Instant sortAt = NOW.minus(Duration.ofHours(2));
		jdbc.update("update chat_rooms set last_message_at = ? where id = ?", Timestamp.from(sortAt), room.getId());

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(author)))
				.andExpect(jsonPath("$.items[0].id").value(later.getId()))
				.andExpect(jsonPath("$.items[1].id").value(room.getId()))
				.andExpect(jsonPath("$.items[1].lastMessage.text").value("최근"));
		mockMvc.perform(patch(messagePath(room, older)).contentType(MediaType.APPLICATION_JSON).content(text("고침")).cookie(cookie(author)))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select last_message_at from chat_rooms where id = ?", Timestamp.class, room.getId()).toInstant())
				.isEqualTo(sortAt);
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(author)))
				.andExpect(jsonPath("$.items[0].id").value(later.getId()))
				.andExpect(jsonPath("$.items[1].id").value(room.getId()))
				.andExpect(jsonPath("$.items[1].lastMessage.text").value("최근"));

		stamp(mine.getId(), NOW.minus(Duration.ofHours(PlanLimits.CHAT_EDIT_WITHIN_HOURS)));
		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON).content(text(" a ")).cookie(cookie(author)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value(" a "))
				.andExpect(jsonPath("$.editedAt").exists())
				.andExpect(jsonPath("$.payload").value(org.hamcrest.Matchers.nullValue()));
		assertThat(jdbc.queryForObject("select body from chat_messages where id = ?", String.class, mine.getId())).isEqualTo(" a ");

		ChatMessage justInside = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "직전"));
		stamp(justInside.getId(), NOW.minus(Duration.ofHours(PlanLimits.CHAT_EDIT_WITHIN_HOURS)).plusSeconds(1));
		mockMvc.perform(patch(messagePath(room, justInside)).contentType(MediaType.APPLICATION_JSON).content(text("아직")).cookie(cookie(author)))
				.andExpect(status().isOk());

		ChatMessage expired = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "만료"));
		stamp(expired.getId(), NOW.minus(Duration.ofHours(PlanLimits.CHAT_EDIT_WITHIN_HOURS)).minus(1, ChronoUnit.MICROS));
		mockMvc.perform(patch(messagePath(room, expired)).contentType(MediaType.APPLICATION_JSON).content(text("늦음")).cookie(cookie(author)))
				.andExpect(status().isConflict());
		assertThat(jdbc.queryForObject("select body from chat_messages where id = ?", String.class, expired.getId())).isEqualTo("만료");

		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON).content(text("   ")).cookie(cookie(author)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON)
						.content(text("가".repeat(PlanLimits.CHAT_MESSAGE_MAX_CHARS + 1))).cookie(cookie(author)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON).content(text("타인")).cookie(cookie(other)))
				.andExpect(status().isForbidden());
		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON).content(text("운영")).cookie(cookie(operator)))
				.andExpect(status().isForbidden());
		assertThat(jdbc.queryForObject("select body from chat_messages where id = ?", String.class, mine.getId())).isEqualTo(" a ");

		ChatMessage foreign = messages.saveAndFlush(ChatMessage.text(later, author.getId(), "다른 방"));
		mockMvc.perform(patch(messagePath(room, foreign)).contentType(MediaType.APPLICATION_JSON).content(text("이동")).cookie(cookie(author)))
				.andExpect(status().isBadRequest());
		User left = user("edit-left");
		ChatRoom leftRoom = direct(author, left, DmStatus.ACCEPTED);
		ChatMessage leftMessage = messages.saveAndFlush(ChatMessage.text(leftRoom, left.getId(), "나감"));
		ChatRoomMember membership = members.findActive(leftRoom.getId(), left.getId()).orElseThrow();
		membership.leave(NOW);
		members.saveAndFlush(membership);
		mockMvc.perform(patch(messagePath(leftRoom, leftMessage)).contentType(MediaType.APPLICATION_JSON).content(text("불가")).cookie(cookie(left)))
				.andExpect(status().isNotFound());
		User suspended = user("edit-suspended");
		ChatRoom suspendedRoom = direct(suspended, other, DmStatus.ACCEPTED);
		ChatMessage suspendedMessage = messages.saveAndFlush(ChatMessage.text(suspendedRoom, suspended.getId(), "정지"));
		suspended.suspendUntil(NOW.plus(Duration.ofHours(1)));
		users.saveAndFlush(suspended);
		mockMvc.perform(patch(messagePath(suspendedRoom, suspendedMessage)).contentType(MediaType.APPLICATION_JSON).content(text("정지 수정")).cookie(cookie(suspended)))
				.andExpect(status().isForbidden());

		ChatMessage hidden = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "숨김 원문"));
		hidden.hide();
		messages.saveAndFlush(hidden);
		mockMvc.perform(patch(messagePath(room, hidden)).contentType(MediaType.APPLICATION_JSON).content(text("되살림")).cookie(cookie(author)))
				.andExpect(status().isConflict());
		assertThat(history(author, room.getId())).doesNotContain("숨김 원문").doesNotContain("되살림");
	}

	@Test
	void authorDeleteUsesThePlaceholderAndDoesNotReplay() throws Exception {
		User author = user("delete");
		User other = user("delete-other");
		ChatRoom room = direct(author, other, DmStatus.ACCEPTED);
		ChatMessage mine = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "지울 원문"));
		StompSession authorSocket = connect(author);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		mockMvc.perform(delete(messagePath(room, mine)).cookie(cookie(author))).andExpect(status().isNoContent());
		mockMvc.perform(delete(messagePath(room, mine)).cookie(cookie(author))).andExpect(status().isNoContent());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=DELETE")));
		Thread.sleep(300);
		assertThat(topic).hasSize(1);
		assertThat(topic.get(0)).contains("삭제된 메시지입니다").doesNotContain("지울 원문");
		assertThat(history(author, room.getId())).contains("삭제된 메시지입니다").doesNotContain("지울 원문");
		assertThat(history(other, room.getId())).doesNotContain("지울 원문");
		mockMvc.perform(patch(messagePath(room, mine)).contentType(MediaType.APPLICATION_JSON).content(text("부활")).cookie(cookie(author)))
				.andExpect(status().isConflict());
		assertThat(history(author, room.getId())).doesNotContain("부활").doesNotContain("지울 원문");

		mockMvc.perform(delete(messagePath(room, mine)).cookie(cookie(other))).andExpect(status().isForbidden());
		ChatMessage system = messages.saveAndFlush(ChatMessage.system(room, "시스템"));
		ChatMessage pullRequest = messages.saveAndFlush(ChatMessage.create(room, null, MessageType.PR_EVENT, "풀 리퀘스트", MessageVisibility.VISIBLE));
		mockMvc.perform(delete(messagePath(room, system)).cookie(cookie(author))).andExpect(status().isForbidden());
		mockMvc.perform(delete(messagePath(room, pullRequest)).cookie(cookie(author))).andExpect(status().isForbidden());
		ChatMessage hidden = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "숨긴 뒤 삭제"));
		hidden.hide();
		messages.saveAndFlush(hidden);
		mockMvc.perform(delete(messagePath(room, hidden)).cookie(cookie(author))).andExpect(status().isConflict());
		assertThat(history(author, room.getId())).contains("운영 정책에 따라 숨겨진 메시지예요").doesNotContain("숨긴 뒤 삭제");
		authorSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void teamUnreadMembersFollowTheReadPointerAndDirectDoesNot() throws Exception {
		User author = user("unread");
		User reader = user("unread-read");
		User pending = user("unread-pending");
		ChatRoom team = team(author, reader, pending);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(team, author.getId(), "팀 메시지"));
		ChatRoomMember readerMember = members.findActive(team.getId(), reader.getId()).orElseThrow();
		readerMember.readUntil(message.getId());
		members.saveAndFlush(readerMember);
		mockMvc.perform(get(messagePath(team, message) + "/unread-members").cookie(cookie(author)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].login").value(pending.getUsername()))
				.andExpect(jsonPath("$.items[0].id").value(pending.getId()));
		StompSession pendingSocket = connect(pending);
		List<String> topic = frames(pendingSocket, "/topic/chat-rooms/" + team.getId());
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + team.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + message.getId() + "}")
						.cookie(cookie(pending)))
				.andExpect(status().isNoContent());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=READ") && frame.contains("messageId=" + message.getId())));
		assertThat(topic.get(0)).doesNotContain("팀 메시지");
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + team.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + message.getId() + "}")
						.cookie(cookie(pending)))
				.andExpect(status().isNoContent());
		Thread.sleep(300);
		assertThat(topic).hasSize(1);
		mockMvc.perform(get(messagePath(team, message) + "/unread-members").cookie(cookie(author)))
				.andExpect(jsonPath("$.items.length()").value(0));

		ChatRoom direct = direct(author, pending, DmStatus.ACCEPTED);
		ChatMessage directMessage = messages.saveAndFlush(ChatMessage.text(direct, author.getId(), "1:1 원문"));
		mockMvc.perform(get(messagePath(direct, directMessage) + "/unread-members").cookie(cookie(author)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("1:1 채팅에서는 참여자 목록을 보여 주지 않아요"));
		String denied = mockMvc.perform(get(messagePath(direct, directMessage) + "/unread-members").cookie(cookie(author)))
				.andReturn().getResponse().getContentAsString();
		assertThat(denied).doesNotContain(pending.getUsername());
		pendingSocket.disconnect();
	}

	@Test
	void muteChangesOnlyTheCallerAndLeavesUnreadAlone() throws Exception {
		User author = user("mute");
		User other = user("mute-other");
		ChatRoom room = direct(author, other, DmStatus.ACCEPTED);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "알림"));
		String before = history(author, room.getId());
		StompSession authorSocket = connect(author);
		StompSession otherSocket = connect(other);
		List<String> mine = frames(authorSocket, "/user/queue/chat-rooms");
		List<String> theirs = frames(otherSocket, "/user/queue/chat-rooms");
		mockMvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/notification")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"muted\":true}")
						.cookie(cookie(author)))
				.andExpect(status().isNoContent());
		waitUntil(() -> mine.stream().anyMatch(frame -> frame.contains("CHAT_ROOMS_CHANGED")));
		Thread.sleep(300);
		assertThat(theirs).isEmpty();
		assertThat(members.findActive(room.getId(), author.getId()).orElseThrow().isMuted()).isTrue();
		assertThat(members.findActive(room.getId(), other.getId()).orElseThrow().isMuted()).isFalse();
		int events = mine.size();
		mockMvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/notification")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"muted\":true}")
						.cookie(cookie(author)))
				.andExpect(status().isNoContent());
		Thread.sleep(300);
		assertThat(mine).hasSize(events);
		assertThat(history(author, room.getId())).isEqualTo(before);
		assertThat(history(author, room.getId())).contains("알림");
		mockMvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/notification")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"muted\":true}")
						.cookie(cookie(user("mute-outsider"))))
				.andExpect(status().isNotFound());
		assertThat(message.getId()).isNotNull();
		authorSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void transcriptEventsWaitForCommitAndTheGuardStaysClosed() throws Exception {
		User author = user("guard");
		User other = user("guard-other");
		ChatRoom room = direct(author, other, DmStatus.ACCEPTED);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "실시간 원문"));
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		template.convertAndSend("/topic/chat-rooms/" + room.getId(), (Object) Map.of("event", "NOPE", "message", Map.of("id", message.getId(), "roomId", room.getId(), "text", "새지 않음")));
		Thread.sleep(300);
		assertThat(topic).isEmpty();

		new TransactionTemplate(transactions).executeWithoutResult(status -> {
			chat.edit(principal(author), room.getId(), message.getId(), new EditChatMessageRequest("롤백 수정"));
			status.setRollbackOnly();
		});
		Thread.sleep(300);
		assertThat(topic).isEmpty();
		assertThat(jdbc.queryForObject("select edited_at from chat_messages where id = ?", Timestamp.class, message.getId())).isNull();
		assertThat(jdbc.queryForObject("select body from chat_messages where id = ?", String.class, message.getId())).isEqualTo("실시간 원문");

		mockMvc.perform(patch(messagePath(room, message)).contentType(MediaType.APPLICATION_JSON).content(text("반영")).cookie(cookie(author)))
				.andExpect(status().isOk());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=EDIT") && frame.contains("반영")));
		assertThat(topic.get(0)).doesNotContain("실시간 원문");

		moderation.block(other.getId(), author.getId());
		Instant blockedAt = jdbc.queryForObject(
				"select created_at from user_blocks where blocker_id = ? and blocked_id = ?",
				Timestamp.class,
				other.getId(),
				author.getId()
		).toInstant();
		stamp(message.getId(), blockedAt);
		mockMvc.perform(patch(messagePath(room, message)).contentType(MediaType.APPLICATION_JSON).content(text("차단 후")).cookie(cookie(author)))
				.andExpect(status().isOk());
		Thread.sleep(300);
		assertThat(String.join("\n", topic)).doesNotContain("차단 후");
		assertThat(history(other, room.getId())).doesNotContain("차단 후").doesNotContain("반영").doesNotContain("실시간 원문");

		User leaver = user("guard-leave");
		ChatRoom leaveRoom = direct(author, leaver, DmStatus.ACCEPTED);
		ChatMessage leaveMessage = messages.saveAndFlush(ChatMessage.text(leaveRoom, author.getId(), "나가기 전"));
		StompSession leaveSocket = connect(leaver);
		List<String> leaveTopic = frames(leaveSocket, "/topic/chat-rooms/" + leaveRoom.getId());
		ChatRoomMember membership = members.findActive(leaveRoom.getId(), leaver.getId()).orElseThrow();
		membership.leave(NOW);
		members.saveAndFlush(membership);
		mockMvc.perform(patch(messagePath(leaveRoom, leaveMessage)).contentType(MediaType.APPLICATION_JSON).content(text("나간 뒤")).cookie(cookie(author)))
				.andExpect(status().isOk());
		Thread.sleep(300);
		assertThat(String.join("\n", leaveTopic)).doesNotContain("나간 뒤");
		leaveSocket.disconnect();

		ExecutorService pool = Executors.newFixedThreadPool(2);
		User racer = user("race");
		ChatRoom raceRoom = direct(racer, user("race-other"), DmStatus.ACCEPTED);
		ChatMessage raced = messages.saveAndFlush(ChatMessage.text(raceRoom, racer.getId(), "경쟁 원문"));
		CountDownLatch start = new CountDownLatch(1);
		Future<?> edit = pool.submit(() -> {
			start.await();
			try {
				chat.edit(principal(racer), raceRoom.getId(), raced.getId(), new EditChatMessageRequest("편집본"));
			}
			catch (ApiException exception) {
				if (exception.getStatus() != 409) {
					throw exception;
				}
			}
			return null;
		});
		Future<?> delete = pool.submit(() -> {
			start.await();
			chat.deleteMessage(principal(racer), raceRoom.getId(), raced.getId());
			return null;
		});
		start.countDown();
		edit.get(5, TimeUnit.SECONDS);
		delete.get(5, TimeUnit.SECONDS);
		pool.shutdown();
		assertThat(jdbc.queryForObject("select deleted_at from chat_messages where id = ?", Timestamp.class, raced.getId())).isNotNull();
		org.junit.jupiter.api.Assertions.assertThrows(ApiException.class, () -> chat.edit(
				principal(racer), raceRoom.getId(), raced.getId(), new EditChatMessageRequest("부활")
		));
		assertThat(history(racer, raceRoom.getId())).contains("삭제된 메시지입니다").doesNotContain("편집본").doesNotContain("경쟁 원문").doesNotContain("부활");
		otherSocket.disconnect();
	}

	@Test
	void delayedSnapshotCannotRestoreDeletedOrOlderText() throws Exception {
		User author = user("stale");
		User other = user("stale-other");
		ChatRoom room = direct(author, other, DmStatus.ACCEPTED);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "현재"));
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		mockMvc.perform(patch(messagePath(room, message)).contentType(MediaType.APPLICATION_JSON).content(text("최신")).cookie(cookie(author)))
				.andExpect(status().isOk());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("최신")));
		int edited = topic.size();
		stale(room, message, "EDIT", "과거 스냅샷");
		stale(room, message, "MESSAGE", "과거 메시지");
		waitUntil(() -> topic.size() >= edited + 2);
		assertThat(String.join("\n", topic.subList(edited, topic.size()))).doesNotContain("과거 스냅샷").doesNotContain("과거 메시지").contains("최신");

		mockMvc.perform(delete(messagePath(room, message)).cookie(cookie(author))).andExpect(status().isNoContent());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("삭제된 메시지입니다")));
		int deleted = topic.size();
		stale(room, message, "EDIT", "삭제 후 원문");
		stale(room, message, "MESSAGE", "삭제 후 메시지");
		waitUntil(() -> topic.size() >= deleted + 2);
		assertThat(String.join("\n", topic.subList(deleted, topic.size())))
				.doesNotContain("삭제 후 원문").doesNotContain("삭제 후 메시지").doesNotContain("최신")
				.contains("삭제된 메시지입니다");

		ChatMessage hidden = messages.saveAndFlush(ChatMessage.text(room, author.getId(), "신고 원문"));
		hidden.hide();
		messages.saveAndFlush(hidden);
		int hiddenAt = topic.size();
		stale(room, hidden, "EDIT", "신고 원문");
		stale(room, hidden, "MESSAGE", "신고 원문");
		waitUntil(() -> topic.subList(hiddenAt, topic.size()).stream().anyMatch(frame -> frame.contains("운영 정책에 따라 숨겨진 메시지예요")));
		assertThat(String.join("\n", topic.subList(hiddenAt, topic.size()))).doesNotContain("신고 원문");
		otherSocket.disconnect();
	}

	@Test
	void suspendedMemberCanReadUnreadMembersButCannotWrite() throws Exception {
		User author = user("suspended-read");
		User suspended = user("suspended-member");
		User outsider = user("suspended-outsider");
		ChatRoom team = team(author, suspended);
		ChatMessage message = messages.saveAndFlush(ChatMessage.text(team, author.getId(), "정지 조회"));
		suspended.suspendUntil(NOW.plus(Duration.ofHours(1)));
		users.saveAndFlush(suspended);
		mockMvc.perform(get(messagePath(team, message) + "/unread-members").cookie(cookie(suspended)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].login").value(suspended.getUsername()));
		mockMvc.perform(patch(messagePath(team, message)).contentType(MediaType.APPLICATION_JSON).content(text("쓰기")).cookie(cookie(suspended)))
				.andExpect(status().isForbidden());
		mockMvc.perform(delete(messagePath(team, message)).cookie(cookie(suspended))).andExpect(status().isForbidden());
		mockMvc.perform(patch("/api/v1/user/chat-rooms/" + team.getId() + "/notification")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"muted\":true}")
						.cookie(cookie(suspended)))
				.andExpect(status().isForbidden());
		mockMvc.perform(get(messagePath(team, message) + "/unread-members").cookie(cookie(outsider)))
				.andExpect(status().isNotFound());
		ChatRoom elsewhere = team(author, user("suspended-elsewhere"));
		ChatMessage foreign = messages.saveAndFlush(ChatMessage.text(elsewhere, author.getId(), "다른 팀"));
		mockMvc.perform(get(messagePath(team, foreign) + "/unread-members").cookie(cookie(suspended)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("메시지 위치를 확인해 주세요"));
		User removed = user("suspended-deleted");
		ChatRoom removedRoom = team(author, removed);
		ChatMessage removedMessage = messages.saveAndFlush(ChatMessage.text(removedRoom, author.getId(), "삭제 계정"));
		Cookie removedCookie = cookie(removed);
		removed.markDeleted(NOW);
		users.saveAndFlush(removed);
		String denied = mockMvc.perform(get(messagePath(removedRoom, removedMessage) + "/unread-members").cookie(removedCookie))
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();
		assertThat(denied).doesNotContain(author.getUsername());
		ApiException rejected = org.junit.jupiter.api.Assertions.assertThrows(ApiException.class, () -> chat.unreadMembers(
				principal(removed),
				removedRoom.getId(),
				removedMessage.getId()
		));
		assertThat(rejected.getStatus()).isEqualTo(403);
	}

	@Test
	void directAndRequestRoomInfoUsesRealRows() throws Exception {
		User mina = named("미나");
		User doyun = named("도윤");
		ChatRoom accepted = direct(mina, doyun, DmStatus.ACCEPTED);
		long firstId = Math.min(mina.getId(), doyun.getId());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + accepted.getId()).cookie(cookie(mina)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(accepted.getId()))
				.andExpect(jsonPath("$.kind").value("DIRECT"))
				.andExpect(jsonPath("$.title").value("도윤"))
				.andExpect(jsonPath("$.requestDirection").value(nullValue()))
				.andExpect(jsonPath("$.muted").value(false))
				.andExpect(jsonPath("$.team").value(nullValue()))
				.andExpect(jsonPath("$.historyLimitDays").value(nullValue()))
				.andExpect(jsonPath("$.members.length()").value(2))
				.andExpect(jsonPath("$.members[0].id").value(firstId));

		ChatRoomMember seat = members.findActive(accepted.getId(), mina.getId()).orElseThrow();
		seat.mute(true);
		members.saveAndFlush(seat);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + accepted.getId()).cookie(cookie(mina)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.muted").value(true))
				.andExpect(jsonPath("$.title").value("도윤"));

		doyun.markDeleted(NOW);
		users.saveAndFlush(doyun);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + accepted.getId()).cookie(cookie(mina)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("탈퇴한 사용자"))
				.andExpect(jsonPath("$.members[?(@.id == " + doyun.getId() + ")].name", contains("탈퇴한 사용자")))
				.andExpect(jsonPath("$.members[?(@.id == " + doyun.getId() + ")].login", contains(nullValue())))
				.andExpect(jsonPath("$.members[?(@.id == " + doyun.getId() + ")].avatarUrl", contains(nullValue())));

		User sender = named("보내는사람");
		User receiver = named("받는사람");
		ChatRoom request = direct(sender, receiver, DmStatus.REQUESTED);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + request.getId()).cookie(cookie(sender)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.requestDirection").value("SENT"))
				.andExpect(jsonPath("$.title").value("받는사람"))
				.andExpect(jsonPath("$.team").value(nullValue()));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + request.getId()).cookie(cookie(receiver)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.requestDirection").value("RECEIVED"))
				.andExpect(jsonPath("$.title").value("보내는사람"));

		jdbc.update(
				"update chat_rooms set request_expires_at = ? where id = ?",
				Timestamp.from(NOW.minusSeconds(1)),
				request.getId()
		);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + request.getId()).cookie(cookie(receiver)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"));

		ChatRoom rejected = direct(named("거절한사람"), named("거절받은사람"), DmStatus.REJECTED);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + rejected.getId()).cookie(cookie(users.findById(rejected.getRequesterId()).orElseThrow())))
				.andExpect(status().isNotFound());

		User outsider = user("outsider");
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + accepted.getId()).cookie(cookie(outsider)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("채팅방을 찾지 못했어요"));

		User teamMember = named("팀원");
		ChatRoom teamRoom = team(teamMember, named("다른팀원"));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + teamRoom.getId()).cookie(cookie(teamMember)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("채팅방을 찾지 못했어요"))
				.andExpect(jsonPath("$.kind").doesNotExist())
				.andExpect(jsonPath("$.team").doesNotExist());

		User blocker = named("차단한사람");
		User blocked = named("차단된사람");
		ChatRoom blockedRoom = direct(blocker, blocked, DmStatus.ACCEPTED);
		moderation.block(blocker.getId(), blocked.getId());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + blockedRoom.getId()).cookie(cookie(blocker)))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + blockedRoom.getId()).cookie(cookie(blocked)))
				.andExpect(status().isNotFound());

		User hidden = named("숨긴사람");
		User visible = named("보이는사람");
		ChatRoom hiddenRoom = direct(hidden, visible, DmStatus.ACCEPTED);
		ChatRoomMember hiddenSeat = members.findActive(hiddenRoom.getId(), hidden.getId()).orElseThrow();
		hiddenSeat.hide(NOW);
		members.saveAndFlush(hiddenSeat);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + hiddenRoom.getId()).cookie(cookie(hidden)))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + hiddenRoom.getId()).cookie(cookie(visible)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("숨긴사람"));

		User leaver = named("나간사람");
		User stayer = named("남은사람");
		ChatRoom leftRoom = direct(leaver, stayer, DmStatus.ACCEPTED);
		ChatRoomMember leftSeat = members.findActive(leftRoom.getId(), leaver.getId()).orElseThrow();
		leftSeat.leave(NOW);
		members.saveAndFlush(leftSeat);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + leftRoom.getId()).cookie(cookie(leaver)))
				.andExpect(status().isNotFound());
	}

	@Test
	void openApiDocumentsRoomBasics() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages/{messageId}'].patch.operationId").value("editChatMessage"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages/{messageId}'].patch.tags[0]").value("p17-chat-room"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages/{messageId}'].delete.operationId").value("deleteChatMessage"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages/{messageId}/unread-members'].get.operationId").value("listUnreadChatMembers"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/notification'].patch.operationId").value("updateChatNotification"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}'].get.operationId").value("getChatRoom"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}'].get.tags[0]").value("p17-chat-room"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/members/me'].delete").doesNotExist());
	}

	private void stale(ChatRoom room, ChatMessage message, String event, String text) {
		template.convertAndSend("/topic/chat-rooms/" + room.getId(), (Object) Map.of(
				"event", event,
				"message", Map.of(
						"id", message.getId(),
						"roomId", room.getId(),
						"text", text,
						"visibility", "VISIBLE"
				)
		));
	}

	private static String messagePath(ChatRoom room, ChatMessage message) {
		return "/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + message.getId();
	}

	private static String text(String value) {
		return "{\"text\":\"" + value + "\"}";
	}

	private AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(
				user.getId(),
				user.getUsername(),
				user.getUserType(),
				UserStatus.ACTIVE,
				null,
				false,
				false,
				true,
				1L
		);
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
		throw new AssertionError("timed out waiting for a chat frame");
	}

	private String history(User user, long roomId) throws Exception {
		return mockMvc.perform(get("/api/v1/user/chat-rooms/" + roomId + "/messages").cookie(cookie(user)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}

	private void stamp(long messageId, Instant createdAt) {
		jdbc.update("update chat_messages set created_at = ? where id = ?", Timestamp.from(createdAt), messageId);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private User named(String displayName) {
		User account = user("room");
		account.changeDisplayName(displayName);
		return users.saveAndFlush(account);
	}

	private ChatRoom direct(User requester, User recipient, DmStatus status) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(),
				recipient.getId(),
				status,
				RequestKind.GENERAL,
				status == DmStatus.REQUESTED ? NOW.plusSeconds(3600) : null
		));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private ChatRoom team(User... people) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(System.nanoTime()));
		for (User person : people) {
			members.saveAndFlush(ChatRoomMember.join(room, person.getId()));
		}
		return room;
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
