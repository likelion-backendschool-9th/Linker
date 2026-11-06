package com.linker.backend.support;

import java.util.concurrent.atomic.AtomicLong;
import org.springframework.jdbc.core.JdbcTemplate;

/** Test data for the real V20 schema; never creates or alters production tables. */
public final class TeamTestFixtures {
  private static final AtomicLong GITHUB_IDS = new AtomicLong(1_000_000);

  private TeamTestFixtures() {}

  public static long team(JdbcTemplate jdbc, long ownerId, String name, String status) {
    long githubId = GITHUB_IDS.incrementAndGet();
    Long installationId = jdbc.queryForObject("""
        insert into github_installations(github_installation_id,account_id,account_login,
          account_type,repository_selection,installed_by,created_at,updated_at)
        values (?,?,'fixture-org','Organization','ALL',?,now(),now()) returning id
        """, Long.class, githubId, githubId, ownerId);
    return jdbc.queryForObject("""
        insert into teams(installation_id,github_org_id,github_org_login,name,status,created_by,
          created_at,updated_at) values (?,?,'fixture-org',?,?,?,now(),now()) returning id
        """, Long.class, installationId, githubId, name, status, ownerId);
  }
}
