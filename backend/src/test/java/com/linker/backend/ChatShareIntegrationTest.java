package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.chat.request.ShareChatCardRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RedisRateLimiter;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.ChatService;
import com.linker.backend.support.TeamTestFixtures;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatShareIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static final Instant NOW = Instant.parse("2026-11-08T14:00:00Z");
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
		registry.add("linker.chat.public-origins", () -> "https://linker.test,http://localhost:3000");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@org.springframework.boot.test.context.TestConfiguration
	static class TimeConfig {
		@Bean
		@Primary
		MutableClock shareTestClock() {
			return new MutableClock();
		}
	}

	static class MutableClock extends Clock {
		volatile Instant now = NOW;
		@Override
		public ZoneId getZone() { return ZoneOffset.UTC; }
		@Override
		public Clock withZone(ZoneId zone) { return Clock.fixed(now, zone); }
		@Override
		public Instant instant() { return now; }
	}

	@Autowired MockMvc mvc;
	@Autowired JdbcTemplate jdbc;
	@Autowired UserRepository users;
	@Autowired ChatRoomRepository rooms;
	@Autowired ChatRoomMemberRepository members;
	@Autowired ChatMessageRepository messages;
	@Autowired AuthService sessions;
	@Autowired ChatService chat;
	@Autowired MutableClock clock;
	@MockitoSpyBean RedisRateLimiter limiter;
	@MockitoBean SimpMessagingTemplate messaging;

	@BeforeEach
	void resetTimeAndLimit() {
		clock.now = NOW;
		reset(limiter);
	}

	@Test
	void targetsRequireLoginAndOnlyListWritableMemberRoomsWithLiteralNameSearch() throws Exception {
		User me = user("me", UserType.DEVELOPER);
		ChatRoom active = team(me, "100% Linker_팀", "ACTIVE", true);
		ChatRoom completed = team(me, "완료 팀", "COMPLETED", true);
		team(me, "읽기 전용", "READ_ONLY", true);
		team(me, "보관", "ARCHIVED", true);
		team(me, "지운 팀", "DELETED", true);
		team(me, "팀 탈퇴", "ACTIVE", false);
		direct(me, user("pending", UserType.DEVELOPER), DmStatus.REQUESTED);
		ChatRoom dm = direct(me, named("검색상대"), DmStatus.ACCEPTED);
		ChatRoom blocked = direct(me, user("blocked", UserType.DEVELOPER), DmStatus.ACCEPTED);
		block(me, users.findById(members.findActiveUserIds(blocked.getId()).stream().filter(id -> !id.equals(me.getId())).findFirst().orElseThrow()).orElseThrow());
		ChatRoom left = direct(me, named("나간 상대"), DmStatus.ACCEPTED);
		jdbc.update("update chat_room_members set left_at=now() where room_id=? and user_id<>?", left.getId(), me.getId());
		jdbc.update("update chat_rooms set created_at=? where id=?", Timestamp.from(NOW.minusSeconds(50)), dm.getId());
		ChatMessage newest = messages.saveAndFlush(ChatMessage.text(dm, me.getId(), "최근"));
		jdbc.update("update chat_messages set created_at=? where id=?", Timestamp.from(NOW.plusSeconds(1)), newest.getId());

		mvc.perform(get("/api/v1/user/me/share-targets")).andExpect(status().isUnauthorized());
		JsonNode response = body(mvc.perform(get("/api/v1/user/me/share-targets").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")));
		assertThat(ids(response)).containsExactly(dm.getId(), Math.max(active.getId(), completed.getId()), Math.min(active.getId(), completed.getId()));
		assertThat(body(mvc.perform(get("/api/v1/user/me/share-targets").param("q", "%").cookie(cookie(me)))
				.andExpect(status().isOk())).path("items").size()).isEqualTo(1);
		mvc.perform(get("/api/v1/user/me/share-targets").param("q", "linker_").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].title").value("100% Linker_팀"));
		mvc.perform(get("/api/v1/user/me/share-targets").param("q", "없는 방").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
	}

	@Test
	void recruitersCanShareInOpenDirectRoomsAndTeamStatusIsRecheckedWhenSending() throws Exception {
		User recruiter = user("recruiter", UserType.RECRUITER);
		ChatRoom dm = direct(recruiter, named("개발자"), DmStatus.ACCEPTED);
		team(recruiter, "잘못 연결된 팀", "ACTIVE", true);
		JsonNode response = body(mvc.perform(get("/api/v1/user/me/share-targets").cookie(cookie(recruiter))).andExpect(status().isOk()));
		assertThat(ids(response)).containsExactly(dm.getId());
		share(recruiter, dm, "PROFILE", recruiter.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		User dev = user("developer", UserType.DEVELOPER);
		ChatRoom team = team(dev, "활성 팀", "ACTIVE", true);
		share(dev, team, "PROFILE", dev.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		jdbc.update("update teams set status='READ_ONLY' where id=?", team.getTeamId());
		share(dev, team, "PROFILE", dev.getId(), UUID.randomUUID().toString()).andExpect(status().isForbidden());
		ChatRoom pending = direct(dev, named("대기"), DmStatus.REQUESTED);
		share(dev, pending, "PROFILE", dev.getId(), UUID.randomUUID().toString()).andExpect(status().isForbidden());
		share(recruiter, team, "PROFILE", recruiter.getId(), UUID.randomUUID().toString()).andExpect(status().isNotFound());
	}

	@Test
	void explicitCardsStoreOnlyReferencesAndResolveTheCurrentStateForEveryReader() throws Exception {
		User author = named("작성자");
		User sourceAuthor = named("원문 작성자");
		User reader = named("수신자");
		ChatRoom room = direct(author, reader, DmStatus.ACCEPTED);
		long post = postFixture(sourceAuthor);
		JsonNode sent = body(share(author, room, "POST", post, UUID.randomUUID().toString()).andExpect(status().isOk())
				.andExpect(jsonPath("$.payload.title").value("acme/demo"))
				.andExpect(jsonPath("$.payload.summary").value("새 작업물 · 원문 작성자")));
		long id = sent.path("id").asLong();
		JsonNode stored = JSON.readTree(messages.findById(id).orElseThrow().getPayload());
		assertThat(stored).isEqualTo(JSON.readTree("{\"targetType\":\"POST\",\"targetId\":" + post + "}"));
		block(reader, sourceAuthor);
		var transcript = chat.currentTranscript(reader.getId(), room.getId(), id);
		assertThat(transcript).isNotNull();
		assertThat(JSON.valueToTree(transcript).path("payload").path("available").asBoolean()).isFalse();
		assertThat(JSON.valueToTree(chat.currentTranscript(author.getId(), room.getId(), id)).path("payload").path("available").asBoolean()).isTrue();
		jdbc.update("update posts set visibility='HIDDEN' where id=?", post);
		mvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(author)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].payload.available").value(false))
				.andExpect(jsonPath("$.items[0].payload.title").value("볼 수 없는 게시물이에요"));
	}

	@Test
	void pastedLinksStoreTheFirstInternalReferenceIndependentlyFromExternalLinksAndUpdateOnEdit() throws Exception {
		User author = named("원문 작성자");
		User reader = named("친구");
		ChatRoom room = direct(author, reader, DmStatus.ACCEPTED);
		long post = postFixture(author);
		String clientId = UUID.randomUUID().toString();
		chat.sendMessage(author.getId(), room.getId(), Map.of("clientMessageId", clientId, "text",
				"https://outside.test/docs https://linker.test/posts/" + post + "?from=share https://linker.test/user/" + author.getUsername()));
		ChatMessage saved = messages.findBySenderIdAndClientMessageId(author.getId(), clientId).orElseThrow();
		assertThat(JSON.readTree(saved.getPayload())).isEqualTo(JSON.readTree("{\"linkerCard\":{\"targetType\":\"POST\",\"targetId\":" + post + "}}"));
		assertThat(JSON.valueToTree(chat.currentTranscript(reader.getId(), room.getId(), saved.getId())).path("payload").path("linkerCard").path("available").asBoolean()).isTrue();
		mvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + saved.getId()).cookie(cookie(author))
				.contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(Map.of("text", "https://linker.test/user/" + author.getUsername()))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.payload.linkerCard.linkPath").value("/user/" + author.getUsername()));
		String plain = "https://linker.test.evil/posts/" + post + " https://linker.test@evil.test/posts/" + post;
		mvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + saved.getId()).cookie(cookie(author))
				.contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(Map.of("text", plain))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.payload").doesNotExist());
	}

	@Test
	void repeatedAndConcurrentClientIdsCreateOneCardAndConflictingReusesAreRejected() throws Exception {
		User sender = user("retry", UserType.DEVELOPER);
		ChatRoom room = direct(sender, named("상대"), DmStatus.ACCEPTED);
		String clientId = UUID.randomUUID().toString();
		AuthenticatedUser principal = principal(sender);
		try (var pool = Executors.newFixedThreadPool(2)) {
			var first = pool.submit(() -> chat.shareCard(principal, room.getId(), new ShareChatCardRequest("PROFILE", sender.getId(), clientId)));
			var second = pool.submit(() -> chat.shareCard(principal, room.getId(), new ShareChatCardRequest("PROFILE", sender.getId(), clientId)));
			assertThat(first.get(10, TimeUnit.SECONDS).id()).isEqualTo(second.get(10, TimeUnit.SECONDS).id());
		}
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room.getId())).isEqualTo(1);
		share(sender, room, "PROFILE", sender.getId() + 1, clientId).andExpect(status().isConflict());
		ChatRoom other = direct(sender, named("다른 상대"), DmStatus.ACCEPTED);
		share(sender, other, "PROFILE", sender.getId(), clientId).andExpect(status().isConflict());
	}

	@Test
	void theEleventhShareInOneMinuteIsLimited() throws Exception {
		User sender = user("minute", UserType.DEVELOPER);
		ChatRoom room = direct(sender, named("상대"), DmStatus.ACCEPTED);
		Cookie cookie = cookie(sender);
		for (int n = 0; n < 10; n++) share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		verify(limiter, org.mockito.Mockito.atLeastOnce()).tryAcquire("chat.share", sender.getId(), 10, 60);
	}

	@Test
	void dailyLimitUsesTheKstDateAndResetsAtMidnight() throws Exception {
		doReturn(new RedisRateLimiter.Decision(true, 0)).when(limiter).tryAcquire(eq("chat.share"), anyLong(), anyInt(), anyInt());
		User sender = user("daily", UserType.RECRUITER);
		ChatRoom room = direct(sender, named("상대"), DmStatus.ACCEPTED);
		Cookie cookie = cookie(sender);
		for (int n = 0; n < 100; n++) share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isTooManyRequests());
		clock.now = Instant.parse("2026-11-08T15:00:00Z");
		share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		verify(limiter).tryAcquire("chat.share.day:2026-11-09", sender.getId(), 100, 86400);
	}

	@Test
	void badTargetsAndSuspendedAccountsCannotSend() throws Exception {
		User sender = user("validation", UserType.DEVELOPER);
		ChatRoom room = direct(sender, named("상대"), DmStatus.ACCEPTED);
		share(sender, room, "UNKNOWN", 1, UUID.randomUUID().toString()).andExpect(status().isBadRequest());
		share(sender, room, "POST", 0, UUID.randomUUID().toString()).andExpect(status().isBadRequest());
		share(sender, room, "POST", 1, "bad-id").andExpect(status().isBadRequest());
		Cookie cookie = cookie(sender);
		jdbc.update("update users set status='SUSPENDED' where id=?", sender.getId());
		share(cookie, room, "PROFILE", sender.getId(), UUID.randomUUID().toString())
				.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUSPENDED"));
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id=?", Long.class, room.getId())).isZero();
	}

	@Test
	void completedTeamsAllowBothExplicitSharesAndPastedLinkerCards() throws Exception {
		User sender = user("completed", UserType.DEVELOPER);
		ChatRoom room = team(sender, "완료 후 대화", "COMPLETED", true);
		share(sender, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		String clientId = UUID.randomUUID().toString();
		chat.sendMessage(sender.getId(), room.getId(), Map.of("clientMessageId", clientId, "text", "https://linker.test/user/" + sender.getUsername()));
		ChatMessage saved = messages.findBySenderIdAndClientMessageId(sender.getId(), clientId).orElseThrow();
		assertThat(JSON.valueToTree(chat.currentTranscript(sender.getId(), room.getId(), saved.getId())).path("payload").path("linkerCard").path("linkPath").asText())
				.isEqualTo("/user/" + sender.getUsername());
	}

	@Test
	void dailyQuotaCannotExpireInTheFractionalSecondBeforeMidnight() throws Exception {
		clock.now = Instant.parse("2026-11-08T14:59:49.500Z");
		User sender = user("fractional", UserType.DEVELOPER);
		ChatRoom room = direct(sender, named("상대"), DmStatus.ACCEPTED);
		share(sender, room, "PROFILE", sender.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
		verify(limiter).tryAcquire("chat.share.day:2026-11-08", sender.getId(), 100, 11);
	}

	private User user(String prefix, UserType type) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), type));
	}

	private User named(String name) {
		User user = user("dev", UserType.DEVELOPER);
		user.changeDisplayName(name);
		return users.saveAndFlush(user);
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	private AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(user.getId(), user.getUsername(), user.getUserType(), user.getStatus(), null, false, false, true, 1L);
	}

	private ChatRoom direct(User a, User b, DmStatus status) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(a.getId(), b.getId(), status, RequestKind.GENERAL, NOW.plusSeconds(3600)));
		members.saveAndFlush(ChatRoomMember.join(room, a.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, b.getId()));
		return room;
	}

	private ChatRoom team(User user, String name, String status, boolean current) {
		long id = TeamTestFixtures.team(jdbc, user.getId(), name, status);
		jdbc.update("insert into team_members(team_id,user_id,role,github_org_state,joined_at,left_at,created_at,updated_at) values (?,?,'OWNER','MEMBER',now(),?,now(),now())",
				id, user.getId(), current ? null : Timestamp.from(NOW));
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(id));
		members.saveAndFlush(ChatRoomMember.join(room, user.getId()));
		return room;
	}

	private void block(User a, User b) {
		jdbc.update("insert into user_blocks(blocker_id,blocked_id,created_at,updated_at) values (?,?,?,?)",
				a.getId(), b.getId(), Timestamp.from(NOW), Timestamp.from(NOW));
	}

	private long postFixture(User author) {
		List<Long> existing = jdbc.queryForList("select id from github_repos where full_name='acme/demo'", Long.class);
		long repo = existing.isEmpty() ? jdbc.queryForObject("insert into github_repos(github_repo_id,owner_login,name,full_name,created_at,updated_at) values (?,'acme','demo','acme/demo',now(),now()) returning id", Long.class, System.nanoTime()) : existing.getFirst();
		return jdbc.queryForObject("insert into posts(author_id,repo_id,summary,body,visibility,created_at,updated_at) values (?,?,'새 작업물','본문','VISIBLE',now(),now()) returning id", Long.class, author.getId(), repo);
	}
	private ResultActions share(User user, ChatRoom room, String type, long id, String clientId) throws Exception {
		return share(cookie(user), room, type, id, clientId);
	}

	private ResultActions share(Cookie cookie, ChatRoom room, String type, long id, String clientId) throws Exception {
		return mvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/share-cards").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
				.content(JSON.writeValueAsString(Map.of("targetType", type, "targetId", id, "clientMessageId", clientId))));
	}
	private JsonNode body(ResultActions result) throws Exception {
		return JSON.readTree(result.andReturn().getResponse().getContentAsString());
	}

	private List<Long> ids(JsonNode response) {
		return response.path("items").valueStream().map(node -> node.path("roomId").asLong()).toList();
	}
}
