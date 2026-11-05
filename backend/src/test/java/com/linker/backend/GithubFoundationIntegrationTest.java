package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.async.webhook.RedisWebhookQueue;
import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.WebhookStatus;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.github.*;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.service.PublicAuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

/** Every write/cleanup targets the containers below, never the shared team DB. */
@SpringBootTest
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
@Import(GithubFoundationIntegrationTest.ProbeConfiguration.class)
class GithubFoundationIntegrationTest {
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
		registry.add("linker.github.webhook-secret", () -> "synthetic-webhook-secret");
		registry.add("linker.github.app.id", () -> "123");
		registry.add("linker.github.app.slug", () -> "linker-test");
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("linker.webhook.max-attempts", () -> "3");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@Autowired MockMvc mvc;
	@Autowired JdbcTemplate jdbc;
	@Autowired StringRedisTemplate redis;
	@Autowired UserRepository users;
	@Autowired PublicAuthService sessions;
	@Autowired GithubWebhookService webhooks;
	@Autowired GithubWebhookDeliveryRepository deliveries;
	@Autowired GithubInstallationState states;
	@Autowired Probe probe;
	@Autowired PlatformTransactionManager transactionManager;
	@MockitoSpyBean RedisWebhookQueue queue;
	@MockitoBean GithubAppClient github;
	@MockitoBean GithubUserAccessTokenSource userTokens;

	@BeforeEach
	void clean() {
		jdbc.execute("TRUNCATE users, github_webhook_deliveries RESTART IDENTITY CASCADE");
		redis.delete("linker:github:webhook");
		reset(queue);
		probe.calls.set(0);
		probe.fail = false;
		probe.entered = null;
		probe.release = null;
	}

	@Test
	void handlerRunsWithoutATransactionAndCompletedDeliveryIsNotRepeated() throws Exception {
		long id = receive("success");
		webhooks.dispatch(id);
		webhooks.dispatch(id);
		assertThat(deliveries.findById(id).orElseThrow().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
		assertThat(probe.calls.get()).isEqualTo(1);
	}

	@Test
	void concurrentConsumersCannotRunTheSameDeliveryTogether() throws Exception {
		long id = receive("parallel");
		probe.entered = new CountDownLatch(1);
		probe.release = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			var first = executor.submit(() -> webhooks.dispatch(id));
			try {
				assertThat(probe.entered.await(5, TimeUnit.SECONDS)).isTrue();
				executor.submit(() -> webhooks.dispatch(id)).get(5, TimeUnit.SECONDS);
				assertThat(probe.calls.get()).isEqualTo(1);
			}
			finally { probe.release.countDown(); }
			first.get(5, TimeUnit.SECONDS);
		}
		assertThat(deliveries.findById(id).orElseThrow().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
	}

	@Test
	void failedHandlerIsRetriedAfterDelayAndExhaustionStaysRecorded() throws Exception {
		long id = receive("retry");
		probe.fail = true;
		for (int attempt = 1; attempt <= 3; attempt++) {
			webhooks.dispatch(id);
			var saved = deliveries.findById(id).orElseThrow();
			assertThat(saved.getStatus()).isEqualTo(WebhookStatus.FAILED);
			assertThat(saved.getAttempts()).isEqualTo(attempt);
			assertThat(saved.getError()).isEqualTo("HANDLER_FAILED");
			webhooks.dispatch(id);
			assertThat(probe.calls.get()).isEqualTo(attempt);
			age(id);
			webhooks.recover();
			if (attempt < 3) { assertThat(queue.poll()).contains(id); }
			else { assertThat(queue.poll()).isEmpty(); }
		}
	}

	@Test
	void aRetryCanSucceedAndClearsTheFailure() throws Exception {
		long id = receive("retry-success");
		probe.fail = true;
		webhooks.dispatch(id);
		probe.fail = false;
		age(id);
		webhooks.recover();
		webhooks.dispatch(queue.poll().orElseThrow());
		assertThat(deliveries.findById(id).orElseThrow().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
		assertThat(deliveries.findById(id).orElseThrow().getError()).isNull();
	}

	@Test
	void recoveryRestoresCommittedReceiptsAfterQueueFailureOrConsumerCrash() throws Exception {
		doThrow(new IllegalStateException("synthetic-redis-down")).doCallRealMethod().when(queue).enqueue(anyLong());
		assertThatThrownBy(() -> receive("enqueue-failure")).isInstanceOf(com.linker.backend.global.error.ApiException.class);
		long id = deliveries.findByDeliveryId("enqueue-failure").orElseThrow().getId();
		age(id);
		webhooks.recover();
		assertThat(queue.poll()).contains(id);
		// The queue item was popped and the worker died before dispatch; DB is still RECEIVED.
		age(id);
		webhooks.recover();
		webhooks.dispatch(queue.poll().orElseThrow());
		assertThat(probe.calls.get()).isEqualTo(1);
	}

	@Test
	void dispatchRejectsAnOuterDatabaseTransaction() {
		assertThatThrownBy(() -> new TransactionTemplate(transactionManager).execute(status -> {
			webhooks.dispatch(1);
			return null;
		})).isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
	}

	@Test
	void installationStateIsBoundToUserAndSessionAndConsumedOnce() {
		String state = states.issue(7, 10);
		assertThatThrownBy(() -> states.consume(state, 8, 10)).isInstanceOf(com.linker.backend.global.error.ApiException.class);
		assertThatThrownBy(() -> states.consume(state, 7, 11)).isInstanceOf(com.linker.backend.global.error.ApiException.class);
		states.consume(state, 7, 10);
		assertThatThrownBy(() -> states.consume(state, 7, 10)).isInstanceOf(com.linker.backend.global.error.ApiException.class);
	}

	@Test
	void concurrentStateConsumersHaveExactlyOneWinner() throws Exception {
		String state = states.issue(7, 10);
		try (var executor = Executors.newFixedThreadPool(2)) {
			java.util.concurrent.Callable<Boolean> consume = () -> {
				try { states.consume(state, 7, 10); return true; }
				catch (com.linker.backend.global.error.ApiException exception) { return false; }
			};
			var results = executor.invokeAll(java.util.List.of(consume, consume));
			assertThat(results.get(0).get()).isNotEqualTo(results.get(1).get());
		}
	}

	@Test
	void expiredStateCannotBeConsumed() throws Exception {
		var properties = new com.linker.backend.global.config.GithubAppProperties("123", "linker", "", "https://api.github.com",
				"2026-03-10", java.time.Duration.ofSeconds(10), java.time.Duration.ofMillis(1));
		var shortLived = new GithubInstallationState(redis, properties);
		String state = shortLived.issue(7, 11);
		TimeUnit.MILLISECONDS.sleep(20);
		assertThatThrownBy(() -> shortLived.consume(state, 7, 11)).isInstanceOf(com.linker.backend.global.error.ApiException.class);
	}

	@Test
	void httpInstallationVerificationUsesTheServerTokenAndRejectsReplay() throws Exception {
		User user = users.saveAndFlush(User.create("developer", UserType.DEVELOPER));
		Cookie cookie = new Cookie("linker_session", sessions.issue(user, "test", "127.0.0.1").rawToken());
		mvc.perform(get("/api/v1/user/team-setup/install-url")).andExpect(status().isUnauthorized());
		String json = mvc.perform(get("/api/v1/user/team-setup/install-url").cookie(cookie))
				.andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
				.andReturn().getResponse().getContentAsString();
		String state = new ObjectMapper().readTree(json).get("state").stringValue();
		when(userTokens.tokenFor(user.getId())).thenReturn("synthetic-user-token");
		when(github.verifyUserInstallation("synthetic-user-token", 42)).thenReturn(new GithubInstallationView(42, 7, "org", "https://avatars.githubusercontent.com/u/7"));
		String body = "{\"installationId\":\"42\",\"setupAction\":\"install\",\"state\":\"" + state + "\"}";
		mvc.perform(post("/api/v1/user/team-setup/installations/verify").cookie(cookie)
				.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk()).andExpect(jsonPath("$.result").value("INSTALLED"))
				.andExpect(jsonPath("$.installationId").value("42"));
		mvc.perform(post("/api/v1/user/team-setup/installations/verify").cookie(cookie)
				.contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
		verify(github, times(1)).verifyUserInstallation("synthetic-user-token", 42);
	}

	@Test
	void recruiterCannotStartInstallation() throws Exception {
		User user = users.saveAndFlush(User.create("recruiter", UserType.RECRUITER));
		Cookie cookie = new Cookie("linker_session", sessions.issue(user, "test", "127.0.0.1").rawToken());
		mvc.perform(get("/api/v1/user/team-setup/install-url").cookie(cookie)).andExpect(status().isForbidden());
		verifyNoInteractions(userTokens, github);
	}

	private long receive(String deliveryId) throws Exception {
		byte[] body = "{\"action\":\"changed\"}".getBytes(StandardCharsets.UTF_8);
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec("synthetic-webhook-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		webhooks.accept(deliveryId, "spike_event", "sha256=" + HexFormat.of().formatHex(mac.doFinal(body)), body);
		return queue.poll().orElseThrow();
	}
	private void age(long id) {
		jdbc.update("update github_webhook_deliveries set processed_at = ?, updated_at = ? where id = ?",
				java.sql.Timestamp.from(Instant.now().minusSeconds(120)), java.sql.Timestamp.from(Instant.now().minusSeconds(120)), id);
	}

	static class Probe implements GithubWebhookHandler {
		final AtomicInteger calls = new AtomicInteger();
		volatile boolean fail;
		volatile CountDownLatch entered;
		volatile CountDownLatch release;
		public boolean supports(String event) { return "spike_event".equals(event); }
		public void handle(GithubWebhookDelivery delivery) {
			assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
			calls.incrementAndGet();
			if (entered != null) { entered.countDown(); }
			if (release != null) {
				try { if (!release.await(5, TimeUnit.SECONDS)) { throw new IllegalStateException("probe timeout"); } }
				catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new IllegalStateException(); }
			}
			if (fail) { throw new IllegalStateException("synthetic-handler-failure"); }
		}
	}
	@TestConfiguration
	static class ProbeConfiguration {
		@Bean Probe probe() { return new Probe(); }
	}
}
