package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.team.TeamRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.TeamSyncService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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

/** Page 17 against real team rows: the caller's team role, team-room leave, and the message row version. */
@SpringBootTest(properties = "spring.jpa.show-sql=false")
@AutoConfigureMockMvc
@Testcontainers
class ChatRoomTeamContractIntegrationTest {
	static final RsaMaterial KEYS = RsaMaterial.generate();
	@Container
	static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");
	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry r) {
		r.add("spring.datasource.url", PG::getJdbcUrl);
		r.add("spring.datasource.username", PG::getUsername);
		r.add("spring.datasource.password", PG::getPassword);
		r.add("spring.data.redis.host", REDIS::getHost);
		r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		r.add("linker.session.jwt-private-key", KEYS::privatePem);
		r.add("linker.session.jwt-public-key", KEYS::publicPem);
		r.add("linker.webhook.consumer-enabled", () -> "false");
		r.add("linker.issues.sync-enabled", () -> "false");
		r.add("linker.team-setup.worker-enabled", () -> "false");
	}

	@Autowired
	MockMvc mvc;
	@Autowired
	JdbcTemplate jdbc;
	@Autowired
	UserRepository users;
	@Autowired
	TeamRepository teams;
	@Autowired
	ChatMessageRepository messages;
	@Autowired
	AuthService sessions;
	@Autowired
	PlatformTransactionManager transactions;
	@MockitoBean
	GithubTeamSource github;
	@MockitoBean
	TeamSyncService sync;

	User owner;
	User admin;
	User member;
	long team;
	long room;

	@BeforeEach
	void seed() {
		owner = user();
		admin = user();
		member = user();
		long installation = 300000 + owner.getId();
		long org = 400000 + owner.getId();
		var created = new TransactionTemplate(transactions).execute(status -> teams.create(owner.getId(),
				new GithubInstallationView(installation, org, "org-" + org, null),
				new CreateTeamRequest("" + installation, "채팅 계약 팀", "팀 소개"), Instant.now()));
		team = created.id();
		room = created.chatRoomId();
		join(admin, "ADMIN");
		join(member, "MEMBER");
	}

	@Test
	void roomInfoCarriesTheCallersTeamRole() throws Exception {
		for (var expected : new Object[][] {{owner, "OWNER"}, {admin, "ADMIN"}, {member, "MEMBER"}}) {
			mvc.perform(get("/api/v1/user/chat-rooms/" + room).cookie(cookie((User) expected[0])))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.kind").value("TEAM"))
					.andExpect(jsonPath("$.title").value("채팅 계약 팀"))
					.andExpect(jsonPath("$.team.id").value(team))
					.andExpect(jsonPath("$.team.name").value("채팅 계약 팀"))
					.andExpect(jsonPath("$.team.status").value("ACTIVE"))
					.andExpect(jsonPath("$.team.myRole").value(expected[1]))
					.andExpect(jsonPath("$.team.plan").doesNotExist())
					.andExpect(jsonPath("$.members.length()").value(3))
					.andExpect(jsonPath("$.historyLimitDays").value(60));
		}
	}

	@Test
	void adminDeletesAnotherMembersMessageButAMemberCannot() throws Exception {
		long ownersMessage = message(owner, "소유자 메시지");
		long membersMessage = message(member, "팀원 메시지");

		mvc.perform(delete(item(ownersMessage)).cookie(cookie(member))).andExpect(status().isForbidden());
		mvc.perform(delete(item(membersMessage)).cookie(cookie(admin))).andExpect(status().isNoContent());

		assertThat(deletedAt(ownersMessage)).isNull();
		assertThat(deletedAt(membersMessage)).isNotNull();
	}

	@Test
	void aTeamRoomCannotBeLeftThroughTheChatEndpoint() throws Exception {
		mvc.perform(delete("/api/v1/user/chat-rooms/" + room + "/members/me").cookie(cookie(member)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		assertThat(jdbc.queryForObject(
				"select count(*) from chat_room_members where room_id=? and user_id=? and left_at is null",
				Long.class, room, member.getId())).isEqualTo(1);
	}

	@Test
	void everyChangeMovesUpdatedAtAndTheEditAnswerMatchesTheStoredRow() throws Exception {
		long id = message(member, "원문");
		Instant created = updatedAtOf(listed(member, id));

		String edited = mvc.perform(patch(item(id)).cookie(cookie(member))
						.contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"고친 글\"}"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		Instant afterEdit = Instant.parse(JsonPath.read(edited, "$.updatedAt"));
		assertThat(afterEdit).isAfter(created);
		// The PATCH answer is built before commit; the stored microsecond value must not be older.
		assertThat(updatedAtOf(listed(member, id))).isAfterOrEqualTo(afterEdit);
		assertThat(updatedAtOf(listed(member, id)).getNano() % 1000).isZero();

		mvc.perform(delete(item(id)).cookie(cookie(member))).andExpect(status().isNoContent());
		assertThat(updatedAtOf(listed(member, id))).isAfter(updatedAtOf(edited));
	}

	private String item(long messageId) {
		return "/api/v1/user/chat-rooms/" + room + "/messages/" + messageId;
	}

	private String listed(User viewer, long messageId) throws Exception {
		String body = mvc.perform(get("/api/v1/user/chat-rooms/" + room + "/messages").cookie(cookie(viewer)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		java.util.List<Object> rows = JsonPath.read(body, "$.items[?(@.id == " + messageId + ")]");
		assertThat(rows).hasSize(1);
		return com.jayway.jsonpath.Configuration.defaultConfiguration().jsonProvider().toJson(rows.getFirst());
	}

	private static Instant updatedAtOf(String json) {
		return Instant.parse(JsonPath.read(json, "$.updatedAt"));
	}

	private long message(User sender, String body) {
		return jdbc.queryForObject("insert into chat_messages(room_id,sender_id,message_type,body,visibility,created_at,updated_at)"
				+ " values (?,?,'TEXT',?,'VISIBLE',now(),now()) returning id", Long.class, room, sender.getId(), body);
	}

	private Instant deletedAt(long messageId) {
		var value = jdbc.queryForObject("select deleted_at from chat_messages where id=?", java.sql.Timestamp.class, messageId);
		return value == null ? null : value.toInstant();
	}

	private User user() {
		var user = User.create("p17-" + UUID.randomUUID().toString().substring(0, 12), UserType.DEVELOPER);
		user.completeOnboarding(Instant.now());
		return users.saveAndFlush(user);
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "p17-test", "127.0.0.1").rawToken());
	}

	private void join(User user, String role) {
		jdbc.update("insert into team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)"
				+ " values (?,?,?,'MEMBER',now(),now(),now())", team, user.getId(), role);
		jdbc.update("insert into chat_room_members(room_id,user_id,muted,joined_at,created_at,updated_at)"
				+ " values (?,?,false,now(),now(),now())", room, user.getId());
	}
}
