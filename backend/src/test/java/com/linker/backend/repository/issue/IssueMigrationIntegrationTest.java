package com.linker.backend.repository.issue;

import static org.assertj.core.api.Assertions.*;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** V21 → V22 upgrade in an isolated schema, like B's TeamMigrationIntegrationTest. */
@Testcontainers
class IssueMigrationIntegrationTest {
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");

  @Test
  void upgradesV21WithTheFiveIssueTablesAndKeepsEarlierHistory() {
    String schema = "issue_upgrade_" + UUID.randomUUID().toString().replace("-", "");
    flyway(schema, "21").migrate();
    JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
        PG.getJdbcUrl() + (PG.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema,
        PG.getUsername(), PG.getPassword()));
    try {
      assertThat(jdbc.queryForObject("select to_regclass('issues') is null", Boolean.class)).isTrue();
      Flyway current = flyway(schema, "22");
      assertThat(current.migrate().migrationsExecuted).isEqualTo(1);
      assertThat(current.migrate().migrationsExecuted).isZero();
      current.validate();
      assertThat(jdbc.queryForList("""
          select table_name from information_schema.tables
          where table_schema=current_schema() and table_name in
            ('issues','issue_assignees','issue_labels','team_progress_snapshots','issue_sync_jobs')
          """, String.class)).hasSize(5);
      // ERD common columns on every issue table (Hibernate fills them; defaults serve native batches).
      assertThat(jdbc.queryForObject("""
          select count(*) from information_schema.columns
          where table_schema=current_schema() and column_name in ('created_at','updated_at')
            and table_name in ('issues','issue_assignees','issue_labels','team_progress_snapshots',
              'issue_sync_jobs')
          """, Long.class)).isEqualTo(10);
      assertThat(jdbc.queryForObject("""
          select count(*) from pg_indexes where schemaname=current_schema() and indexname in
            ('issue_sync_jobs_due_idx','issue_sync_jobs_active_issue_idx',
             'issue_sync_jobs_create_request_idx','issues_team_updated_idx')
          """, Long.class)).isEqualTo(4);
      assertThat(jdbc.queryForObject(
              "select count(*) from flyway_schema_history where success and version::int <= 21",
              Long.class))
          .isEqualTo(21);
    } finally {
      new JdbcTemplate(new DriverManagerDataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword()))
          .execute("drop schema " + schema + " cascade");
    }
  }

  private Flyway flyway(String schema, String target) {
    return Flyway.configure().dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())
        .schemas(schema).defaultSchema(schema).target(target).load();
  }
}
