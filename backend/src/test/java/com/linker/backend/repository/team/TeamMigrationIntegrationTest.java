package com.linker.backend.repository.team;

import static org.assertj.core.api.Assertions.*;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Exercises upgrade and failed-upgrade rollback against isolated PostgreSQL schemas. */
@Testcontainers
class TeamMigrationIntegrationTest {
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");

  @Test
  void upgradesV19WithoutRecreatingSharedRepositoriesOrChangingOldChecksums() {
    verifyUpgrade(false);
  }

  @Test
  void orphanedChatTeamIdsFailAtomicallyWithoutDeletingRooms() {
    verifyUpgrade(true);
  }

  private void verifyUpgrade(boolean orphan) {
    String schema = "team_upgrade_" + UUID.randomUUID().toString().replace("-", "");
    Flyway previous = flyway(schema, "19");
    previous.migrate();
    JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
        PG.getJdbcUrl() + (PG.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema,
        PG.getUsername(), PG.getPassword()));
    try {
      jdbc.update("""
          insert into users(id,username,user_type,status,created_at,updated_at)
          values (1,'upgrade','DEVELOPER','ACTIVE',now(),now())
          """);
      jdbc.update("""
          insert into github_repos(github_repo_id,owner_login,name,full_name,created_at,updated_at)
          values (123,'org','kept','org/kept',now(),now())
          """);
      if (orphan) {
        jdbc.update("insert into chat_rooms(room_type,team_id,created_at,updated_at) values ('TEAM',999,now(),now())");
        assertThatThrownBy(() -> flyway(schema, "20").migrate()).isInstanceOf(RuntimeException.class);
        assertThat(jdbc.queryForObject("select to_regclass('teams') is null", Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("select team_id from chat_rooms", Long.class)).isEqualTo(999);
      } else {
        Flyway current = flyway(schema, "20");
        assertThat(current.migrate().migrationsExecuted).isEqualTo(1);
        assertThat(current.migrate().migrationsExecuted).isZero();
        current.validate();
        assertThat(jdbc.queryForList("""
            select table_name from information_schema.tables
            where table_schema=current_schema() and table_name in
              ('github_installations','teams','team_members','team_repos','team_project_boards',
               'board_status_mappings','pull_requests')
            """, String.class)).hasSize(7);
      }
      assertThat(jdbc.queryForObject("select full_name from github_repos", String.class)).isEqualTo("org/kept");
      assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success and version::int <= 19", Long.class))
          .isEqualTo(19);
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
