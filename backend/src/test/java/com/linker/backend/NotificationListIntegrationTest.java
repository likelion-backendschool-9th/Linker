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

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.moderation.Admin;
import com.linker.backend.entity.moderation.type.AdminRole;
import com.linker.backend.entity.moderation.Sanction;
import com.linker.backend.entity.moderation.type.SanctionType;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.SanctionRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.ModerationService;
import com.linker.backend.service.user.NotificationService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class NotificationListIntegrationTest {

	private static final Instant NOW = Instant.parse("2026-11-05T14:30:00Z");
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

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AdminRepository admins;
	@Autowired
	private SanctionRepository sanctions;
	@Autowired
	private AuthService sessions;
	@Autowired
	private NotificationService notifications;
	@Autowired
	private ModerationService moderation;

	@Test
	void listShowsOnlyVisibleOwnRowsAndReadAllSkipsFutureOnes() throws Exception {
		assertThat(jdbc.queryForObject(
				"select count(*) from information_schema.columns where table_name = 'notifications' and column_name in ('title', 'body')",
				Integer.class
		)).isZero();

		User me = user("notice");
		User other = user("notice-other");
		Admin operator = admins.saveAndFlush(Admin.assign(user("notice-ops"), AdminRole.OPERATOR));
		Sanction mine = sanctions.saveAndFlush(Sanction.issue(me, SanctionType.WARNING, operator, NOW));
		Sanction theirs = sanctions.saveAndFlush(Sanction.issue(other, SanctionType.WARNING, operator, NOW));

		Notification hidden = notifications.create(command(me, "TEAM_INVITE", "{\"message\":\"내일 아침\"}", null));
		Notification foreign = notifications.create(command(other, "CHAT", "{\"message\":\"타인\"}", null));
		List<Notification> mineRows = new ArrayList<>();
		mineRows.add(notifications.create(command(me, "CHAT", "{\"sanctionId\":" + mine.getId() + "}", null)));
		mineRows.add(notifications.create(command(me, "CHAT", "{\"message\":\"알림 내용\"}", null)));
		mineRows.add(notifications.create(command(me, "CHAT", "{\"title\":\"제목\",\"message\":\"무시\",\"body\":\"본문\",\"reason\":\"무시\"}", "/invite/abc")));
		mineRows.add(notifications.create(command(me, "CHAT", null, null)));
		mineRows.add(notifications.create(command(me, "CHAT", "{\"sanctionId\":\"" + mine.getId() + "\"}", null)));
		mineRows.add(notifications.create(command(me, "CHAT", "{\"sanctionId\":" + theirs.getId() + "}", null)));
		for (int i = 0; i < 15; i++) {
			mineRows.add(notifications.create(command(me, "CHAT", null, null)));
		}
		for (int i = 0; i < mineRows.size(); i++) {
			jdbc.update(
					"update notifications set created_at = ? where id = ?",
					Timestamp.from(NOW.minusSeconds(i)),
					mineRows.get(i).getId()
			);
		}

		assertThat(count(me)).isEqualTo(21);
		MvcResult first = mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(20))
				.andExpect(jsonPath("$.items[0].id").value(mineRows.get(0).getId()))
				.andExpect(jsonPath("$.items[0].type").value("CHAT"))
				.andExpect(jsonPath("$.items[0].appeal.sanctionId").value(mine.getId()))
				.andExpect(jsonPath("$.items[0].appeal.submitted").value(false))
				.andExpect(jsonPath("$.items[1].title").value("알림 내용"))
				.andExpect(jsonPath("$.items[1].body").value(nullValue()))
				.andExpect(jsonPath("$.items[1].targetUrl").value(""))
				.andExpect(jsonPath("$.items[1].read").value(false))
				.andExpect(jsonPath("$.items[2].title").value("제목"))
				.andExpect(jsonPath("$.items[2].body").value("본문"))
				.andExpect(jsonPath("$.items[2].targetUrl").value("/invite/abc"))
				.andExpect(jsonPath("$.items[3].title").value("CHAT"))
				.andExpect(jsonPath("$.items[3].body").value(nullValue()))
				.andExpect(jsonPath("$.items[4].appeal").value(nullValue()))
				.andExpect(jsonPath("$.items[5].appeal").value(nullValue()))
				.andReturn();
		String cursor = com.jayway.jsonpath.JsonPath.read(first.getResponse().getContentAsString(), "$.nextCursor");
		mockMvc.perform(get("/api/v1/user/notifications").param("cursor", cursor).cookie(cookie(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].id").value(mineRows.get(mineRows.size() - 1).getId()))
				.andExpect(jsonPath("$.nextCursor").value(nullValue()))
				.andExpect(jsonPath("$.items[?(@.id == " + hidden.getId() + ")]").isEmpty())
				.andExpect(jsonPath("$.items[?(@.id == " + foreign.getId() + ")]").isEmpty());
		mockMvc.perform(get("/api/v1/user/notifications").param("cursor", "%%%").cookie(cookie(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		String foreignCursor = Base64.getUrlEncoder().withoutPadding().encodeToString(
				("1:" + other.getId() + ":" + NOW.getEpochSecond() + ".0:" + foreign.getId()).getBytes(StandardCharsets.UTF_8)
		);
		mockMvc.perform(get("/api/v1/user/notifications").param("cursor", foreignCursor).cookie(cookie(me)))
				.andExpect(status().isBadRequest());

		mockMvc.perform(patch("/api/v1/user/notifications/" + foreign.getId() + "/read").cookie(cookie(me)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"));
		mockMvc.perform(patch("/api/v1/user/notifications/999999/read").cookie(cookie(me)))
				.andExpect(status().isNotFound());
		mockMvc.perform(patch("/api/v1/user/notifications/" + mineRows.get(1).getId() + "/read").cookie(cookie(me)))
				.andExpect(status().isNoContent());
		Instant readAt = jdbc.queryForObject(
				"select read_at from notifications where id = ?",
				Instant.class,
				mineRows.get(1).getId()
		);
		mockMvc.perform(patch("/api/v1/user/notifications/" + mineRows.get(1).getId() + "/read").cookie(cookie(me)))
				.andExpect(status().isNoContent());
		assertThat(jdbc.queryForObject(
				"select read_at from notifications where id = ?",
				Instant.class,
				mineRows.get(1).getId()
		)).isEqualTo(readAt);
		assertThat(count(me)).isEqualTo(20);

		mockMvc.perform(post("/api/v1/user/notifications/read-all").cookie(cookie(me)))
				.andExpect(status().isNoContent());
		assertThat(count(me)).isZero();
		assertThat(jdbc.queryForObject(
				"select read_at from notifications where id = ?",
				Instant.class,
				hidden.getId()
		)).isNull();
		assertThat(jdbc.queryForObject(
				"select pushed_at from notifications where id = ?",
				Instant.class,
				hidden.getId()
		)).isNull();

		jdbc.update(
				"update notifications set deliver_after = ? where id = ?",
				Timestamp.from(NOW.minusSeconds(1)),
				hidden.getId()
		);
		assertThat(count(me)).isEqualTo(1);
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[?(@.id == " + hidden.getId() + ")].title", contains("내일 아침")));

		me.setPushEnabled(false);
		users.saveAndFlush(me);
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[?(@.id == " + hidden.getId() + ")].title", contains("내일 아침")));
	}

	@Test
	void androidTokenIsStoredMovedAndDeleted() throws Exception {
		User first = user("push-a");
		User second = user("push-b");
		String token = "ExponentPushToken[abc-123]";
		mockMvc.perform(post("/api/v1/user/push-tokens")
						.cookie(cookie(first))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + token + "\",\"platform\":\"AnDrOiD\"}"))
				.andExpect(status().isNoContent());
		assertThat(platform(token)).isEqualTo("ANDROID");
		jdbc.update("update push_tokens set last_used_at = ? where expo_push_token = ?", Timestamp.from(NOW.minusSeconds(30)), token);
		mockMvc.perform(post("/api/v1/user/push-tokens")
						.cookie(cookie(first))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + token + "\",\"platform\":\"android\"}"))
				.andExpect(status().isNoContent());
		assertThat(tokenCount(token)).isEqualTo(1);
		assertThat(ownerId(token)).isEqualTo(first.getId());
		assertThat(jdbc.queryForObject(
				"select last_used_at from push_tokens where expo_push_token = ?",
				Instant.class,
				token
		)).isEqualTo(NOW);

		mockMvc.perform(post("/api/v1/user/push-tokens")
						.cookie(cookie(second))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + token + "\",\"platform\":\"android\"}"))
				.andExpect(status().isNoContent());
		assertThat(tokenCount(token)).isEqualTo(1);
		assertThat(ownerId(token)).isEqualTo(second.getId());
		mockMvc.perform(delete("/api/v1/user/push-tokens/{token}", token).cookie(cookie(first)))
				.andExpect(status().isNotFound());
		assertThat(tokenCount(token)).isEqualTo(1);
		mockMvc.perform(delete("/api/v1/user/push-tokens/{token}", token).cookie(cookie(second)))
				.andExpect(status().isNoContent());
		assertThat(tokenCount(token)).isZero();

		mockMvc.perform(post("/api/v1/user/push-tokens")
						.cookie(cookie(first))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"ExponentPushToken[ios]\",\"platform\":\"ios\"}"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/v1/user/push-tokens")
						.cookie(cookie(first))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"  \",\"platform\":\"android\"}"))
				.andExpect(status().isBadRequest());
		assertThat(tokenCount("ExponentPushToken[ios]")).isZero();
	}

	@Test
	void appealOpensOnceForTheSanctionedUser() throws Exception {
		User me = user("appeal");
		User other = user("appeal-other");
		Admin operator = admins.saveAndFlush(Admin.assign(user("appeal-ops"), AdminRole.OPERATOR));
		Sanction mine = sanctions.saveAndFlush(Sanction.issue(me, SanctionType.WARNING, operator, NOW));
		Sanction foreign = sanctions.saveAndFlush(Sanction.issue(other, SanctionType.WARNING, operator, NOW));
		Sanction revoked = sanctions.saveAndFlush(Sanction.issue(me, SanctionType.SUSPENSION, operator, NOW));
		revoked.revoke(NOW, operator.getId());
		sanctions.saveAndFlush(revoked);

		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + mine.getId() + ",\"body\":\"처음 접수\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.appealId").isNumber());
		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + mine.getId() + ",\"body\":\"다시\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ALREADY_APPEALED"));
		assertThat(jdbc.queryForObject("select body from appeals where sanction_id = ?", String.class, mine.getId()))
				.isEqualTo("처음 접수");
		assertThat(jdbc.queryForObject("select count(*) from appeals where sanction_id = ?", Integer.class, mine.getId()))
				.isEqualTo(1);

		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + foreign.getId() + ",\"body\":\"타인\"}"))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":999999,\"body\":\"없음\"}"))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + revoked.getId() + ",\"body\":\"취소\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(me))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + revoked.getId() + ",\"body\":\"  \"}"))
				.andExpect(status().isBadRequest());
		assertThat(jdbc.queryForObject("select count(*) from appeals where sanction_id = ?", Integer.class, revoked.getId()))
				.isZero();
		assertThat(jdbc.queryForObject("select count(*) from appeals where sanction_id = ?", Integer.class, foreign.getId()))
				.isZero();

		Notification listed = notifications.create(command(me, "CHAT", "{\"sanctionId\":" + mine.getId() + "}", null));
		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(me)))
				.andExpect(jsonPath("$.items[?(@.id == " + listed.getId() + ")].appeal.submitted", contains(true)));

		Sanction raced = sanctions.saveAndFlush(Sanction.issue(me, SanctionType.WARNING, operator, NOW));
		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		Callable<Object> call = () -> {
			start.await();
			try {
				return moderation.appeal(me.getId(), raced.getId(), "동시");
			}
			catch (ApiException exception) {
				return exception;
			}
		};
		Future<Object> left = pool.submit(call);
		Future<Object> right = pool.submit(call);
		start.countDown();
		List<Object> results = List.of(left.get(5, TimeUnit.SECONDS), right.get(5, TimeUnit.SECONDS));
		pool.shutdown();
		assertThat(results.stream().filter(Long.class::isInstance)).hasSize(1);
		assertThat(results.stream().filter(ApiException.class::isInstance).map(ApiException.class::cast))
				.singleElement()
				.extracting(ApiException::getCode)
				.isEqualTo("ALREADY_APPEALED");
		assertThat(jdbc.queryForObject("select count(*) from appeals where sanction_id = ?", Integer.class, raced.getId()))
				.isEqualTo(1);
	}

	@Test
	void suspendedUserCanStillReadNotificationsAndAppeal() throws Exception {
		User suspended = user("appeal-suspended");
		Admin operator = admins.saveAndFlush(Admin.assign(user("appeal-suspended-ops"), AdminRole.OPERATOR));
		Sanction sanction = sanctions.saveAndFlush(Sanction.issue(suspended, SanctionType.SUSPENSION, operator, NOW));
		Notification notice = notifications.create(command(suspended, "CHAT", "{\"sanctionId\":" + sanction.getId() + "}", null));
		suspended.suspendUntil(NOW.plusSeconds(3600));
		users.saveAndFlush(suspended);

		mockMvc.perform(get("/api/v1/user/notifications").cookie(cookie(suspended)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[?(@.id == " + notice.getId() + ")].appeal.sanctionId", contains(sanction.getId().intValue())));
		mockMvc.perform(post("/api/v1/user/appeals")
						.cookie(cookie(suspended))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"sanctionId\":" + sanction.getId() + ",\"body\":\"정지 중 이의\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.appealId").isNumber());
	}

	@Test
	void openApiDocumentsNotificationList() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(jsonPath("$.paths['/api/v1/user/notifications'].get.operationId").value("listNotifications"))
				.andExpect(jsonPath("$.paths['/api/v1/user/notifications'].get.tags[0]").value("p18-notifications"))
				.andExpect(jsonPath("$.paths['/api/v1/user/notifications/{notificationId}/read'].patch.operationId").value("markNotificationRead"))
				.andExpect(jsonPath("$.paths['/api/v1/user/notifications/read-all'].post.operationId").value("markAllNotificationsRead"))
				.andExpect(jsonPath("$.paths['/api/v1/user/notifications/unread-count'].get.operationId").value("getUnreadNotificationCount"))
				.andExpect(jsonPath("$.paths['/api/v1/user/push-tokens'].post.operationId").value("registerPushToken"))
				.andExpect(jsonPath("$.paths['/api/v1/user/push-tokens/{token}'].delete.operationId").value("deletePushToken"))
				.andExpect(jsonPath("$.paths['/api/v1/user/appeals'].post.operationId").value("createAppeal"))
				.andExpect(jsonPath("$.paths['/api/v1/user/appeals'].post.tags[0]").value("p18-notifications"));
	}

	private long count(User user) throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/user/notifications/unread-count").cookie(cookie(user)))
				.andExpect(status().isOk())
				.andReturn();
		Number count = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.count");
		return count.longValue();
	}

	private int tokenCount(String token) {
		return jdbc.queryForObject("select count(*) from push_tokens where expo_push_token = ?", Integer.class, token);
	}

	private String platform(String token) {
		return jdbc.queryForObject("select platform from push_tokens where expo_push_token = ?", String.class, token);
	}

	private long ownerId(String token) {
		return jdbc.queryForObject("select user_id from push_tokens where expo_push_token = ?", Long.class, token);
	}

	private CreateNotificationCommand command(User recipient, String type, String payload, String linkPath) {
		return new CreateNotificationCommand(recipient.getId(), type, null, null, null, linkPath, payload, null);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
