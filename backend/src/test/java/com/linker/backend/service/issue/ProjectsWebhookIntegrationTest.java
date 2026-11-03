package com.linker.backend.service.issue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.WebhookStatus;
import com.linker.backend.integration.github.GithubFixtures;
import com.linker.backend.integration.github.GithubGraphqlClient;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.service.github.GithubWebhookService;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Real B signature/store/dispatch + enabled C handler + disposable SQL/Redis, with fake external HTTP only. */
@SpringBootTest(properties = {"linker.github.projects.consumer-enabled=true", "linker.webhook.consumer-enabled=false", "spring.jpa.show-sql=false"})
@Testcontainers(disabledWithoutDocker = true)
@Import(ProjectsWebhookIntegrationTest.Fixtures.class)
class ProjectsWebhookIntegrationTest {
	@Container static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");
	@Container static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
	private static final String SECRET = "fixture-webhook-secret";

	@DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		registry.add("linker.github.webhook-secret", () -> SECRET);
	}

	@Autowired JdbcTemplate jdbc;
	@Autowired GithubWebhookService webhooks;
	@Autowired GithubWebhookDeliveryRepository deliveries;
	@Autowired MockRestServiceServer github;

	@BeforeEach void setUp() {
		github.reset();
		if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT to_regclass('public.issues') IS NOT NULL", Boolean.class))) {
			// Disposable fixture prerequisites, not B's production schema or a migration.
			jdbc.execute("CREATE TABLE teams (id bigint PRIMARY KEY)");
			jdbc.execute("CREATE TABLE github_repos (id bigint PRIMARY KEY)");
			jdbc.execute("INSERT INTO teams VALUES (1)"); jdbc.execute("INSERT INTO github_repos VALUES (10)");
			new ResourceDatabasePopulator(new ClassPathResource("db/drafts/c-issue-cache.sql")).execute(jdbc.getDataSource());
		}
		jdbc.execute("TRUNCATE TABLE issue_sync_jobs, issue_assignees, issue_labels, issues, github_webhook_deliveries RESTART IDENTITY CASCADE");
	}

	@AfterEach void verifyGithub() { github.verify(); }

	@Test void signedStoredDeliveryReconcilesCurrentValuesBeforeProcessed() throws Exception {
		var delivery = accept("success");
		respond(GithubFixtures.load("issue")); respond(GithubFixtures.load("membership")); respond(GithubFixtures.load("project-values"));
		webhooks.dispatch(delivery.getId());
		assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues", String.class)).isEqualTo("BLOCKED");
		assertThat(jdbc.queryForObject("SELECT due_date::text FROM issues", String.class)).isEqualTo("2026-11-06");
		assertThat(jdbc.queryForObject("SELECT project_item_id FROM issues", String.class)).isEqualTo("PVTI_1");
		// Payload deliberately said PVTI_OLD and 1999-01-01: only current upstream data was used.
	}

	@Test void cacheRollbackDoesNotRollBackDeliveryFailureRecord() throws Exception {
		var delivery = accept("bad-dates");
		respond(GithubFixtures.load("issue")); respond(GithubFixtures.load("membership"));
		respond(GithubFixtures.load("project-values").replace("2026-11-06", "2026-11-01"));
		webhooks.dispatch(delivery.getId());
		assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus()).isEqualTo(WebhookStatus.FAILED);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
	}

	@Test void permissionFailureIsNotRecordedAsSuccessfulProcessing() throws Exception {
		var delivery = accept("forbidden");
		github.expect(requestTo("https://api.github.com/graphql")).andRespond(withStatus(HttpStatus.FORBIDDEN));
		webhooks.dispatch(delivery.getId());
		assertThat(deliveries.findById(delivery.getId()).orElseThrow().getStatus()).isEqualTo(WebhookStatus.FAILED);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isZero();
	}

	private GithubWebhookDelivery accept(String id) throws Exception {
		byte[] body = GithubFixtures.load("projects-item-edited").getBytes(StandardCharsets.UTF_8);
		Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
		webhooks.accept(id, "projects_v2_item", signature, body);
		return deliveries.findByDeliveryId(id).orElseThrow();
	}

	private void respond(String body) { github.expect(requestTo("https://api.github.com/graphql")).andRespond(withSuccess(body, MediaType.APPLICATION_JSON)); }

	@TestConfiguration(proxyBeanMethods = false)
	static class Fixtures {
		@Bean RestClient.Builder fixtureBuilder() { return RestClient.builder(); }
		@Bean MockRestServiceServer fixtureServer(RestClient.Builder builder) { return MockRestServiceServer.bindTo(builder).build(); }
		@Bean @Primary GithubGraphqlClient fixtureGraphql(RestClient.Builder builder, MockRestServiceServer server) {
			return new GithubGraphqlClient("https://api.github.com", builder);
		}
		@Bean ProjectsRefreshContextResolver fixtureContexts() { return change -> Optional.of(GithubFixtures.context()); }
		@Bean ProjectsAccessTokenProvider fixtureTokens() { return installation -> "fixture"; }
	}
}
