package com.linker.backend.dto.team.response;

import java.time.Instant;

/** Internal persistence projections, shared without adding HTTP response fields. */
public final class TeamPersistenceView {
  private TeamPersistenceView() {}

  // Keep this record's name/fields: its toString participates in existing Redis job fingerprints.
  public record Team(long id, long installationId, long orgId, String orgLogin, String status) {}

  public record WorkspaceTeam(
      long id,
      String name,
      String avatarUrl,
      String status,
      String role,
      long memberCount,
      Instant joinedAt,
      Long chatRoomId,
      Long unreadCount,
      Long openIssueCount) {}

  public record GithubMember(long userId, String githubState, String githubUserId) {}
}
