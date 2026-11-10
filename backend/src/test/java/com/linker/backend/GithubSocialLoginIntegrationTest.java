package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import com.linker.backend.entity.moderation.BannedGithubId;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.github.GithubAccount;
import com.linker.backend.integration.github.GithubUserAccessTokenSource;
import com.linker.backend.integration.github.GithubUserAuthClient;
import com.linker.backend.integration.github.GithubUserSession;
import com.linker.backend.repository.moderation.BannedGithubIdRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** GitHub HTTP is mocked. Postgres and Redis are test containers, not the shared team services. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class GithubSocialLoginIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final String ENCRYPTION_KEY = Base64.getEncoder().encodeToString(new byte[] {
			7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
	});

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
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.github.app.client-id", () -> "Iv1.test");
		registry.add("linker.github.app.client-secret", () -> "synthetic-client-secret");
		registry.add("linker.github.app.user-callback-url", () -> "http://localhost:3000/auth/callback");
		registry.add("linker.github.app.token-encryption-key", () -> ENCRYPTION_KEY);
		registry.add("linker.github.webhook-secret", () -> "synthetic-webhook-secret");
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private StringRedisTemplate redis;

	@Autowired
	private BannedGithubIdRepository banned;

	@Autowired
	private GithubUserAccessTokenSource userTokens;

	@MockitoBean
	private GithubUserAuthClient github;

	@BeforeEach
	void clean() {
		jdbc.execute("TRUNCATE TABLE banned_github_ids, users RESTART IDENTITY CASCADE");
		redis.execute((RedisCallback<Void>) connection -> {
			connection.serverCommands().flushDb();
			return null;
		});
	}

	@Test
	void socialLoginSetsTheSessionCookieAndStoresAnEncryptedUserToken() throws Exception {
		stubGithub(42, "octocat", "ghu_test");
		String state = authorize("web", "/invite/team");
		MvcResult created = callback(state, "code-1");
		String token = cookie(created.getResponse().getHeader("Set-Cookie"));

		mockMvc.perform(get("/api/v1/user/me").cookie(new Cookie("linker_session", token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.login").value("octocat"))
				.andExpect(jsonPath("$.userType").value("DEVELOPER"))
				.andExpect(jsonPath("$.onboarded").value(false));
		assertThat(jdbc.queryForObject("SELECT email FROM users WHERE username = 'octocat'", String.class)).isEqualTo("octo@example.com");
		assertThat(jdbc.queryForObject("SELECT access_token_enc FROM github_tokens", String.class)).doesNotContain("ghu_test");
		assertThat(userTokens.tokenFor(1L)).isEqualTo("ghu_test");

		String again = authorize("web", "/feed");
		mockMvc.perform(post("/api/v1/public/auth/github/callback")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"code-2\",\"state\":\"" + again + "\",\"returnTo\":\"/feed\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.isNew").value(false))
				.andExpect(jsonPath("$.restored").value(false));
		assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Long.class)).isEqualTo(1L);

		mockMvc.perform(post("/api/v1/public/auth/github/callback")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"code-3\",\"state\":\"" + again + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void appAuthorizeUrlUsesTheClientQueryAndLoginRestoresAPendingWithdrawal() throws Exception {
		MvcResult authorized = mockMvc.perform(get("/api/v1/public/auth/github/authorize-url")
						.param("client", "app")
						.param("returnTo", "/feed"))
				.andExpect(status().isOk())
				.andReturn();
		String url = authorized.getResponse().getContentAsString();
		assertThat(url).contains("client_id=Iv1.test").contains("client%3Dapp").doesNotContain("synthetic-client-secret");

		stubGithub(7, "ada", "ghu_ada");
		callback(authorize("web", "/settings"), "ada-code");
		jdbc.update("UPDATE users SET status = 'WITHDRAWING', withdraw_requested_at = now() WHERE username = 'ada'");
		mockMvc.perform(post("/api/v1/public/auth/github/callback")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"ada-again\",\"state\":\"" + authorize("web", "/settings") + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.restored").value(true))
				.andExpect(jsonPath("$.returnTo").value("/settings"));
		assertThat(jdbc.queryForObject("SELECT status FROM users WHERE username = 'ada'", String.class)).isEqualTo("ACTIVE");
	}

	@Test
	void bannedGithubAccountDoesNotReceiveASession() throws Exception {
		banned.save(BannedGithubId.ban("99"));
		stubGithub(99, "blocked", "ghu_blocked");
		mockMvc.perform(post("/api/v1/public/auth/github/callback")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"nope\",\"state\":\"" + authorize("web", "/feed") + "\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Long.class)).isZero();
	}

	@Test
	void profileGithubSyncReloadsGithubFieldsAndRefreshesAnExpiredToken() throws Exception {
		stubGithub(42, "octocat", "ghu_test");
		String token = cookie(callback(authorize("web", "/settings/profile"), "code-1").getResponse().getHeader("Set-Cookie"));
		jdbc.update("""
				UPDATE users
				SET display_name = '기존이름', bio = '이전소개', blog_url = 'https://old.example',
				    looking_for_team = true, job_seeking_status = 'OPEN'
				WHERE username = 'octocat'
				""");
		String bio = "b".repeat(180);
		when(github.account(eq("ghu_test"))).thenReturn(new GithubAccount(
				42, "octocat", "Display Name That Is Longer Than Twenty",
				"https://avatars.githubusercontent.com/u/42", "other@example.com", bio, "https://blog.example"));

		mockMvc.perform(post("/api/v1/user/me/profile/github-sync").cookie(new Cookie("linker_session", token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("DEVELOPER"))
				.andExpect(jsonPath("$.name").value("Display Name That Is"))
				.andExpect(jsonPath("$.bio").value("b".repeat(160)))
				.andExpect(jsonPath("$.blogUrl").value("https://blog.example"))
				.andExpect(jsonPath("$.lookingForTeam").value(true))
				.andExpect(jsonPath("$.jobStatus").value("SEEKING"))
				.andExpect(jsonPath("$.syncedAt").exists());
		assertThat(jdbc.queryForObject("SELECT email FROM users WHERE username = 'octocat'", String.class)).isEqualTo("octo@example.com");
		assertThat(jdbc.queryForObject("SELECT avatar_url FROM users WHERE username = 'octocat'", String.class))
				.isEqualTo("https://avatars.githubusercontent.com/u/42");

		jdbc.update("UPDATE github_tokens SET access_expires_at = now() - interval '1 minute' WHERE user_id = 1");
		when(github.refresh(eq("ghr_octocat"))).thenReturn(new GithubUserSession(
				"ghu_fresh", Instant.now().plusSeconds(3600), "ghr_fresh", Instant.now().plus(Duration.ofDays(30))));
		when(github.account(eq("ghu_fresh"))).thenReturn(new GithubAccount(
				42, "octocat", "Fresh Name", "https://avatars.githubusercontent.com/u/42",
				"other@example.com", "새 소개", "http://not-https.example"));

		mockMvc.perform(post("/api/v1/user/me/profile/github-sync").cookie(new Cookie("linker_session", token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Fresh Name"))
				.andExpect(jsonPath("$.bio").value("새 소개"))
				.andExpect(jsonPath("$.blogUrl").value(""))
				.andExpect(jsonPath("$.lookingForTeam").value(true));
		assertThat(userTokens.tokenFor(1L)).isEqualTo("ghu_fresh");
		assertThat(jdbc.queryForObject("SELECT blog_url FROM users WHERE username = 'octocat'", String.class)).isNull();
	}

	private void stubGithub(long id, String login, String access) {
		when(github.exchange(anyString(), anyString())).thenReturn(new GithubUserSession(
				access, Instant.now().plusSeconds(3600), "ghr_" + login, Instant.now().plus(Duration.ofDays(30))));
		when(github.account(eq(access))).thenReturn(new GithubAccount(
				id, login, "Display Name That Is Longer Than Twenty", "https://avatars.githubusercontent.com/u/" + id,
				"octo@example.com", null, null));
	}

	private String authorize(String client, String returnTo) throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/public/auth/github/authorize-url")
						.param("client", client)
						.param("returnTo", returnTo))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.authorizeUrl").exists())
				.andReturn();
		String body = result.getResponse().getContentAsString();
		return body.replaceAll(".*\"state\"\\s*:\\s*\"([^\"]+)\".*", "$1");
	}

	private MvcResult callback(String state, String code) throws Exception {
		return mockMvc.perform(post("/api/v1/public/auth/github/callback")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"" + code + "\",\"state\":\"" + state + "\",\"returnTo\":\"/ignored\"}"))
				.andExpect(status().isOk())
				.andExpect(header().exists("Set-Cookie"))
				.andExpect(jsonPath("$.isNew").value(true))
				.andExpect(jsonPath("$.returnTo").exists())
				.andReturn();
	}

	private static String cookie(String setCookie) {
		int start = setCookie.indexOf("linker_session=");
		int end = setCookie.indexOf(';', start);
		return setCookie.substring(start + "linker_session=".length(), end);
	}
}
