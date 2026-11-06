package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.MessageType;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.realtime.TeamChatAccess;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.ChatService;
import com.linker.backend.service.user.ModerationService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
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
class ChatTextIntegrationTest {

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

	@LocalServerPort
	private int port;
	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private StringRedisTemplate redis;
	@MockitoSpyBean
	private com.linker.backend.global.security.RedisRateLimiter rateLimiter;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@MockitoSpyBean
	private ChatMessageRepository messages;
	@MockitoSpyBean
	private TeamChatAccess teamChat;
	@Autowired
	private ChatService chat;
	@Autowired
	private ModerationService moderation;
	@Autowired
	private PlatformTransactionManager transactions;

	@Test
	void sendPersistsPointerAndReachesTheOtherMember() throws Exception {
		User sender = user("writer");
		User reader = user("reader");
		ChatRoom room = direct(sender, reader, DmStatus.ACCEPTED);
		StompSession senderSocket = connect(sender);
		StompSession readerSocket = connect(reader);
		List<String> senderFrames = frames(senderSocket, "/topic/chat-rooms/" + room.getId());
		List<String> readerFrames = frames(readerSocket, "/topic/chat-rooms/" + room.getId());
		List<String> readerList = frames(readerSocket, "/user/queue/chat-rooms");
		String clientId = UUID.randomUUID().toString();
		send(senderSocket, room.getId(), clientId, "  안녕  ", Map.of("senderId", reader.getId()));
		waitUntil(() -> !readerFrames.isEmpty());
		assertThat(senderFrames).hasSize(1);
		assertThat(readerFrames.get(0)).contains("안녕").contains(clientId).doesNotContain(reader.getUsername());
		assertThat(readerList.stream().anyMatch(frame -> frame.contains("CHAT_ROOMS_CHANGED"))).isTrue();
		assertThat(messages.findBySenderIdAndClientMessageId(sender.getId(), clientId)).isPresent();
		Long pointer = jdbc.queryForObject("select last_message_id from chat_rooms where id = ?", Long.class, room.getId());
		Long messageRoom = jdbc.queryForObject(
				"select room_id from chat_messages where id = ?",
				Long.class,
				pointer
		);
		assertThat(messageRoom).isEqualTo(room.getId());
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("  안녕  "))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[0].text").value("  안녕  "))
				.andExpect(jsonPath("$.items[0].sender.id").value(sender.getId()))
				.andExpect(jsonPath("$.history").value(nullValue()))
				.andExpect(jsonPath("$.catchUpLimited").value(false));
		senderSocket.disconnect();
		readerSocket.disconnect();
	}

	@Test
	void retryIsOneRowAndADifferentBodyConflicts() throws Exception {
		User sender = user("retry");
		User other = user("retry-other");
		ChatRoom room = direct(sender, other, DmStatus.ACCEPTED);
		ChatRoom elsewhere = direct(sender, user("third"), DmStatus.ACCEPTED);
		String clientId = UUID.randomUUID().toString();
		StompSession socket = connect(sender);
		List<String> frames = frames(socket, "/topic/chat-rooms/" + room.getId());
		send(socket, room.getId(), clientId, "같은 내용", Map.of());
		waitUntil(() -> frames.size() == 1);
		List<String> accepted = frames(socket, "/user/queue/chat-rooms");
		String rateKey = "rate:chat.send:" + sender.getId();
		String charged = redis.opsForValue().get(rateKey);
		send(socket, room.getId(), clientId, "같은 내용", Map.of());
		waitUntil(() -> accepted.stream().anyMatch(frame -> frame.contains("CHAT_SEND_ACCEPTED") && frame.contains(clientId)));
		assertThat(frames).hasSize(1);
		assertThat(redis.opsForValue().get(rateKey)).isEqualTo(charged);
		assertThat(jdbc.queryForObject(
				"select count(*) from chat_messages where sender_id = ? and client_message_id = ?",
				Long.class,
				sender.getId(),
				clientId
		)).isEqualTo(1L);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		send(socket, room.getId(), clientId, "다른 내용", Map.of());
		waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("CONFLICT")));
		send(socket, elsewhere.getId(), clientId, "같은 내용", Map.of());
		waitUntil(() -> rejected.stream().filter(frame -> frame.contains("CONFLICT")).count() >= 2);
		socket.disconnect();
	}

	@Test
	void concurrentSameIdKeepsOneRowAndLaterMessagesStayOrdered() throws Exception {
		User sender = user("race");
		User other = user("race-other");
		ChatRoom room = direct(sender, other, DmStatus.ACCEPTED);
		String clientId = UUID.randomUUID().toString();
		StompSession senderSocket = connect(sender);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		List<String> accepted = frames(senderSocket, "/user/queue/chat-rooms");
		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		Future<?> first = pool.submit(() -> sendWhen(start, sender, room.getId(), clientId, "동시"));
		Future<?> second = pool.submit(() -> sendWhen(start, sender, room.getId(), clientId, "동시"));
		start.countDown();
		first.get(10, TimeUnit.SECONDS);
		second.get(10, TimeUnit.SECONDS);
		pool.shutdown();
		waitUntil(() -> topic.size() == 1 && accepted.stream().anyMatch(frame -> frame.contains("CHAT_SEND_ACCEPTED")));
		Thread.sleep(300);
		assertThat(topic).hasSize(1);
		assertThat(jdbc.queryForObject(
				"select count(*) from chat_messages where room_id = ?",
				Long.class,
				room.getId()
		)).isEqualTo(1L);
		chat.sendMessage(sender.getId(), room.getId(), Map.of("clientMessageId", UUID.randomUUID().toString(), "text", "다음"));
		String body = mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(other)))
				.andExpect(jsonPath("$.items.length()").value(2))
				.andReturn().getResponse().getContentAsString();
		int firstText = body.indexOf("동시");
		int secondText = body.indexOf("다음");
		assertThat(firstText).isLessThan(secondText);
		senderSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void historyBoundariesCatchUpAndPlaceholders() throws Exception {
		User viewer = user("history");
		User other = user("history-other");
		ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED);
		List<Long> ids = new ArrayList<>();
		for (int i = 0; i < 31; i++) {
			ids.add(messages.saveAndFlush(ChatMessage.text(room, other.getId(), "m" + i)).getId());
		}
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(30))
				.andExpect(jsonPath("$.hasMore").value(true))
				.andExpect(jsonPath("$.items[0].id").value(ids.get(1)))
				.andExpect(jsonPath("$.items[29].id").value(ids.get(30)));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("before", ids.get(1).toString()).cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].id").value(ids.get(0)))
				.andExpect(jsonPath("$.hasMore").value(false));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("before", "0").cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("before", "-1").cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("before", ids.get(0).toString()).param("after", ids.get(1).toString()).cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		ChatRoom otherRoom = direct(other, user("anchor-other"), DmStatus.ACCEPTED);
		Long foreign = messages.saveAndFlush(ChatMessage.text(otherRoom, other.getId(), "남의 방")).getId();
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("after", foreign.toString()).cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());

		ChatMessage deleted = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "지워질 원문"));
		deleted.delete(Instant.now());
		messages.saveAndFlush(deleted);
		ChatMessage hidden = messages.saveAndFlush(ChatMessage.create(
				room, other.getId(), MessageType.TEXT, "숨길 원문", MessageVisibility.VISIBLE));
		hidden.hide();
		messages.saveAndFlush(hidden);
		String page = mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items[?(@.id == " + deleted.getId() + ")].text").exists())
				.andReturn().getResponse().getContentAsString();
		assertThat(page).contains("삭제된 메시지입니다", "운영 정책에 따라 숨겨진 메시지예요");
		assertThat(page).doesNotContain("지워질 원문", "숨길 원문");
	}

	@Test
	void catchUpStopsAtTheCapAndContinues() throws Exception {
		User viewer = user("catchup");
		User other = user("catchup-other");
		ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED);
		Long first = null;
		for (int i = 0; i < PlanLimits.CHAT_CATCH_UP_MAX + 2; i++) {
			Long id = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "c" + i)).getId();
			if (first == null) {
				first = id;
			}
		}
		String capped = mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("after", first.toString()).cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(PlanLimits.CHAT_CATCH_UP_MAX))
				.andExpect(jsonPath("$.catchUpLimited").value(true))
				.andExpect(jsonPath("$.hasMore").value(true))
				.andExpect(jsonPath("$.nextAfter").isNumber())
				.andReturn().getResponse().getContentAsString();
		String nextAfter = capped.replaceAll(".*\"nextAfter\":(\\d+).*", "$1");
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages")
						.param("after", nextAfter).cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.catchUpLimited").value(false));
	}

	@Test
	void teamHistoryIsFreeWindowAndTeamSendWithoutReadableTeamStateIsRejected() throws Exception {
		User member = user("team-member");
		ChatRoom team = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(team, member.getId()));
		ChatMessage recent = messages.saveAndFlush(ChatMessage.text(team, member.getId(), "최근"));
		ChatMessage old = messages.saveAndFlush(ChatMessage.text(team, member.getId(), "오래된 원문"));
		Instant now = Instant.now();
		stamp(recent.getId(), now.minus(Duration.ofDays(60)).plusSeconds(5));
		stamp(old.getId(), now.minus(Duration.ofDays(60)).minusSeconds(5));
		String page = mockMvc.perform(get("/api/v1/user/chat-rooms/" + team.getId() + "/messages").cookie(cookie(member)))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].text").value("최근"))
				.andExpect(jsonPath("$.history.applied").value("FREE_60_DAYS"))
				.andExpect(jsonPath("$.history.flexSupported").value(false))
				.andReturn().getResponse().getContentAsString();
		assertThat(page).doesNotContain("오래된 원문");
		StompSession socket = connect(member);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		send(socket, team.getId(), UUID.randomUUID().toString(), "팀 전송", Map.of());
		waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("FORBIDDEN") && frame.contains("retryable=false")));
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ? and body = ?", Long.class, team.getId(), "팀 전송"))
				.isZero();
		socket.disconnect();
	}

	@Test
	void allMentionRequiresTeamOwnerOrAdmin() throws Exception {
		User owner = user("team-owner-all");
		User member = user("team-member-all");
		ChatRoom team = rooms.saveAndFlush(ChatRoom.team(91001L));
		members.saveAndFlush(ChatRoomMember.join(team, owner.getId()));
		members.saveAndFlush(ChatRoomMember.join(team, member.getId()));
		try {
			doReturn(true).when(teamChat).writableBy(anyLong(), eq(91001L));
			// @all looks up the team's members; the team tables are not in this test database
			doReturn(List.of()).when(teamChat).mentionCandidates(anyLong(), eq(91001L));
			doReturn(false).when(teamChat).canModerate(member.getId(), 91001L);
			StompSession memberSocket = connect(member);
			List<String> rejected = frames(memberSocket, "/user/queue/chat-rooms");
			send(memberSocket, team.getId(), UUID.randomUUID().toString(), "@all 공지", Map.of());
			waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("FORBIDDEN") && frame.contains("@전체 멘션")));
			assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, team.getId())).isZero();
			memberSocket.disconnect();

			doReturn(true).when(teamChat).canModerate(owner.getId(), 91001L);
			StompSession ownerSocket = connect(owner);
			send(ownerSocket, team.getId(), UUID.randomUUID().toString(), "@전체 공지", Map.of());
			waitUntil(() -> jdbc.queryForObject(
					"select count(*) from chat_messages where room_id=? and body=?", Long.class, team.getId(), "@전체 공지") == 1L);
			ownerSocket.disconnect();
		}
		finally {
			reset(teamChat);
		}
	}

	@Test
	void blockPeriodHidesLiveTextAndReadCannotUseIt() throws Exception {
		User viewer = user("block-viewer");
		User sender = user("block-sender");
		ChatRoom room = direct(sender, viewer, DmStatus.ACCEPTED);
		Long earlier = messages.saveAndFlush(ChatMessage.text(room, viewer.getId(), "내 메시지")).getId();
		moderation.block(viewer.getId(), sender.getId());
		StompSession viewerSocket = connect(viewer);
		StompSession senderSocket = connect(sender);
		List<String> seen = frames(viewerSocket, "/topic/chat-rooms/" + room.getId());
		send(senderSocket, room.getId(), UUID.randomUUID().toString(), "가려진 원문", Map.of());
		Thread.sleep(500);
		assertThat(seen).isEmpty();
		Long hiddenId = jdbc.queryForObject(
				"select id from chat_messages where room_id = ? and body = ?",
				Long.class,
				room.getId(),
				"가려진 원문"
		);
		Instant blockAt = instant(
				"select created_at from user_blocks where blocker_id = ? and blocked_id = ?",
				viewer.getId(),
				sender.getId()
		);
		Instant messageAt = instant("select created_at from chat_messages where id = ?", hiddenId);
		assertThat(messageAt).isAfterOrEqualTo(blockAt);
		assertThat(history(viewer, room.getId(), null)).doesNotContain("가려진 원문");
		assertThat(history(viewer, room.getId(), earlier)).doesNotContain("가려진 원문");
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + hiddenId + "}")
						.cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		moderation.unblock(viewer.getId(), sender.getId());
		send(senderSocket, room.getId(), UUID.randomUUID().toString(), "해제 후", Map.of());
		waitUntil(() -> seen.stream().anyMatch(frame -> frame.contains("해제 후")));
		assertThat(seen.stream().noneMatch(frame -> frame.contains("가려진 원문"))).isTrue();
		String opened = history(viewer, room.getId(), null);
		assertThat(opened).contains("해제 후").doesNotContain("가려진 원문");
		jdbc.update(
				"update user_blocks set created_at = ?, unblocked_at = null where blocker_id = ? and blocked_id = ?",
				Timestamp.from(messageAt),
				viewer.getId(),
				sender.getId()
		);
		assertThat(history(viewer, room.getId(), null)).doesNotContain("가려진 원문");
		jdbc.update(
				"update user_blocks set unblocked_at = ? where blocker_id = ? and blocked_id = ?",
				Timestamp.from(messageAt),
				viewer.getId(),
				sender.getId()
		);
		assertThat(history(viewer, room.getId(), null)).contains("가려진 원문");
		jdbc.update(
				"update user_blocks set created_at = ?, unblocked_at = null where blocker_id = ? and blocked_id = ?",
				Timestamp.from(messageAt.plus(1, ChronoUnit.MICROS)),
				viewer.getId(),
				sender.getId()
		);
		assertThat(history(viewer, room.getId(), null)).contains("가려진 원문");
		viewerSocket.disconnect();
		senderSocket.disconnect();
	}

	@Test
	void uniqueViolationConfirmsTheStoredRowWithoutAnotherBroadcast() throws Exception {
		User sender = user("unique");
		User other = user("unique-other");
		ChatRoom room = direct(sender, other, DmStatus.ACCEPTED);
		String clientId = UUID.randomUUID().toString();
		chat.sendMessage(sender.getId(), room.getId(), Map.of("clientMessageId", clientId, "text", "이미 저장"));
		StompSession senderSocket = connect(sender);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		List<String> accepted = frames(senderSocket, "/user/queue/chat-rooms");
		ChatMessage stored = messages.findBySenderIdAndClientMessageId(sender.getId(), clientId).orElseThrow();
		AtomicInteger finds = new AtomicInteger();
		doAnswer(invocation -> finds.getAndIncrement() == 0 ? Optional.empty() : Optional.of(stored))
				.when(messages).findBySenderIdAndClientMessageId(sender.getId(), clientId);
		doThrow(new DataIntegrityViolationException("duplicate"))
				.when(messages).saveAndFlush(any(ChatMessage.class));
		try {
			chat.sendMessage(sender.getId(), room.getId(), Map.of("clientMessageId", clientId, "text", "이미 저장"));
			waitUntil(() -> accepted.stream().anyMatch(frame -> frame.contains("CHAT_SEND_ACCEPTED") && frame.contains(clientId)));
			Thread.sleep(300);
			assertThat(topic).isEmpty();
			assertThat(jdbc.queryForObject(
					"select count(*) from chat_messages where sender_id = ? and client_message_id = ?",
					Long.class,
					sender.getId(),
					clientId
			)).isEqualTo(1L);
		}
		finally {
			reset(messages);
		}
		senderSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void redisFailureKeepsTheSocketAndTheSameIdSucceedsAfterRecovery() throws Exception {
		User sender = user("redis-down");
		User other = user("redis-other");
		ChatRoom room = direct(sender, other, DmStatus.ACCEPTED);
		StompSession senderSocket = connect(sender);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		List<String> rejected = frames(senderSocket, "/user/queue/chat-rooms");
		String clientId = UUID.randomUUID().toString();
		doThrow(new DataAccessResourceFailureException("redis down"))
				.when(rateLimiter).tryAcquire(eq("chat.send"), anyLong(), anyInt(), anyInt());
		try {
			send(senderSocket, room.getId(), clientId, "저장 전 실패", Map.of());
			waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("SERVICE_UNAVAILABLE") && frame.contains("retryable=true")));
			assertThat(senderSocket.isConnected()).isTrue();
			assertThat(topic).isEmpty();
			assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, room.getId())).isZero();
			assertThat(jdbc.queryForObject("select last_message_id from chat_rooms where id = ?", Long.class, room.getId())).isNull();
		}
		finally {
			reset(rateLimiter);
		}
		send(senderSocket, room.getId(), clientId, "저장 전 실패", Map.of());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("저장 전 실패") && frame.contains(clientId)));
		assertThat(jdbc.queryForObject(
				"select count(*) from chat_messages where sender_id = ? and client_message_id = ?",
				Long.class,
				sender.getId(),
				clientId
		)).isEqualTo(1L);
		senderSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void readMovesForwardOnlyAndSuspendedWriteFails() throws Exception {
		User viewer = user("read-viewer");
		User sender = user("read-sender");
		ChatRoom room = direct(sender, viewer, DmStatus.ACCEPTED);
		ChatMessage first = messages.saveAndFlush(ChatMessage.text(room, sender.getId(), "하나"));
		ChatMessage second = messages.saveAndFlush(ChatMessage.text(room, sender.getId(), "둘"));
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + second.getId() + "}")
						.cookie(cookie(viewer)))
				.andExpect(status().isNoContent());
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + first.getId() + "}")
						.cookie(cookie(viewer)))
				.andExpect(status().isNoContent());
		assertThat(members.findActive(room.getId(), viewer.getId()).orElseThrow().getLastReadMessageId()).isEqualTo(second.getId());
		mockMvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.DIRECT").value(0));
		ChatRoom elsewhere = direct(sender, user("read-foreign"), DmStatus.ACCEPTED);
		Long foreign = messages.saveAndFlush(ChatMessage.text(elsewhere, sender.getId(), "밖")).getId();
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + foreign + "}")
						.cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());

		User suspended = user("suspended-sender");
		ChatRoom suspendedRoom = direct(suspended, viewer, DmStatus.ACCEPTED);
		StompSession socket = connect(suspended);
		suspended.suspendUntil(Instant.now().plusSeconds(3600));
		users.saveAndFlush(suspended);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		send(socket, suspendedRoom.getId(), UUID.randomUUID().toString(), "정지 후", Map.of());
		waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("SUSPENDED")));
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, suspendedRoom.getId())).isZero();
		mockMvc.perform(post("/api/v1/user/chat-rooms/" + suspendedRoom.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":1}")
						.cookie(cookie(suspended)))
				.andExpect(status().isForbidden());
		socket.disconnect();
	}

	@Test
	void limitsBlankTextAndRollback() throws Exception {
		User sender = user("limits");
		User other = user("limits-other");
		ChatRoom room = direct(sender, other, DmStatus.ACCEPTED);
		StompSession socket = connect(sender);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		for (int i = 0; i < PlanLimits.CHAT_SENDS_PER_SECOND; i++) {
			chat.sendMessage(sender.getId(), room.getId(), Map.of(
					"clientMessageId", UUID.randomUUID().toString(),
					"text", "속도 " + i
			));
		}
		chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", UUID.randomUUID().toString(),
				"text", "초과"
		));
		waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("RATE_LIMITED") && frame.contains("retryable=true")));
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ? and body = ?", Long.class, room.getId(), "초과"))
				.isZero();
		socket.disconnect();

		User fresh = user("rollback");
		ChatRoom freshRoom = direct(fresh, other, DmStatus.ACCEPTED);
		new TransactionTemplate(transactions).executeWithoutResult(status -> {
			chat.sendMessage(fresh.getId(), freshRoom.getId(), Map.of(
					"clientMessageId", UUID.randomUUID().toString(),
					"text", "롤백"
			));
			status.setRollbackOnly();
		});
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where body = ?", Long.class, "롤백")).isZero();
		org.junit.jupiter.api.Assertions.assertThrows(com.linker.backend.global.realtime.StompAuthException.class, () -> chat.sendMessage(
				sender.getId(), room.getId(), Map.of("clientMessageId", UUID.randomUUID().toString(), "text", "   ")
		));
		String tooLong = "가".repeat(PlanLimits.CHAT_MESSAGE_MAX_CHARS + 1);
		org.junit.jupiter.api.Assertions.assertThrows(com.linker.backend.global.realtime.StompAuthException.class, () -> chat.sendMessage(
				sender.getId(), room.getId(), Map.of("clientMessageId", UUID.randomUUID().toString(), "text", tooLong)
		));
	}

	@Test
	void leftMemberLosesAccessAndRequestedSendStaysClosed() throws Exception {
		User viewer = user("left");
		User other = user("stays");
		ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED);
		ChatRoomMember mine = members.findActive(room.getId(), viewer.getId()).orElseThrow();
		mine.leave(Instant.now());
		members.saveAndFlush(mine);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(viewer)))
				.andExpect(status().isNotFound());
		ChatRoom requested = direct(other, user("request-inbox"), DmStatus.REQUESTED);
		org.junit.jupiter.api.Assertions.assertThrows(com.linker.backend.global.realtime.StompAuthException.class, () -> chat.sendMessage(
				other.getId(), requested.getId(), Map.of("clientMessageId", UUID.randomUUID().toString(), "text", "추가")
		));
	}

	@Test
	void openApiDocumentsMessageRead() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages'].get.operationId").value("listChatMessages"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/messages'].get.tags[0]").value("p17-chat-room"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/read'].post.operationId").value("markChatRead"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/{roomId}/read'].post.responses['204']").exists());
	}

	private void sendWhen(CountDownLatch start, User sender, long roomId, String clientId, String text) {
		try {
			start.await();
			chat.sendMessage(sender.getId(), roomId, Map.of("clientMessageId", clientId, "text", text));
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
		}
	}

	private void send(StompSession session, long roomId, String clientId, String text, Map<String, Object> extra) {
		Map<String, Object> body = new HashMap<>();
		body.put("clientMessageId", clientId);
		body.put("text", text);
		body.putAll(extra);
		StompHeaders headers = new StompHeaders();
		headers.setDestination("/app/chat-rooms/" + roomId + "/messages");
		session.send(headers, body);
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
		return connect(sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	private StompSession connect(String rawToken) throws Exception {
		WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
		client.setMessageConverter(new JacksonJsonMessageConverter());
		WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
		handshake.add(HttpHeaders.COOKIE, "linker_session=" + rawToken);
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

	private String history(User user, long roomId, Long after) throws Exception {
		var request = get("/api/v1/user/chat-rooms/" + roomId + "/messages").cookie(cookie(user));
		if (after != null) {
			request.param("after", after.toString());
		}
		return mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
	}

	private Instant instant(String sql, Object... args) {
		return jdbc.queryForObject(sql, Timestamp.class, args).toInstant();
	}

	private void stamp(long messageId, Instant createdAt) {
		jdbc.update("update chat_messages set created_at = ? where id = ?", Timestamp.from(createdAt), messageId);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private ChatRoom direct(User requester, User recipient, DmStatus status) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(),
				recipient.getId(),
				status,
				RequestKind.GENERAL,
				status == DmStatus.REQUESTED ? Instant.now().plusSeconds(3600) : null
		));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
