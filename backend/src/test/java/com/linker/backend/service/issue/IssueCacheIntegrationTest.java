package com.linker.backend.service.issue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import com.linker.backend.integration.github.GithubFixtures;
import com.linker.backend.integration.github.GithubGraphqlClient;
import com.linker.backend.integration.github.GithubIssuesClient;
import com.linker.backend.integration.github.GithubProjectsClient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import com.linker.backend.dto.issue.IssueCacheSnapshot;
import com.linker.backend.repository.issue.IssueCacheRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Dedicated disposable database only. No application properties, shared DB, Redis or GitHub. */
@SpringJUnitConfig(IssueCacheIntegrationTest.Config.class)
@Testcontainers(disabledWithoutDocker = true)
class IssueCacheIntegrationTest {

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

	@Autowired IssueCacheService service;
	@Autowired JdbcTemplate jdbc;
	@Autowired ProjectsCacheRefreshService projects;
	@Autowired MockRestServiceServer github;
	private static final Instant VERSION = Instant.parse("2026-11-04T00:00:00Z");

	@BeforeEach
	void clean() {
		github.reset();
		jdbc.execute("TRUNCATE TABLE issue_assignees, issue_labels, issues RESTART IDENTITY CASCADE");
		jdbc.execute("DELETE FROM users");
	}

	@Test
	void storesAndReadsIssueWithAssigneesAndLabels() {
		var snapshot = snapshot(1, 10, 100, "First", VERSION, 11, "bug");
		var saved = service.refresh(snapshot);
		assertThat(saved.updated()).isTrue();
		assertThat(service.findForTeam(saved.issueId(), 1).orElseThrow().snapshot()).isEqualTo(snapshot);
		assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id = ?", String.class, saved.issueId()))
				.isEqualTo("PENDING");
	}

	@Test
	void newerIssueReplacesRelationsButPreservesProjectsAndJobOwnedColumns() {
		var saved = service.refresh(snapshot(1, 10, 100, "First", VERSION, 11, "bug"));
		jdbc.update("""
				UPDATE issues SET project_item_id = 'PVTI_1', board_status = 'BLOCKED',
				 start_date = DATE '2026-11-04', due_date = DATE '2026-11-06',
				 sync_status = 'FAILED', created_via_linker = true WHERE id = ?
				""", saved.issueId());
		var newer = snapshot(1, 10, 100, "Newer", VERSION.plusSeconds(10), 22, "feature");
		assertThat(service.refresh(newer).updated()).isTrue();
		assertThat(service.findForTeam(saved.issueId(), 1).orElseThrow().snapshot()).isEqualTo(newer);
		assertThat(jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id = ?", String.class, saved.issueId())).isEqualTo("PVTI_1");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, saved.issueId())).isEqualTo("BLOCKED");
		assertThat(jdbc.queryForObject("SELECT due_date::text FROM issues WHERE id = ?", String.class, saved.issueId())).isEqualTo("2026-11-06");
		assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id = ?", String.class, saved.issueId())).isEqualTo("FAILED");
	}

	@Test
	void ignoresOlderSnapshotIncludingItsRelations() {
		var current = snapshot(1, 10, 100, "Current", VERSION.plusSeconds(10), 22, "feature");
		var saved = service.refresh(current);
		assertThat(service.refresh(snapshot(1, 10, 100, "Old", VERSION, 11, "bug")).updated()).isFalse();
		assertThat(service.findForTeam(saved.issueId(), 1).orElseThrow().snapshot()).isEqualTo(current);
	}

	@Test
	void duplicateVersionDoesNotDuplicateOrReplaceRows() {
		var current = snapshot(1, 10, 100, "Current", VERSION, 11, "bug");
		var first = service.refresh(current);
		var duplicate = service.refresh(current);
		assertThat(duplicate.issueId()).isEqualTo(first.issueId());
		assertThat(duplicate.updated()).isFalse();
		assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM issue_assignees", Integer.class)).isEqualTo(1);
	}

	@Test
	void teamScopedReadDoesNotReturnAnotherTeamsIssue() {
		var saved = service.refresh(snapshot(1, 10, 100, "First", VERSION, 11, "bug"));
		assertThat(service.findForTeam(saved.issueId(), 2)).isEmpty();
	}

	@Test
	void refusesImplicitIssueTransferAndKeepsExistingSnapshot() {
		var current = snapshot(1, 10, 100, "First", VERSION, 11, "bug");
		var saved = service.refresh(current);
		assertThatThrownBy(() -> service.refresh(snapshot(2, 20, 100, "Other", VERSION.plusSeconds(10), 22, "feature")))
				.isInstanceOf(IllegalArgumentException.class);
		assertThat(service.findForTeam(saved.issueId(), 1).orElseThrow().snapshot()).isEqualTo(current);
	}

	@Test
	void relationFailureRollsBackTheIssueUpdateAndRelationDeletion() {
		var original = snapshot(1, 10, 100, "Original", VERSION, 11, "bug");
		var saved = service.refresh(original);
		var invalidUser = new IssueCacheSnapshot(1, 10, 100, "I_100", 7, "Must rollback", IssueCacheSnapshot.State.OPEN,
				null, "author", "https://github.com/example/repo/issues/7", VERSION.plusSeconds(10), null,
				List.of(new IssueCacheSnapshot.Assignee(22, "next", 999L)), List.of());
		assertThatThrownBy(() -> service.refresh(invalidUser)).isInstanceOf(DataIntegrityViolationException.class);
		assertThat(service.findForTeam(saved.issueId(), 1).orElseThrow().snapshot()).isEqualTo(original);
	}

	@RepeatedTest(5)
	void concurrentRefreshesKeepOneIssueAndTheNewestRelations() throws Exception {
		var barrier = new CyclicBarrier(2);
		try (var executor = Executors.newFixedThreadPool(2)) {
			var older = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return service.refresh(snapshot(1, 10, 100, "Old", VERSION, 11, "bug")); });
			var newer = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return service.refresh(snapshot(1, 10, 100, "New", VERSION.plusSeconds(10), 22, "feature")); });
			older.get(20, TimeUnit.SECONDS);
			var result = newer.get(20, TimeUnit.SECONDS);
			assertThat(service.findForTeam(result.issueId(), 1).orElseThrow().snapshot().title()).isEqualTo("New");
			assertThat(service.findForTeam(result.issueId(), 1).orElseThrow().snapshot().labels())
					.containsExactly(new IssueCacheSnapshot.Label("feature", "ff0000"));
			assertThat(jdbc.queryForObject("SELECT count(*) FROM issues", Integer.class)).isEqualTo(1);
		}
	}

	@AfterEach void verifyGithub() { github.verify(); }

	@Test void projectsRefreshWritesCurrentStatusAndDates() {
		projectReplies(GithubFixtures.load("project-values"));
		long id = projects.refresh(GithubFixtures.context(), snapshot(1, 10, 100, "First", VERSION, 11, "bug"), "fixture");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("BLOCKED");
		assertThat(jdbc.queryForObject("SELECT due_date::text FROM issues WHERE id = ?", String.class, id)).isEqualTo("2026-11-06");
		assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("SYNCED");
	}

	@Test void removedDateAndMembershipClearOldValues() {
		var source = snapshot(1, 10, 100, "First", VERSION, 11, "bug");
		projectReplies(GithubFixtures.load("project-values"));
		long id = projects.refresh(GithubFixtures.context(), source, "fixture");
		github.reset();
		projectReplies(GithubFixtures.load("project-values").replace("\"date\":\"2026-11-06\"", "\"date\":null"));
		projects.refresh(GithubFixtures.context(), source, "fixture");
		assertThat(jdbc.queryForObject("SELECT due_date FROM issues WHERE id = ?", java.sql.Date.class, id)).isNull();
		github.reset();
		githubReply(GithubFixtures.load("membership").replace("\"isArchived\":false", "\"isArchived\":true"));
		projects.refresh(GithubFixtures.context(), source, "fixture");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("NONE");
		assertThat(jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id = ?", String.class, id)).isNull();
	}

	@Test void unknownStatusStaysOtherAndClosedIssueOverridesStaleSource() {
		var source = snapshot(1, 10, 100, "First", VERSION, 11, "bug");
		projectReplies(GithubFixtures.load("project-values").replace("\"optionId\":\"blocked\"", "\"optionId\":\"review\""));
		long id = projects.refresh(GithubFixtures.context(), source, "fixture");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("OTHER");
		github.reset();
		jdbc.update("UPDATE issues SET state = 'CLOSED', github_updated_at = ? WHERE id = ?", java.sql.Timestamp.from(VERSION.plusSeconds(20)), id);
		projectReplies(GithubFixtures.load("project-values"));
		projects.refresh(GithubFixtures.context(), source, "fixture");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("DONE");
	}

	@Test void invalidProjectDatesRollBackSourceAndRelatedRows() {
		var original = snapshot(1, 10, 100, "Original", VERSION, 11, "bug");
		long id = service.refresh(original).issueId();
		projectReplies(GithubFixtures.load("project-values").replace("2026-11-06", "2026-11-01"));
		assertThatThrownBy(() -> projects.refresh(GithubFixtures.context(), snapshot(1, 10, 100, "Bad", VERSION.plusSeconds(10), 22, "feature"), "fixture"))
				.isInstanceOf(IllegalArgumentException.class);
		assertThat(service.findForTeam(id, 1).orElseThrow().snapshot()).isEqualTo(original);
	}

	@Test void projectReadsDoNotFinishPendingUserWriteJobs() {
		var source = snapshot(1, 10, 100, "First", VERSION, 11, "bug");
		long id = service.refresh(source).issueId();
		jdbc.execute("INSERT INTO users VALUES (1)");
		jdbc.update("INSERT INTO issue_sync_jobs (issue_id, step, status, requested_by, created_at, updated_at) VALUES (?, 'SET_STATUS', 'PENDING', 1, now(), now())", id);
		projectReplies(GithubFixtures.load("project-values"));
		projects.refresh(GithubFixtures.context(), source, "fixture");
		assertThat(jdbc.queryForObject("SELECT sync_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("PENDING");
	}

	@Test void currentReaddedItemReplacesOldItemAndNoStatusDoesNotCrash() {
		githubReply(GithubFixtures.load("membership").replace("PVTI_1", "PVTI_NEW"));
		githubReply(GithubFixtures.load("project-values").replace("PVTI_1", "PVTI_NEW").replace("\"optionId\":\"blocked\"", "\"optionId\":null"));
		long id = projects.refresh(GithubFixtures.context(), snapshot(1, 10, 100, "First", VERSION, 11, "bug"), "fixture");
		assertThat(jdbc.queryForObject("SELECT project_item_id FROM issues WHERE id = ?", String.class, id)).isEqualTo("PVTI_NEW");
		assertThat(jdbc.queryForObject("SELECT board_status FROM issues WHERE id = ?", String.class, id)).isEqualTo("OTHER");
	}

	private void projectReplies(String values) { githubReply(GithubFixtures.load("membership")); githubReply(values); }
	private void githubReply(String body) {
		github.expect(requestTo("https://api.github.com/graphql")).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
	}

	private static IssueCacheSnapshot snapshot(long team, long repo, long githubId, String title, Instant version, long assignee, String label) {
		return new IssueCacheSnapshot(team, repo, githubId, "I_" + githubId, 7, title, IssueCacheSnapshot.State.OPEN,
				null, "author", "https://github.com/example/repo/issues/7", version, null,
				List.of(new IssueCacheSnapshot.Assignee(assignee, "user-" + assignee, null)),
				List.of(new IssueCacheSnapshot.Label(label, "ff0000")));
	}

	@Configuration(proxyBeanMethods = false)
	@EnableTransactionManagement
	static class Config {
		@Bean DataSource dataSource() {
			return new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
		}
		@Bean JdbcTemplate jdbcTemplate(DataSource dataSource) {
			var jdbc = new JdbcTemplate(dataSource);
			// Test-only prerequisite IDs, not B's production table implementation.
			jdbc.execute("CREATE TABLE users (id bigint PRIMARY KEY)");
			jdbc.execute("CREATE TABLE teams (id bigint PRIMARY KEY)");
			jdbc.execute("CREATE TABLE github_repos (id bigint PRIMARY KEY)");
			jdbc.execute("INSERT INTO teams VALUES (1), (2)");
			jdbc.execute("INSERT INTO github_repos VALUES (10), (20)");
			new ResourceDatabasePopulator(new ClassPathResource("db/drafts/c-issue-cache.sql")).execute(dataSource);
			return jdbc;
		}
		@Bean PlatformTransactionManager transactionManager(DataSource dataSource) { return new DataSourceTransactionManager(dataSource); }
		@Bean IssueCacheRepository repository(JdbcTemplate jdbc) { return new IssueCacheRepository(jdbc); }
		@Bean IssueCacheService service(IssueCacheRepository repository) {
			return new IssueCacheService(repository, Clock.fixed(VERSION.plusSeconds(100), ZoneOffset.UTC));
		}
		@Bean RestClient.Builder githubBuilder() { return RestClient.builder(); }
		@Bean MockRestServiceServer githubServer(RestClient.Builder builder) { return MockRestServiceServer.bindTo(builder).build(); }
		@Bean GithubGraphqlClient graphql(RestClient.Builder builder, MockRestServiceServer server) { return new GithubGraphqlClient("https://api.github.com", builder); }
		@Bean GithubIssuesClient githubIssues(GithubGraphqlClient graphql) { return new GithubIssuesClient(graphql); }
		@Bean GithubProjectsClient githubProjects(GithubGraphqlClient graphql) { return new GithubProjectsClient(graphql); }
		@Bean ProjectsCacheRefreshService projects(IssueCacheService service, IssueCacheRepository repo, GithubIssuesClient source, GithubProjectsClient project) {
			return new ProjectsCacheRefreshService(service, repo, source, project, Clock.fixed(VERSION.plusSeconds(100), ZoneOffset.UTC));
		}

	}
}
