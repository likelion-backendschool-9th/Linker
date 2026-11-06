package com.linker.backend.global.security;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Current DB membership, shared by B entry checks and C. Missing schema never grants access. */
@Component
public class MembershipTeamAccess implements TeamAccess {
  private final JdbcTemplate jdbc;

  public MembershipTeamAccess(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public boolean hasRole(long userId, long teamId, TeamRole.Level required) {
    if (userId <= 0 || teamId <= 0 || required == null) return false;
    if (!Boolean.TRUE.equals(
        jdbc.queryForObject(
            "select to_regclass('public.teams') is not null and to_regclass('public.team_members') is not null",
            Boolean.class))) return false;
    List<String> roles =
        jdbc.queryForList(
            """
                select m.role from team_members m join teams t on t.id=m.team_id
                join users u on u.id=m.user_id
                where m.user_id=? and m.team_id=? and m.left_at is null
                  and t.status not in ('ARCHIVED','DELETED') and u.user_type='DEVELOPER'
                  and u.deleted_at is null and u.status not in ('DELETED','WITHDRAWING')
                """,
            String.class,
            userId,
            teamId);
    return roles.stream()
        .anyMatch(
            role ->
                switch (required) {
                  case MEMBER -> List.of("OWNER", "ADMIN", "MEMBER").contains(role);
                  case ADMIN -> List.of("OWNER", "ADMIN").contains(role);
                  case OWNER -> "OWNER".equals(role);
                });
  }
}
