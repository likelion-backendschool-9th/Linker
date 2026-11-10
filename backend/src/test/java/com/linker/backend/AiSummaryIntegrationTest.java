package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.chat.response.AiChatSummaryResponse;
import com.linker.backend.dto.chat.response.ChatMessageResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.realtime.TeamChatAccess;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.ai.LlmClient;
import com.linker.backend.integration.ai.LlmException;
import com.linker.backend.integration.ai.LlmResult;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.user.AiSummaryService;
import com.linker.backend.service.user.ChatService;
import com.linker.backend.support.TeamTestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Page 17 AI summary (POL-C-5): background minutes, quota, notices, share and the room's ring state. */
@SpringBootTest
@Testcontainers
class AiSummaryIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final JsonMapper JSON = JsonMapper.builder().build();
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

	@Autowired JdbcTemplate jdbc;
	@Autowired UserRepository users;
	@Autowired ChatRoomRepository rooms;
	@Autowired ChatRoomMemberRepository members;
	@Autowired ChatMessageRepository messages;
	@Autowired AiSummaryService summaries;
	@Autowired ChatService chat;
	@Autowired StringRedisTemplate redis;
	@MockitoBean LlmClient llm;
	@MockitoBean SimpMessagingTemplate messaging;
	@MockitoSpyBean TeamChatAccess teamChat;

	@BeforeEach
	void model() {
		when(llm.modelName()).thenReturn("test-model");
	}

	@Test
	void summaryRunsInBackgroundMapsSourcesAndNotifiesRequester() throws Exception {
		Room room = flexRoom(25);
		reply("""
				{"oneLine":"배포 일정을 정했어요","decisions":[{"text":"금요일 배포","ref":1},{"text":"금요일 배포","ref":2}],
				 "actionItems":[{"text":"민수: 리뷰","ref":999}],"openQuestions":[{"text":"회의 시간?","ref":25},{"text":"  ","ref":3}]}
				""");

		AiChatSummaryResponse started = summaries.create(room.me(), room.id());

		assertThat(started.status()).isEqualTo("PENDING");
		assertThat(started.usedToday()).isEqualTo(1);
		AiChatSummaryResponse done = awaitFinal(room, started.summaryId());
		assertThat(done.status()).isEqualTo("DONE");
		assertThat(done.phase()).isEqualTo("DONE");
		assertThat(done.progress()).isEqualTo(100);
		assertThat(done.oneLine()).isEqualTo("배포 일정을 정했어요");
		assertThat(done.messageCount()).isEqualTo(25);
		// ref 1 is the oldest message read; duplicates and blank items are dropped; unknown refs lose their link
		assertThat(done.decisions()).hasSize(1);
		assertThat(done.decisions().getFirst().messageId()).isEqualTo(room.messageIds().getFirst());
		assertThat(done.actionItems().getFirst().messageId()).isNull();
		assertThat(done.openQuestions()).hasSize(1);
		assertThat(done.openQuestions().getFirst().messageId()).isEqualTo(room.messageIds().getLast());
		assertThat(done.disclaimer()).isEqualTo("AI가 만든 요약이라 틀릴 수 있어요");

		assertThat(jdbc.queryForMap("""
				select notification_type, link_path, read_at from notifications
				where user_id = ? and target_type = 'AI_SUMMARY' and target_id = ?
				""", room.owner().getId(), started.summaryId()))
				.containsEntry("notification_type", "AI_SUMMARY_DONE")
				.containsEntry("link_path", "/chats/" + room.id() + "?overlay=ai-summary&oid=" + started.summaryId());
		// awaitFinal read the DONE summary, which reads its notice
		assertThat(jdbc.queryForObject("""
				select read_at is not null from notifications where target_type = 'AI_SUMMARY' and target_id = ?
				""", Boolean.class, started.summaryId())).isTrue();
	}

	@Test
	void secondTapWhileRunningFollowsTheSameSummaryWithoutSpendingAnotherUse() throws Exception {
		Room room = flexRoom(20);
		CountDownLatch release = new CountDownLatch(1);
		when(llm.chat(any(), any())).thenAnswer(invocation -> {
			release.await(10, TimeUnit.SECONDS);
			return result("""
					{"oneLine":"요약","decisions":[],"actionItems":[],"openQuestions":[]}
					""");
		});

		AiChatSummaryResponse first = summaries.create(room.me(), room.id());
		AiChatSummaryResponse second = summaries.create(room.me(), room.id());

		assertThat(second.summaryId()).isEqualTo(first.summaryId());
		assertThat(second.usedToday()).isEqualTo(1);
		release.countDown();
		assertThat(awaitFinal(room, first.summaryId()).status()).isEqualTo("DONE");
	}

	@Test
	void slowOrBrokenModelFailsOnceGivesTheUseBackAndSaysSo() throws Exception {
		Room room = flexRoom(20);
		when(llm.chat(any(), any())).thenThrow(new LlmException(false, "deadline"));

		AiChatSummaryResponse started = summaries.create(room.me(), room.id());
		AiChatSummaryResponse failed = awaitFinal(room, started.summaryId());

		assertThat(failed.status()).isEqualTo("FAILED");
		assertThat(failed.usedToday()).isZero();
		verify(llm, times(1)).chat(any(), any());
		assertThat(jdbc.queryForObject("""
				select notification_type from notifications where target_type = 'AI_SUMMARY' and target_id = ?
				""", String.class, started.summaryId())).isEqualTo("AI_SUMMARY_FAILED");
		assertThat(chatRoomSummary(room)).containsEntry("status", "FAILED");
	}

	@Test
	void unreachableModelIsRetriedOnce() throws Exception {
		Room room = flexRoom(20);
		when(llm.chat(any(), any()))
				.thenThrow(new LlmException(true, "connection refused"))
				.thenReturn(result("""
						{"oneLine":"다시 시도해서 됐어요","decisions":[],"actionItems":[],"openQuestions":[]}
						"""));

		AiChatSummaryResponse started = summaries.create(room.me(), room.id());

		assertThat(awaitFinal(room, started.summaryId()).oneLine()).isEqualTo("다시 시도해서 됐어요");
		verify(llm, times(2)).chat(any(), any());
	}

	@Test
	void shareRequiresDonePostsOneCardAndClearsTheRing() throws Exception {
		Room room = flexRoom(20);
		reply("""
				{"oneLine":"PR 리뷰를 나눴어요","decisions":[{"text":"리뷰는 오늘","ref":2}],"actionItems":[],"openQuestions":[]}
				""");
		AiChatSummaryResponse started = summaries.create(room.me(), room.id());
		awaitFinal(room, started.summaryId());
		assertThat(chatRoomSummary(room)).containsEntry("status", "DONE");

		ChatMessageResponse card = summaries.share(room.me(), room.id(), started.summaryId());
		ChatMessageResponse again = summaries.share(room.me(), room.id(), started.summaryId());

		assertThat(card.type()).isEqualTo("AI_SUMMARY");
		assertThat(card.text()).isEqualTo("AI 요약 · PR 리뷰를 나눴어요");
		JsonNode payload = JSON.valueToTree(card.payload());
		assertThat(payload.path("oneLine").asString()).isEqualTo("PR 리뷰를 나눴어요");
		assertThat(payload.path("decisions").get(0).path("messageId").asLong()).isEqualTo(room.messageIds().get(1));
		assertThat(again.id()).isEqualTo(card.id());
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ? and message_type = 'AI_SUMMARY'",
				Long.class, room.id())).isOne();
		assertThat(summaries.get(room.me(), room.id(), started.summaryId()).sharedMessageId()).isEqualTo(card.id());
		assertThat(chat.room(room.me(), room.id()).myAiSummary()).isNull();
	}

	@Test
	void freeTeamsShortRoomsAndOtherPeopleAreTurnedAway() {
		Room free = room(25, false);
		assertThatThrownBy(() -> summaries.create(free.me(), free.id()))
				.isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode()).isEqualTo("PLAN_LIMIT"));

		Room quiet = flexRoom(19);
		assertThatThrownBy(() -> summaries.create(quiet.me(), quiet.id()))
				.isInstanceOfSatisfying(ApiException.class, error -> {
					assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR");
					assertThat(error.getMessage()).isEqualTo("직접 읽는 게 더 빨라요");
				});
		assertThat(redis.opsForValue().get("ai-summary:" + quiet.owner().getId() + ":" + today())).isIn(null, "0");

		AuthenticatedUser stranger = principal(user("stranger"));
		assertThatThrownBy(() -> summaries.create(stranger, quiet.id()))
				.isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getStatus()).isEqualTo(404));
	}

	// ---- fixtures --------------------------------------------------------------------

	private record Room(long id, long teamId, User owner, AuthenticatedUser me, List<Long> messageIds) {
	}

	private Room flexRoom(int messageCount) {
		return room(messageCount, true);
	}

	private Room room(int messageCount, boolean flex) {
		User owner = user("owner");
		User bob = user("bob");
		long teamId = TeamTestFixtures.team(jdbc, owner.getId(), "ai-" + System.nanoTime(), "ACTIVE");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(teamId));
		members.saveAndFlush(ChatRoomMember.join(room, owner.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, bob.getId()));
		doReturn(true).when(teamChat).writableBy(anyLong(), eq(teamId));
		doReturn(new TeamChatAccess.TeamView(teamId, "에이아이팀", "ACTIVE", "OWNER", null, true, Instant.now()))
				.when(teamChat).readableBy(anyLong(), eq(teamId));
		if (flex) {
			jdbc.update("""
					insert into subscriptions(plan, team_id, payer_user_id, billing_cycle, status, seats,
					  current_period_start, current_period_end, created_at, updated_at)
					values ('FLEX', ?, ?, 'MONTHLY', 'ACTIVE', 6, now(), now() + interval '30 days', now(), now())
					""", teamId, owner.getId());
		}
		List<Long> ids = new java.util.ArrayList<>();
		for (int i = 1; i <= messageCount; i++) {
			long sender = i % 2 == 0 ? owner.getId() : bob.getId();
			ids.add(messages.saveAndFlush(ChatMessage.text(room, sender, "메시지 " + i)).getId());
		}
		return new Room(room.getId(), teamId, owner, principal(owner), ids);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private static AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(user.getId(), user.getUsername(), UserType.DEVELOPER, UserStatus.ACTIVE,
				null, false, false, true, 1L);
	}

	private void reply(String content) {
		when(llm.chat(any(), any())).thenReturn(result(content));
	}

	private static LlmResult result(String content) {
		return new LlmResult(content.strip(), 800, 40_000_000_000L, 120, 27_000_000_000L, "stop");
	}

	private AiChatSummaryResponse awaitFinal(Room room, long summaryId) throws InterruptedException {
		long deadline = System.currentTimeMillis() + 15_000;
		while (System.currentTimeMillis() < deadline) {
			AiChatSummaryResponse current = summaries.get(room.me(), room.id(), summaryId);
			if (!"PENDING".equals(current.status())) {
				return current;
			}
			Thread.sleep(50);
		}
		throw new AssertionError("summary " + summaryId + " stayed PENDING");
	}

	private java.util.Map<String, Object> chatRoomSummary(Room room) {
		var mine = chat.room(room.me(), room.id()).myAiSummary();
		assertThat(mine).isNotNull();
		return java.util.Map.of("summaryId", mine.summaryId(), "status", mine.status());
	}

	private static String today() {
		return java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString();
	}
}
