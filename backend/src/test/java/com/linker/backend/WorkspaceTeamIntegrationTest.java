package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

/** Test-only ERD fixtures; never connects to the shared server or a developer's local DB. */
@SpringBootTest
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class WorkspaceTeamIntegrationTest {
	static final RsaMaterial KEYS = RsaMaterial.generate();
	@Container static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");
	@Container static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
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
		registry.add("linker.issues.sync-enabled", () -> "false");
		registry.add("linker.issues.webhook-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@Autowired MockMvc mvc;
	@Autowired JdbcTemplate jdbc;
	@Autowired DataSource dataSource;
	@Autowired UserRepository users;
	@Autowired AuthService sessions;
	@Autowired ObjectMapper json;
	int org;

	@BeforeEach
	void clean() {
		// B team tables now come from Flyway V20; only C's issue schema remains prepared.
		if (Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('public.issues') is null", Boolean.class))) {
			new ResourceDatabasePopulator(new ClassPathResource("db/issue-schema/issue-cache.sql")).execute(dataSource);
		}
		jdbc.execute("TRUNCATE users, github_repos RESTART IDENTITY CASCADE");
		org = 100;
	}

	@Test
	void returnsOnlyCurrentOwnTeamsAndAccurateCountsInStableMembershipOrder() throws Exception {
		User me = user("member");
		User other = user("other");
		long active = team(me, "ACTIVE");
		join(active, me, "OWNER", "2026-11-03T00:00:00Z", false);
		join(active, other, "MEMBER", "2026-11-01T00:00:00Z", false);
		join(active, user("former"), "MEMBER", "2026-10-01T00:00:00Z", true);
		long readOnly = team(me, "READ_ONLY");
		join(readOnly, me, "ADMIN", "2026-11-02T00:00:00Z", false);
		long completed = team(me, "COMPLETED");
		join(completed, me, "MEMBER", "2026-11-01T00:00:00Z", false);
		long archived = team(me, "ARCHIVED");
		join(archived, me, "MEMBER", "2026-11-05T00:00:00Z", false);
		join(team(other, "ACTIVE"), other, "OWNER", "2026-11-05T00:00:00Z", false);
		join(team(me, "ACTIVE"), me, "MEMBER", "2026-11-04T00:00:00Z", true);
		join(team(me, "DELETED"), me, "MEMBER", "2026-11-04T00:00:00Z", false);

		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(jsonPath("$.items.length()").value(4))
				.andExpect(jsonPath("$.items[0].id").value(active))
				.andExpect(jsonPath("$.items[0].memberCount").value(2))
				.andExpect(jsonPath("$.items[0].myRole").value("OWNER"))
				.andExpect(jsonPath("$.items[1].id").value(readOnly))
				.andExpect(jsonPath("$.items[1].myRole").value("ADMIN"))
				.andExpect(jsonPath("$.items[2].id").value(completed))
				.andExpect(jsonPath("$.items[3].id").value(archived))
				.andExpect(jsonPath("$.items[3].joinedAt").value("2026-11-05T00:00:00Z"))
				.andExpect(jsonPath("$.teamCount").value(3)).andExpect(jsonPath("$.teamLimit").value(10));
	}

	@Test
	void anEmptyMembershipReturnsAnEmptyListNotAnError() throws Exception {
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(user("empty"))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty())
				.andExpect(jsonPath("$.teamCount").value(0)).andExpect(jsonPath("$.teamLimit").value(10));
	}

	@Test
	void guestAndRecruiterAreDenied() throws Exception {
		mvc.perform(get("/api/v1/user/me/teams")).andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
		User recruiter = users.saveAndFlush(User.create("recruiter", UserType.RECRUITER));
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(recruiter)))
				.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
	}

	@Test
	void operatorRegistrationDoesNotGrantOtherTeams() throws Exception {
		User operator = user("operator");
		jdbc.update("insert into admins(user_id,admin_role,created_at,updated_at) values (?,'OPERATOR',now(),now())", operator.getId());
		User other = user("outsider");
		join(team(other, "ACTIVE"), other, "OWNER", "2026-11-01T00:00:00Z", false);
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(operator)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
	}

	@Test
	void suspensionStillAllowsTheExistingReadOnlyAccountContract() throws Exception {
		User me = user("suspended");
		Cookie cookie = cookie(me);
		jdbc.update("update users set status='SUSPENDED' where id=?", me.getId());
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie)).andExpect(status().isOk());
	}

	@ParameterizedTest
	@ValueSource(ints = {10, 11})
	void theParticipationCapDoesNotBlockReadingAndArchivedTeamsDoNotConsumeIt(int counted) throws Exception {
		User me = user("manyteams");
		for (int i = 0; i < counted + 2; i++) {
			join(team(me, i < 2 ? "ARCHIVED" : "COMPLETED"), me, "OWNER", "2026-11-01T00:00:00Z", false);
		}
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(counted + 2))
				.andExpect(jsonPath("$.teamCount").value(counted)).andExpect(jsonPath("$.teamLimit").value(10));
	}

	@Test
	void rejoiningPreservesHistoryAndDoesNotDuplicateCurrentMembership() throws Exception {
		User me = user("rejoin");
		long team = team(me, "ACTIVE");
		join(team, me, "MEMBER", "2026-10-01T00:00:00Z", true);
		join(team, me, "ADMIN", "2026-11-01T00:00:00Z", false);
		assertThatThrownBy(() -> join(team, me, "MEMBER", "2026-11-02T00:00:00Z", false))
				.isInstanceOf(DataIntegrityViolationException.class);
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].memberCount").value(1))
				.andExpect(jsonPath("$.items[0].myRole").value("ADMIN"));
		assertThat(jdbc.queryForObject("select count(*) from team_members where user_id=?", Long.class, me.getId())).isEqualTo(2);
	}

	@Test
	void preparedTeamSchemaAttachesTheExistingChatTableWithoutRecreatingIt() {
		User me = user("schema");
		long team = team(me, "ACTIVE");
		assertThat(room(team, me)).isPositive();
		assertThatThrownBy(() -> jdbc.update("""
				insert into chat_rooms(room_type,team_id,created_at,updated_at)
				values ('TEAM',999999,now(),now())
				""")).isInstanceOf(DataIntegrityViolationException.class);
		assertThat(jdbc.queryForList("select version from flyway_schema_history where success", String.class))
				.contains("4", "10", "11", "12", "13", "14").doesNotHaveDuplicates();
		assertThat(jdbc.queryForObject("select script from flyway_schema_history where version = '4' and success", String.class))
				.isEqualTo("V4__github_social_login.sql");
		assertThat(jdbc.queryForObject("select script from flyway_schema_history where version = '10' and success", String.class))
				.isEqualTo("V10__chat_message_edited_at.sql");
		assertThat(jdbc.queryForObject("select script from flyway_schema_history where version = '11' and success", String.class))
				.isEqualTo("V11__recruit_list.sql");
		assertThat(jdbc.queryForObject("select script from flyway_schema_history where version = '12' and success", String.class))
				.isEqualTo("V12__post_editor.sql");
		assertThat(jdbc.queryForObject("""
				select count(*) from information_schema.columns
				where table_name='chat_messages' and column_name in ('client_message_id','edited_at')
				""", Long.class)).isEqualTo(2);
	}

	@Test
	void chatShortcutRequiresTheActualTeamRoomAndCurrentRoomMembership() throws Exception {
		User me = user("chat");
		long team = team(me, "ARCHIVED");
		join(team, me, "OWNER", "2026-11-01T00:00:00Z", false);
		Long room = jdbc.queryForObject("insert into chat_rooms(room_type,team_id,created_at,updated_at) values ('TEAM',?,now(),now()) returning id", Long.class, team);
		assertUnknownChat(me);
		jdbc.update("insert into chat_room_members(room_id,user_id,joined_at,created_at,updated_at) values (?,?,now(),now(),now())", room, me.getId());
		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].chatRoomId").value(room))
				.andExpect(jsonPath("$.items[0].unreadCount").value(0));
		jdbc.update("update chat_room_members set hidden_at=now() where room_id=? and user_id=?", room, me.getId());
		assertUnknownChat(me);
		jdbc.update("update chat_room_members set hidden_at=null where room_id=? and user_id=?", room, me.getId());
		jdbc.update("update chat_room_members set left_at=now() where room_id=? and user_id=?", room, me.getId());
		assertUnknownChat(me);
	}

	@Test
	void unreadMatchesTheMergedChatContractIncludingPlaceholdersAndTheTeamBlockException() throws Exception {
		User me = user("unread");
		User other = user("sender");
		long team = team(me, "ACTIVE");
		join(team, me, "MEMBER", "2026-11-01T00:00:00Z", false);
		long room = room(team, me);
		long read = message(room, other.getId(), "VISIBLE");
		jdbc.update("update chat_room_members set last_read_message_id=?,muted=true where room_id=? and user_id=?", read, room, me.getId());
		message(room, me.getId(), "VISIBLE"); // Own messages are never unread.
		long old = message(room, other.getId(), "VISIBLE");
		jdbc.update("update chat_messages set created_at=now()-interval '90 days' where id=?", old);
		message(room, other.getId(), "VISIBLE");
		message(room, null, "VISIBLE"); // System messages count.
		message(room, other.getId(), "HIDDEN");
		long deleted = message(room, other.getId(), "VISIBLE");
		jdbc.update("update chat_messages set deleted_at=now() where id=?", deleted);
		jdbc.update("insert into user_blocks(blocker_id,blocked_id,created_at,updated_at) values (?,?,now()-interval '100 days',now())", me.getId(), other.getId());
		Cookie session = cookie(me);
		mvc.perform(get("/api/v1/user/me/teams").cookie(session))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].unreadCount").value(5));
		// Exercise D's real services too, so a later contract change cannot silently diverge.
		mvc.perform(get("/api/v1/user/chat-rooms").param("tab", "TEAM").cookie(session))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(room))
				.andExpect(jsonPath("$.items[0].unreadCount").value(5));
		mvc.perform(get("/api/v1/user/chat-rooms/unread-summary").cookie(session))
				.andExpect(status().isOk()).andExpect(jsonPath("$.TEAM").value(5));
	}

	@Test
	void readingThroughTheRealChatApiUpdatesOnlyThatTeamsUnreadCount() throws Exception {
		User me = user("reader");
		User other = user("writer");
		long first = team(me, "ACTIVE");
		join(first, me, "OWNER", "2026-11-02T00:00:00Z", false);
		long firstRoom = room(first, me);
		long read = message(firstRoom, other.getId(), "VISIBLE");
		long second = team(me, "ACTIVE");
		join(second, me, "MEMBER", "2026-11-01T00:00:00Z", false);
		message(room(second, me), other.getId(), "VISIBLE");
		Cookie session = cookie(me);
		mvc.perform(get("/api/v1/user/me/teams").cookie(session))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].unreadCount").value(1))
				.andExpect(jsonPath("$.items[1].unreadCount").value(1));
		mvc.perform(post("/api/v1/user/chat-rooms/{room}/read", firstRoom).cookie(session)
				.contentType(MediaType.APPLICATION_JSON).content("{\"lastReadMessageId\":" + read + "}"))
				.andExpect(status().isNoContent());
		mvc.perform(get("/api/v1/user/me/teams").cookie(session))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items[0].unreadCount").value(0))
				.andExpect(jsonPath("$.items[1].unreadCount").value(1));
	}

	@Test
	void unconnectedIssueAndPlanMetricsNeverBecomeFakeZeroOrFree() throws Exception {
		User me = user("partial");
		join(team(me, "ACTIVE"), me, "OWNER", "2026-11-01T00:00:00Z", false);
		var result = mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andReturn();
		var item = json.readTree(result.getResponse().getContentAsString()).path("items").get(0);
		for (String key : new String[]{"plan", "openIssueCount", "unreadCount", "chatRoomId"}) {
			assertThat(item.has(key)).isTrue();
			assertThat(item.path(key).isNull()).isTrue();
		}
	}

	@Test
	void openIssueSummaryUsesCsLinkedRepositoryAndDeletionScope() throws Exception {
		User me = user("issueviewer");
		long mine = team(me, "ACTIVE");
		join(mine, me, "OWNER", "2026-11-01T00:00:00Z", false);
		long linked = repo(mine, me, true);
		issue(mine, linked, "OPEN", false);
		long boardDone = issue(mine, linked, "OPEN", false);
		jdbc.update("update issues set board_status='DONE' where id=?", boardDone);
		issue(mine, linked, "CLOSED", false);
		issue(mine, linked, "OPEN", true);
		issue(mine, repo(mine, me, false), "OPEN", false);
		long removed = repo(mine, me, true);
		issue(mine, removed, "OPEN", false);
		jdbc.update("update github_repos set deleted_at=now() where id=?", removed);
		User outsider = user("foreign");
		long foreign = team(outsider, "ACTIVE");
		issue(foreign, repo(foreign, outsider, true), "OPEN", false);

		mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].openIssueCount").value(2));
	}

	@Test
	void missingIssueSchemaAndUnconfirmedZeroRemainUnknownWithoutHidingTeams() throws Exception {
		User me = user("emptycache");
		long team = team(me, "ACTIVE");
		join(team, me, "MEMBER", "2026-11-01T00:00:00Z", false);
		long repo = repo(team, me, true);
		assertUnknownIssues(me); // Empty table does not prove a successful full sync.
		issue(team, repo, "CLOSED", false);
		assertUnknownIssues(me); // Partial updates also do not prove zero remaining open issues.
		issue(team, repo, "OPEN", false);
		jdbc.execute("alter table issues rename to temporarily_missing_issues");
		try { assertUnknownIssues(me); }
		finally { jdbc.execute("alter table temporarily_missing_issues rename to issues"); }
	}

	@Test
	void missingProductionMigrationIsUnavailableRatherThanAnEmptyWorkspace() throws Exception {
		User me = user("notready");
		jdbc.execute("alter table teams rename to temporarily_missing_teams");
		try {
			mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
					.andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
		}
		finally { jdbc.execute("alter table temporarily_missing_teams rename to teams"); }
	}

	@Test
	void publishesThePageContractWithoutChangingCommonTags() throws Exception {
		var result = mvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/user/me/teams'].get.tags[0]").value("p07-workspace"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/teams'].get.operationId").value("getMyTeams"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me'].get.tags[0]").value("p00-common"))
				.andExpect(jsonPath("$.components.schemas.TeamItem.properties.joinedAt").exists()).andReturn();
		var planSchema = json.readTree(result.getResponse().getContentAsString())
				.path("components").path("schemas").path("TeamItem").path("properties").path("plan");
		assertThat(planSchema.path("type").toString()).contains("null");
		// An enum omitting null would contradict the nullable JSON Schema type.
		assertThat(planSchema.has("enum")).isFalse();
		var schemas = json.readTree(result.getResponse().getContentAsString()).path("components").path("schemas");
		assertThat(schemas.path("MyTeamsResponse").path("required").toString())
				.contains("\"items\"", "\"teamLimit\"", "\"teamCount\"", "\"nextCursor\"");
		assertThat(schemas.path("TeamItem").path("required").size()).isEqualTo(11);
		Files.createDirectories(Path.of("build"));
		Files.writeString(Path.of("build/workspace-openapi.json"), result.getResponse().getContentAsString());
	}

	private void assertUnknownChat(User me) throws Exception {
		var result = mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me))).andExpect(status().isOk()).andReturn();
		assertThat(json.readTree(result.getResponse().getContentAsString()).path("items").get(0).path("chatRoomId").isNull()).isTrue();
		assertThat(json.readTree(result.getResponse().getContentAsString()).path("items").get(0).path("unreadCount").isNull()).isTrue();
	}
	private void assertUnknownIssues(User me) throws Exception {
		var result = mvc.perform(get("/api/v1/user/me/teams").cookie(cookie(me)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1)).andReturn();
		var item = json.readTree(result.getResponse().getContentAsString()).path("items").get(0);
		assertThat(item.has("openIssueCount")).isTrue();
		assertThat(item.path("openIssueCount").isNull()).isTrue();
	}
	private long repo(long team, User owner, boolean connected) {
		long githubRepoId = org++;
		String name = "test-repo-" + githubRepoId;
		long id = jdbc.queryForObject("""
				insert into github_repos(github_repo_id,owner_login,name,full_name,created_at,updated_at)
				values (?,'acme',?,?,now(),now()) returning id
				""", Long.class, githubRepoId, name, "acme/" + name);
		if (connected) {
			jdbc.update("insert into team_repos(team_id,repo_id,connected_by,created_at,updated_at) values (?,?,?,now(),now())", team, id, owner.getId());
		}
		return id;
	}
	private long issue(long team, long repo, String state, boolean deleted) {
		int number = org++;
		return jdbc.queryForObject("""
				insert into issues(team_id,repo_id,github_issue_id,github_node_id,number,title,state,board_status,github_updated_at,synced_at,deleted_at)
				values (?,?,?,?,?,'테스트 이슈',?,'TODO',now(),now(),?) returning id
				""", Long.class, team, repo, number, "I_" + number, number, state,
				deleted ? Timestamp.from(Instant.now()) : null);
	}

	private long room(long team, User me) {
		long room = jdbc.queryForObject("insert into chat_rooms(room_type,team_id,created_at,updated_at) values ('TEAM',?,now(),now()) returning id", Long.class, team);
		jdbc.update("insert into chat_room_members(room_id,user_id,joined_at,created_at,updated_at) values (?,?,now(),now(),now())", room, me.getId());
		return room;
	}
	private long message(long room, Long sender, String visibility) {
		return jdbc.queryForObject("""
				insert into chat_messages(room_id,sender_id,message_type,body,visibility,created_at,updated_at)
				values (?,?,'TEXT','메시지',?,now(),now()) returning id
				""", Long.class, room, sender, visibility);
	}

	private User user(String name) { return users.saveAndFlush(User.create(name, UserType.DEVELOPER)); }
	private Cookie cookie(User user) { return new Cookie("linker_session", sessions.issue(user, "workspace-test", "127.0.0.1").rawToken()); }
	private long team(User creator, String status) {
		long orgId = org++;
		Long installation = jdbc.queryForObject("""
				insert into github_installations(github_installation_id,account_id,account_login,account_type,repository_selection,installed_by,created_at,updated_at)
				values (?,?,'test-org','Organization','ALL',?,now(),now()) returning id
				""", Long.class, orgId, orgId, creator.getId());
		return jdbc.queryForObject("""
				insert into teams(installation_id,github_org_id,github_org_login,name,status,created_by,created_at,updated_at)
				values (?,?,'test-org','테스트 팀',?,?,now(),now()) returning id
				""", Long.class, installation, orgId, status, creator.getId());
	}
	private void join(long team, User user, String role, String joinedAt, boolean left) {
		jdbc.update("""
				insert into team_members(team_id,user_id,role,github_org_state,joined_at,left_at,leave_type,created_at,updated_at)
				values (?,?,?,'MEMBER',?,?,?,now(),now())
				""", team, user.getId(), role, Timestamp.from(Instant.parse(joinedAt)),
				left ? Timestamp.from(Instant.parse("2026-11-04T00:00:00Z")) : null, left ? "LEFT" : null);
	}
}
