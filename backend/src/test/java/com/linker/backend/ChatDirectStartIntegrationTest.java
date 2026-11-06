package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.profile.Follow;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.support.TeamTestFixtures;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

/** POST /user/chat-rooms/direct (POL-C-4, Policy ch. 8 "1:1 chat request status"). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatDirectStartIntegrationTest {

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

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;
	@Autowired
	private FollowRepository follows;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;

	@Test
	void mutualFollowsOpenOneAcceptedRoomAndOneWayFollowDoesNot() throws Exception {
		User me = user("dm-mutual-me");
		User friend = user("dm-mutual-friend");
		User fan = user("dm-mutual-fan");
		follow(me, friend);
		follow(friend, me);
		follow(me, fan);

		long roomId = roomId(start(me, friend, null).andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("DIRECT")));
		long again = roomId(start(friend, me, null).andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("DIRECT")));

		assertThat(again).isEqualTo(roomId);
		assertThat(dmStatus(roomId)).isEqualTo("ACCEPTED");
		assertThat(members.findActiveUserIds(roomId)).containsExactlyInAnyOrder(me.getId(), friend.getId());
		assertThat(messageCount(roomId)).isZero();
		start(me, fan, null).andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.roomId").value(nullValue()));
	}

	@Test
	void currentTeammatesOpenARoomButLeftMembersAndDeletedTeamsDoNot() throws Exception {
		User me = user("dm-team-me");
		User mate = user("dm-team-mate");
		User former = user("dm-team-former");
		User deletedTeamMate = user("dm-team-deleted");
		long team = TeamTestFixtures.team(jdbc, me.getId(), "팀", "ACTIVE");
		joinTeam(team, me, "OWNER", false);
		joinTeam(team, mate, "MEMBER", false);
		joinTeam(team, former, "MEMBER", true);
		long gone = TeamTestFixtures.team(jdbc, me.getId(), "지운 팀", "DELETED");
		joinTeam(gone, me, "OWNER", false);
		joinTeam(gone, deletedTeamMate, "MEMBER", false);

		start(me, mate, null).andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("DIRECT"));
		start(me, former, null).andExpect(status().isOk()).andExpect(jsonPath("$.roomId").value(nullValue()));
		start(me, deletedTeamMate, null).andExpect(status().isOk()).andExpect(jsonPath("$.roomId").value(nullValue()));
	}

	@Test
	void requestStoresOnlyTheFirstMessageAndNotifiesTheRecipientOnce() throws Exception {
		User me = user("dm-req-me");
		User them = user("dm-req-them");

		start(me, them, "   ").andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.roomId").value(nullValue()));
		assertThat(roomCount(dmKey(me, them))).isZero();

		long roomId = roomId(start(me, them, "안녕하세요, 같이 해요").andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST")));
		long again = roomId(start(me, them, "두 번째 메시지").andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST")));
		long reverse = roomId(start(them, me, "반대쪽 메시지").andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST")));

		assertThat(again).isEqualTo(roomId);
		assertThat(reverse).isEqualTo(roomId);
		assertThat(dmStatus(roomId)).isEqualTo("REQUESTED");
		assertThat(bodies(roomId)).containsExactly("안녕하세요, 같이 해요");
		assertThat(requester(roomId)).isEqualTo(me.getId());
		Instant expires = instant("select request_expires_at from chat_rooms where id = ?", roomId);
		assertThat(expires).isBetween(
				Instant.now().plus(Duration.ofDays(PlanLimits.CHAT_REQUEST_DAYS)).minusSeconds(120),
				Instant.now().plus(Duration.ofDays(PlanLimits.CHAT_REQUEST_DAYS)).plusSeconds(120));
		assertThat(requestNotifications(them)).isEqualTo(1);
		assertThat(requestNotifications(me)).isZero();
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + roomId).cookie(cookie(them)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.requestDirection").value("RECEIVED"));
	}

	@Test
	void rejectionStaysHiddenFromTheSenderForThirtyDaysThenANewRequestReopensTheRoom() throws Exception {
		User me = user("dm-rej-me");
		User them = user("dm-rej-them");
		long roomId = roomId(start(me, them, "첫 요청"));
		mockMvc.perform(delete("/api/v1/user/chat-requests/" + roomId).cookie(cookie(them)))
				.andExpect(status().isNoContent());

		start(me, them, "다시 보내 봐요").andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.roomId").value(roomId));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + roomId).cookie(cookie(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.requestDirection").value("SENT"));
		assertThat(dmStatus(roomId)).isEqualTo("REJECTED");
		assertThat(bodies(roomId)).containsExactly("첫 요청");
		assertThat(requestNotifications(them)).isEqualTo(1);

		jdbc.update("update chat_rooms set responded_at = ? where id = ?",
				Timestamp.from(Instant.now().minus(Duration.ofDays(PlanLimits.CHAT_REQUEST_DAYS)).minusSeconds(60)), roomId);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + roomId).cookie(cookie(me)))
				.andExpect(status().isNotFound());
		long reopened = roomId(start(me, them, "한 달 뒤 요청").andExpect(jsonPath("$.kind").value("REQUEST")));

		assertThat(reopened).isEqualTo(roomId);
		assertThat(dmStatus(roomId)).isEqualTo("REQUESTED");
		assertThat(bodies(roomId)).containsExactly("첫 요청", "한 달 뒤 요청");
		assertThat(requestNotifications(them)).isEqualTo(2);
	}

	@Test
	void theRecipientWhoRejectedAndAnExpiredRequestCanBothStartAgainImmediately() throws Exception {
		User me = user("dm-again-me");
		User them = user("dm-again-them");
		long roomId = roomId(start(me, them, "요청"));
		mockMvc.perform(delete("/api/v1/user/chat-requests/" + roomId).cookie(cookie(them)))
				.andExpect(status().isNoContent());

		roomId(start(them, me, "제가 다시 보낼게요").andExpect(jsonPath("$.roomId").value(roomId)));
		assertThat(dmStatus(roomId)).isEqualTo("REQUESTED");
		assertThat(requester(roomId)).isEqualTo(them.getId());

		jdbc.update("update chat_rooms set request_expires_at = ? where id = ?",
				Timestamp.from(Instant.now().minusSeconds(60)), roomId);
		roomId(start(me, them, "만료 뒤 요청").andExpect(jsonPath("$.roomId").value(roomId)));
		assertThat(requester(roomId)).isEqualTo(me.getId());
		assertThat(bodies(roomId)).containsExactly("요청", "제가 다시 보낼게요", "만료 뒤 요청");
	}

	@Test
	void becomingMutualFollowsTurnsAnOldRequestIntoAnOpenRoomAndBringsLeftMembersBack() throws Exception {
		User me = user("dm-up-me");
		User them = user("dm-up-them");
		long roomId = roomId(start(me, them, "요청"));
		follow(me, them);
		follow(them, me);

		start(them, me, null).andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("DIRECT"))
				.andExpect(jsonPath("$.roomId").value(roomId));
		assertThat(dmStatus(roomId)).isEqualTo("ACCEPTED");

		jdbc.update("update chat_room_members set left_at = now() where room_id = ? and user_id = ?", roomId, them.getId());
		start(me, them, null).andExpect(jsonPath("$.kind").value("DIRECT"));
		assertThat(members.findActiveUserIds(roomId)).containsExactlyInAnyOrder(me.getId(), them.getId());
	}

	@Test
	void anOpenRoomStaysOpenAfterTheFollowEndsUnlessTheOtherPersonLeft() throws Exception {
		User me = user("dm-keep-me");
		User them = user("dm-keep-them");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(me.getId(), them.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
		members.saveAndFlush(ChatRoomMember.join(room, me.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, them.getId()));
		jdbc.update("update chat_room_members set left_at = now() where room_id = ? and user_id = ?", room.getId(), me.getId());

		start(me, them, null).andExpect(jsonPath("$.kind").value("DIRECT"))
				.andExpect(jsonPath("$.roomId").value(room.getId()));
		assertThat(members.findActiveUserIds(room.getId())).containsExactlyInAnyOrder(me.getId(), them.getId());

		jdbc.update("update chat_room_members set left_at = now() where room_id = ? and user_id = ?", room.getId(), them.getId());
		start(me, them, null).andExpect(jsonPath("$.roomId").value(nullValue()));
		start(me, them, "다시 이야기해요").andExpect(jsonPath("$.kind").value("REQUEST"))
				.andExpect(jsonPath("$.roomId").value(room.getId()));
		assertThat(dmStatus(room.getId())).isEqualTo("REQUESTED");
		assertThat(members.findActiveUserIds(room.getId())).containsExactlyInAnyOrder(me.getId(), them.getId());
	}

	@Test
	void invalidTargetsAndCallersAreRejectedWithoutCreatingRooms() throws Exception {
		User me = user("dm-bad-me");
		User recruiter = users.saveAndFlush(User.create("dm-bad-recruiter-" + System.nanoTime(), UserType.RECRUITER));
		User deleted = user("dm-bad-deleted");
		jdbc.update("update users set status = 'DELETED', deleted_at = now() where id = ?", deleted.getId());
		User blockedByMe = user("dm-bad-blocked");
		User blocksMe = user("dm-bad-blocker");
		block(me, blockedByMe);
		block(blocksMe, me);
		User other = user("dm-bad-other");

		start(me, me, "나").andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/v1/user/chat-rooms/direct").contentType(MediaType.APPLICATION_JSON)
				.content("{}").cookie(cookie(me))).andExpect(status().isBadRequest());
		start(me, recruiter, "채용 담당자").andExpect(status().isNotFound());
		start(me, deleted, "탈퇴").andExpect(status().isNotFound());
		start(me, blockedByMe, "차단").andExpect(status().isNotFound());
		start(me, blocksMe, "차단당함").andExpect(status().isNotFound());
		startById(me, Long.MAX_VALUE, "없음").andExpect(status().isNotFound());
		start(me, other, "가".repeat(PlanLimits.CHAT_MESSAGE_MAX_CHARS + 1)).andExpect(status().isBadRequest());
		start(recruiter, other, "채용 제안").andExpect(status().isForbidden());

		for (User target : List.of(recruiter, deleted, blockedByMe, blocksMe, other)) {
			assertThat(roomCount(dmKey(me, target))).isZero();
		}
	}

	private ResultActions start(User caller, User target, String message) throws Exception {
		return startById(caller, target.getId(), message);
	}

	private ResultActions startById(User caller, long targetId, String message) throws Exception {
		String body = message == null
				? "{\"userId\":" + targetId + "}"
				: "{\"userId\":" + targetId + ",\"message\":" + JSON.writeValueAsString(message) + "}";
		return mockMvc.perform(post("/api/v1/user/chat-rooms/direct")
				.contentType(MediaType.APPLICATION_JSON)
				.content(body)
				.cookie(cookie(caller)));
	}

	private static long roomId(ResultActions result) throws Exception {
		return JSON.readTree(result.andReturn().getResponse().getContentAsString()).path("roomId").asLong();
	}

	private String dmStatus(long roomId) {
		return jdbc.queryForObject("select dm_status from chat_rooms where id = ?", String.class, roomId);
	}

	private long requester(long roomId) {
		return jdbc.queryForObject("select requester_id from chat_rooms where id = ?", Long.class, roomId);
	}

	private long roomCount(String dmKey) {
		return jdbc.queryForObject("select count(*) from chat_rooms where dm_key = ?", Long.class, dmKey);
	}

	private long messageCount(long roomId) {
		return jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, roomId);
	}

	private List<String> bodies(long roomId) {
		return jdbc.queryForList("select body from chat_messages where room_id = ? order by id", String.class, roomId);
	}

	private long requestNotifications(User recipient) {
		return jdbc.queryForObject(
				"select count(*) from notifications where user_id = ? and notification_type = 'MESSAGE_REQUEST'",
				Long.class, recipient.getId());
	}

	private Instant instant(String sql, Object... args) {
		return jdbc.queryForObject(sql, Timestamp.class, args).toInstant();
	}

	private static String dmKey(User a, User b) {
		return Math.min(a.getId(), b.getId()) + ":" + Math.max(a.getId(), b.getId());
	}

	private void follow(User follower, User following) {
		follows.saveAndFlush(Follow.link(follower, following));
	}

	private void block(User blocker, User blocked) {
		jdbc.update("""
				insert into user_blocks (blocker_id, blocked_id, created_at, updated_at) values (?, ?, now(), now())
				""", blocker.getId(), blocked.getId());
	}

	private void joinTeam(long teamId, User user, String role, boolean left) {
		jdbc.update("""
				insert into team_members(team_id,user_id,role,github_org_state,joined_at,left_at,leave_type,created_at,updated_at)
				values (?,?,?,'MEMBER',now(),?,?,now(),now())
				""", teamId, user.getId(), role, left ? Timestamp.from(Instant.now()) : null, left ? "LEFT" : null);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
