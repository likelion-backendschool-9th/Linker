package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.MessageType;
import com.linker.backend.entity.chat.type.MessageVisibility;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.realtime.ChatRoomAccess;
import com.linker.backend.global.security.AuthenticatedUser;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatListIntegrationTest {

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

	@MockitoBean
	private SimpMessagingTemplate messaging;

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
	private ModerationService moderation;
	@Autowired
	private ChatService chat;
	@Autowired
	private ChatRoomAccess access;
	@Autowired
	private PlatformTransactionManager transactions;

	@Test
	void guestAndInvalidTabsAreRejected() throws Exception {
		mockMvc.perform(get("/api/v1/user/chat-rooms")).andExpect(status().isUnauthorized());
		User developer = user("dev", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "ALL").cookie(cookie(developer)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("cursor", "%%%").cookie(cookie(developer)))
				.andExpect(status().isBadRequest());
	}

	@Test
	void emptyRoomAndRealPreviewAreDistinct() throws Exception {
		User viewer = user("viewer", UserType.DEVELOPER);
		User other = named("other", "상대");
		User quiet = user("quiet", UserType.DEVELOPER);
		ChatRoom empty = direct(quiet, viewer, DmStatus.ACCEPTED, null);
		jdbc.update(
				"update chat_rooms set created_at = ? where id = ?",
				Timestamp.from(Instant.parse("2026-10-01T00:00:00Z")),
				empty.getId()
		);
		ChatRoom talked = direct(other, viewer, DmStatus.ACCEPTED, null);
		ChatMessage older = messages.saveAndFlush(ChatMessage.text(talked, other.getId(), "이전"));
		ChatMessage newer = messages.saveAndFlush(ChatMessage.text(talked, viewer.getId(), "내가 보낸 마지막"));
		stampMessage(older.getId(), Instant.parse("2026-11-01T00:00:00Z"));
		stampMessage(newer.getId(), Instant.parse("2026-11-02T00:00:00Z"));
		ChatRoomMember mine = members.findActive(talked.getId(), viewer.getId()).orElseThrow();
		mine.readUntil(older.getId());
		members.saveAndFlush(mine);

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].id").value(talked.getId()))
				.andExpect(jsonPath("$.items[0].kind").value("DIRECT"))
				.andExpect(jsonPath("$.items[0].title").value("상대"))
				.andExpect(jsonPath("$.items[0].requestKind").value("GENERAL"))
				.andExpect(jsonPath("$.items[0].companyName").value(nullValue()))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("내가 보낸 마지막"))
				.andExpect(jsonPath("$.items[0].unreadCount").value(0))
				.andExpect(jsonPath("$.items[1].id").value(empty.getId()))
				.andExpect(jsonPath("$.items[1].lastMessage").value(nullValue()))
				.andExpect(jsonPath("$.items[1].unreadCount").value(0));
	}

	@Test
	void systemOwnDeletedAndHiddenMessagesFollowTheWrittenRules() throws Exception {
		User viewer = user("reader", UserType.DEVELOPER);
		User other = user("writer", UserType.DEVELOPER);
		ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED, null);
		ChatMessage system = messages.saveAndFlush(ChatMessage.system(room, "시스템"));
		ChatMessage deleted = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "지워질 말"));
		deleted.delete(Instant.parse("2026-11-03T00:00:00Z"));
		messages.saveAndFlush(deleted);
		ChatMessage hidden = messages.saveAndFlush(ChatMessage.create(
				room, other.getId(), MessageType.TEXT, "숨길 말", MessageVisibility.VISIBLE));
		hidden.hide();
		messages.saveAndFlush(hidden);
		ChatMessage image = messages.saveAndFlush(ChatMessage.create(
				room, other.getId(), MessageType.IMAGE, null, MessageVisibility.VISIBLE));
		stampMessage(system.getId(), Instant.parse("2026-11-01T00:00:00Z"));
		stampMessage(deleted.getId(), Instant.parse("2026-11-02T00:00:00Z"));
		stampMessage(hidden.getId(), Instant.parse("2026-11-03T00:00:00Z"));
		stampMessage(image.getId(), Instant.parse("2026-11-04T00:00:00Z"));

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].lastMessage.text").value(nullValue()))
				.andExpect(jsonPath("$.items[0].unreadCount").value(4));
	}

	@Test
	void blockPeriodChangesPreviewAndUnreadButNotTeamRooms() throws Exception {
		User viewer = user("blocker", UserType.DEVELOPER);
		User other = named("blocked", "차단됨");
		ChatRoom direct = direct(other, viewer, DmStatus.ACCEPTED, null);
		ChatMessage early = messages.saveAndFlush(ChatMessage.text(direct, other.getId(), "이전 공개"));
		ChatMessage covered = messages.saveAndFlush(ChatMessage.text(direct, other.getId(), "기간 안"));
		stampMessage(early.getId(), Instant.parse("2026-11-01T00:00:00Z"));
		stampMessage(covered.getId(), Instant.parse("2026-11-03T00:00:00Z"));
		ChatRoom team = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(team, viewer.getId()));
		members.saveAndFlush(ChatRoomMember.join(team, other.getId()));
		ChatMessage teamMessage = messages.saveAndFlush(ChatMessage.text(team, other.getId(), "팀 메시지"));
		stampMessage(teamMessage.getId(), Instant.parse("2026-11-03T00:00:00Z"));
		moderation.block(viewer.getId(), other.getId());
		jdbc.update(
				"update user_blocks set created_at = ?, unblocked_at = ? where blocker_id = ? and blocked_id = ?",
				Timestamp.from(Instant.parse("2026-11-02T00:00:00Z")),
				Timestamp.from(Instant.parse("2026-11-04T00:00:00Z")),
				viewer.getId(),
				other.getId()
		);

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("이전 공개"))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].title").value(nullValue()))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("팀 메시지"))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1));

		moderation.block(viewer.getId(), other.getId());
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(0));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(1));
	}

	@Test
	void blockPeriodBoundariesAreHalfOpen() throws Exception {
		User viewer = user("edge", UserType.DEVELOPER);
		User other = user("edge-other", UserType.DEVELOPER);
		ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED, null);
		Instant start = Instant.parse("2026-11-02T00:00:00Z");
		Instant end = Instant.parse("2026-11-04T00:00:00Z");
		ChatMessage atStart = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "시작"));
		ChatMessage atEnd = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "끝"));
		stampMessage(atStart.getId(), start);
		stampMessage(atEnd.getId(), end);
		moderation.block(viewer.getId(), other.getId());
		moderation.unblock(viewer.getId(), other.getId());
		jdbc.update(
				"update user_blocks set created_at = ?, unblocked_at = ? where blocker_id = ? and blocked_id = ?",
				Timestamp.from(start),
				Timestamp.from(end),
				viewer.getId(),
				other.getId()
		);

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("끝"))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1));
	}

	@Test
	void hiddenAndLeftMembersDropOffTheList() throws Exception {
		User viewer = user("hide", UserType.DEVELOPER);
		User other = user("stay", UserType.DEVELOPER);
		User second = user("stay-2", UserType.DEVELOPER);
		ChatRoom hidden = direct(other, viewer, DmStatus.ACCEPTED, null);
		ChatRoom left = direct(second, viewer, DmStatus.ACCEPTED, null);
		ChatRoomMember hiddenMember = members.findActive(hidden.getId(), viewer.getId()).orElseThrow();
		hiddenMember.hide(Instant.now());
		members.saveAndFlush(hiddenMember);
		ChatRoomMember leaving = members.findActive(left.getId(), viewer.getId()).orElseThrow();
		leaving.leave(Instant.now());
		members.saveAndFlush(leaving);

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(0));
	}

	@Test
	void requestTabIsReceivedUnexpiredOnly() throws Exception {
		User viewer = user("inbox", UserType.DEVELOPER);
		User sender = named("sender", "보낸사람");
		User expiredFrom = user("expired-from", UserType.DEVELOPER);
		User rejectedFrom = user("rejected-from", UserType.DEVELOPER);
		User sentTo = user("sent-to", UserType.DEVELOPER);
		Instant future = Instant.now().plusSeconds(3600);
		Instant past = Instant.now().minusSeconds(60);
		ChatRoom pending = direct(sender, viewer, DmStatus.REQUESTED, future);
		messages.saveAndFlush(ChatMessage.text(pending, sender.getId(), "첫 메시지"));
		direct(expiredFrom, viewer, DmStatus.REQUESTED, past);
		ChatRoom sent = direct(viewer, sentTo, DmStatus.REQUESTED, future);
		ChatRoom rejected = direct(rejectedFrom, viewer, DmStatus.REJECTED, future);

		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].id").value(pending.getId()))
				.andExpect(jsonPath("$.items[0].kind").value("REQUEST"))
				.andExpect(jsonPath("$.items[0].requestDirection").value("RECEIVED"));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(sender)))
				.andExpect(jsonPath("$.items.length()").value(0));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(sentTo)))
				.andExpect(jsonPath("$.items[0].id").value(sent.getId()));
		mockMvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.REQUEST").value(1))
				.andExpect(jsonPath("$.requestCount").value(1))
				.andExpect(jsonPath("$.total").value(1));
		assertThat(statusOf(rejected.getId())).isEqualTo("REJECTED");
		assertThat(statusOf(pending.getId())).isEqualTo("REQUESTED");
	}

	@Test
	void summaryCountsRoomsOutsideThePage() throws Exception {
		User viewer = user("pages", UserType.DEVELOPER);
		for (int i = 0; i < 21; i++) {
			User other = user("page-" + i, UserType.DEVELOPER);
			ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED, null);
			ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "m" + i));
			stampMessage(message.getId(), Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i));
		}
		String first = mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(20))
				.andExpect(jsonPath("$.nextCursor").isNotEmpty())
				.andReturn().getResponse().getContentAsString();
		String cursor = first.replaceAll(".*\"nextCursor\":\"([^\"]+)\".*", "$1");
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").param("cursor", cursor).cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.nextCursor").value(nullValue()));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").param("cursor", cursor).cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.DIRECT").value(21))
				.andExpect(jsonPath("$.total").value(21))
				.andExpect(jsonPath("$.requestCount").value(0));
	}

	@Test
	void recruiterSeesOnlyDirectAndSuspendedWritesFail() throws Exception {
		User recruiter = user("scout", UserType.RECRUITER);
		User developer = user("dev-target", UserType.DEVELOPER);
		direct(developer, recruiter, DmStatus.ACCEPTED, null);
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").cookie(cookie(recruiter)))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(recruiter)))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/user/chat-rooms").cookie(cookie(recruiter)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1));
		mockMvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(cookie(recruiter)))
				.andExpect(jsonPath("$.TEAM").value(0))
				.andExpect(jsonPath("$.REQUEST").value(0))
				.andExpect(jsonPath("$.requestCount").value(0));

		User suspended = user("stopped", UserType.DEVELOPER);
		suspended.suspendUntil(Instant.now().plusSeconds(3600));
		users.save(suspended);
		ChatRoom request = direct(developer, suspended, DmStatus.REQUESTED, Instant.now().plusSeconds(3600));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(suspended)))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/user/chat-requests/" + request.getId() + "/accept").cookie(cookie(suspended)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SUSPENDED"));
	}

	@Test
	void acceptAndDeleteEnforceRecipientExpiryAndReplay() throws Exception {
		User viewer = user("receiver", UserType.DEVELOPER);
		User sender = user("from", UserType.DEVELOPER);
		User otherSender = user("from-2", UserType.DEVELOPER);
		User thirdSender = user("from-3", UserType.DEVELOPER);
		ChatRoom pending = direct(sender, viewer, DmStatus.REQUESTED, Instant.now().plusSeconds(3600));
		ChatRoom expired = direct(otherSender, viewer, DmStatus.REQUESTED, Instant.now().minusSeconds(5));
		assertThat(access.canSubscribe(viewer.getId(), pending.getId())).isTrue();
		assertThat(access.canSend(viewer.getId(), pending.getId())).isFalse();
		assertThat(access.canSend(sender.getId(), pending.getId())).isFalse();
		mockMvc.perform(post("/api/v1/user/chat-requests/" + pending.getId() + "/accept").cookie(cookie(sender)))
				.andExpect(status().isForbidden());
		mockMvc.perform(post("/api/v1/user/chat-requests/999999/accept").cookie(cookie(viewer)))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/user/chat-requests/" + expired.getId() + "/accept").cookie(cookie(viewer)))
				.andExpect(status().isConflict());
		assertThat(statusOf(expired.getId())).isEqualTo("REQUESTED");

		mockMvc.perform(post("/api/v1/user/chat-requests/" + pending.getId() + "/accept").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.roomId").value(pending.getId()));
		mockMvc.perform(post("/api/v1/user/chat-requests/" + pending.getId() + "/accept").cookie(cookie(viewer)))
				.andExpect(status().isOk());
		mockMvc.perform(delete("/api/v1/user/chat-requests/" + pending.getId()).cookie(cookie(viewer)))
				.andExpect(status().isConflict());
		verify(messaging, times(1)).convertAndSendToUser(
				eq(Long.toString(viewer.getId())),
				eq("/queue/chat-rooms"),
				eq(Map.of("type", "CHAT_ROOMS_CHANGED", "roomId", pending.getId()))
		);

		ChatRoom another = direct(thirdSender, viewer, DmStatus.REQUESTED, Instant.now().plusSeconds(3600));
		mockMvc.perform(delete("/api/v1/user/chat-requests/" + another.getId()).cookie(cookie(viewer)))
				.andExpect(status().isNoContent());
		mockMvc.perform(delete("/api/v1/user/chat-requests/" + another.getId()).cookie(cookie(viewer)))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "REQUEST").cookie(cookie(sender)))
				.andExpect(jsonPath("$.items.length()").value(0));
		assertThat(access.canSubscribe(viewer.getId(), another.getId())).isFalse();
		assertThat(access.canSubscribe(viewer.getId(), pending.getId())).isTrue();
		assertThat(access.canSend(viewer.getId(), pending.getId())).isTrue();
		assertThat(access.canSend(sender.getId(), pending.getId())).isTrue();
	}

	@Test
	void rollbackPublishesNothingAndConcurrentMutationsPickOne() throws Exception {
		User viewer = user("race", UserType.DEVELOPER);
		User sender = user("race-from", UserType.DEVELOPER);
		ChatRoom room = direct(sender, viewer, DmStatus.REQUESTED, Instant.now().plusSeconds(3600));
		TransactionTemplate tx = new TransactionTemplate(transactions);
		assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
			chat.accept(principal(viewer), room.getId());
			throw new IllegalStateException("rollback");
		})).isInstanceOf(IllegalStateException.class);
		verify(messaging, never()).convertAndSendToUser(any(), any(), any());
		assertThat(statusOf(room.getId())).isEqualTo("REQUESTED");

		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		Future<Integer> accepted = pool.submit(() -> {
			start.await();
			return mockMvc.perform(post("/api/v1/user/chat-requests/" + room.getId() + "/accept").cookie(cookie(viewer)))
					.andReturn().getResponse().getStatus();
		});
		Future<Integer> deleted = pool.submit(() -> {
			start.await();
			return mockMvc.perform(delete("/api/v1/user/chat-requests/" + room.getId()).cookie(cookie(viewer)))
					.andReturn().getResponse().getStatus();
		});
		start.countDown();
		int acceptStatus = accepted.get(15, TimeUnit.SECONDS);
		int deleteStatus = deleted.get(15, TimeUnit.SECONDS);
		pool.shutdown();
		assertThat(acceptStatus).isIn(200, 409);
		assertThat(deleteStatus).isIn(204, 409);
		assertThat(acceptStatus == 200 ^ deleteStatus == 204).isTrue();
	}

	@Test
	void deletedOrHiddenLastMessageUsesPolicyTextAndStaysUnread() throws Exception {
		User viewer = user("preview", UserType.DEVELOPER);
		User deleter = user("deleter", UserType.DEVELOPER);
		User hider = user("hider", UserType.DEVELOPER);
		User blocked = user("period", UserType.DEVELOPER);
		ChatRoom deletedRoom = direct(deleter, viewer, DmStatus.ACCEPTED, null);
		ChatMessage kept = messages.saveAndFlush(ChatMessage.text(deletedRoom, deleter.getId(), "앞선 말"));
		ChatMessage deleted = messages.saveAndFlush(ChatMessage.text(deletedRoom, deleter.getId(), "지워질 원문"));
		deleted.delete(Instant.parse("2026-11-05T00:00:00Z"));
		messages.saveAndFlush(deleted);
		stampMessage(kept.getId(), Instant.parse("2026-11-04T00:00:00Z"));
		stampMessage(deleted.getId(), Instant.parse("2026-11-05T00:00:00Z"));
		ChatRoomMember reader = members.findActive(deletedRoom.getId(), viewer.getId()).orElseThrow();
		reader.readUntil(kept.getId());
		members.saveAndFlush(reader);

		ChatRoom hiddenRoom = direct(hider, viewer, DmStatus.ACCEPTED, null);
		ChatMessage hidden = messages.saveAndFlush(ChatMessage.text(hiddenRoom, hider.getId(), "숨길 원문"));
		hidden.hide();
		messages.saveAndFlush(hidden);
		stampMessage(hidden.getId(), Instant.parse("2026-11-03T00:00:00Z"));

		ChatRoom blockedRoom = direct(blocked, viewer, DmStatus.ACCEPTED, null);
		ChatMessage visible = messages.saveAndFlush(ChatMessage.text(blockedRoom, blocked.getId(), "이전 공개"));
		ChatMessage covered = messages.saveAndFlush(ChatMessage.text(blockedRoom, blocked.getId(), "기간 안 원문"));
		stampMessage(visible.getId(), Instant.parse("2026-11-01T00:00:00Z"));
		stampMessage(covered.getId(), Instant.parse("2026-11-02T00:00:00Z"));
		moderation.block(viewer.getId(), blocked.getId());
		jdbc.update(
				"update user_blocks set created_at = ?, unblocked_at = ? where blocker_id = ? and blocked_id = ?",
				Timestamp.from(Instant.parse("2026-11-02T00:00:00Z")),
				Timestamp.from(Instant.parse("2026-11-02T01:00:00Z")),
				viewer.getId(),
				blocked.getId()
		);

		String body = mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].id").value(deletedRoom.getId()))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value("삭제된 메시지입니다"))
				.andExpect(jsonPath("$.items[0].unreadCount").value(1))
				.andExpect(jsonPath("$.items[1].id").value(hiddenRoom.getId()))
				.andExpect(jsonPath("$.items[1].lastMessage.text").value("운영 정책에 따라 숨겨진 메시지예요"))
				.andExpect(jsonPath("$.items[1].unreadCount").value(1))
				.andExpect(jsonPath("$.items[2].id").value(blockedRoom.getId()))
				.andExpect(jsonPath("$.items[2].lastMessage.text").value("이전 공개"))
				.andExpect(jsonPath("$.items[2].unreadCount").value(1))
				.andReturn().getResponse().getContentAsString();
		assertThat(body).doesNotContain("지워질 원문", "숨길 원문", "기간 안 원문");
	}

	@Test
	void cursorRejectsAnotherParticipantAndBreaksSameTimestampTies() throws Exception {
		User viewer = user("cursor-owner", UserType.DEVELOPER);
		User peer = user("cursor-peer", UserType.DEVELOPER);
		Instant same = Instant.parse("2026-06-01T00:00:00Z");
		List<Long> ids = new ArrayList<>();
		for (int i = 0; i < 21; i++) {
			User other = i == 1 ? peer : user("cursor-" + i, UserType.DEVELOPER);
			ChatRoom room = direct(other, viewer, DmStatus.ACCEPTED, null);
			ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, other.getId(), "같은 시각 " + i));
			stampMessage(message.getId(), same);
			ids.add(room.getId());
		}
		String first = mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(20))
				.andExpect(jsonPath("$.items[0].id").value(ids.get(20)))
				.andExpect(jsonPath("$.items[19].id").value(ids.get(1)))
				.andReturn().getResponse().getContentAsString();
		String cursor = first.replaceAll(".*\"nextCursor\":\"([^\"]+)\".*", "$1");
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").param("cursor", cursor).cookie(cookie(viewer)))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].id").value(ids.get(0)))
				.andExpect(jsonPath("$.nextCursor").value(nullValue()));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(peer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].id").value(ids.get(1)));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").param("cursor", cursor).cookie(cookie(peer)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").param("cursor", cursor).cookie(cookie(viewer)))
				.andExpect(status().isBadRequest());
		assertBadCursor(viewer, token("2:" + viewer.getId() + ":DIRECT:" + same.getEpochSecond() + ".0:" + ids.get(1)));
		assertBadCursor(viewer, token("1:" + viewer.getId() + ":DIRECT:" + same.getEpochSecond() + ".1000000000:" + ids.get(1)));
		assertBadCursor(viewer, token("1:" + viewer.getId() + ":DIRECT:31556889864403200.0:" + ids.get(1)));
		assertBadCursor(viewer, token("1:" + viewer.getId() + ":DIRECT:01.0:" + ids.get(1)));
		assertBadCursor(viewer, "A".repeat(161));
	}

	@Test
	void openApiDocumentsTheFourListOperations() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms'].get.operationId").value("listChatRooms"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms'].get.tags[0]").value("p16-chat-list"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-rooms/unread-summary'].get.operationId").value("unreadChatSummary"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-requests/{roomId}/accept'].post.operationId").value("acceptChatRequest"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-requests/{roomId}'].delete.operationId").value("deleteChatRequest"))
				.andExpect(jsonPath("$.paths['/api/v1/user/chat-requests/{roomId}'].delete.responses['204']").exists());
	}

	private User user(String prefix, UserType type) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), type));
	}

	private User named(String prefix, String displayName) {
		User user = user(prefix, UserType.DEVELOPER);
		user.changeDisplayName(displayName);
		return users.saveAndFlush(user);
	}

	private ChatRoom direct(User requester, User recipient, DmStatus status, Instant expires) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(),
				recipient.getId(),
				status,
				RequestKind.GENERAL,
				expires
		));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private void stampMessage(long messageId, Instant createdAt) {
		jdbc.update(
				"update chat_messages set created_at = ? where id = ?",
				Timestamp.from(createdAt),
				messageId
		);
	}

	private String statusOf(long roomId) {
		return jdbc.queryForObject("select dm_status from chat_rooms where id = ?", String.class, roomId);
	}

	private void assertBadCursor(User viewer, String cursor) throws Exception {
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").param("cursor", cursor).cookie(cookie(viewer)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	private static String token(String payload) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	private static AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(
				user.getId(),
				user.getUsername(),
				user.getUserType(),
				UserStatus.ACTIVE,
				null,
				false,
				false,
				false,
				1L
		);
	}
}
