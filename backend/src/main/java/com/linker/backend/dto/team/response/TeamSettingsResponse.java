package com.linker.backend.dto.team.response;

import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "TeamSettingsResponse")
public record TeamSettingsResponse(
    long id, String name, String description, String orgLogin, String orgAvatarUrl,
    String status, String plan, String myRole, Permissions permissions,
    List<Repo> repos, Board board, boolean aiSummaryEnabled, Long memberLimit,
    Billing billing) {
  @Schema(name = "TeamSettingsPermissions")
  public record Permissions(boolean editInfo, boolean manageRepos, boolean createInviteLink,
      boolean manageMembers, boolean changeRoles, boolean transferOwnership,
      boolean completeProject, boolean archive, boolean deleteTeam, boolean leave) {}
  @Schema(name = "TeamSettingsRepository")
  public record Repo(long id, long githubRepoId, String name, String fullName) {}
  @Schema(name = "TeamSettingsBoard")
  public record Board(long id, String name, String url) {}
  /** Current payer stays the billing manager after an ownership change (Policy ch. 11). */
  @Schema(name = "TeamSettingsBilling")
  public record Billing(Long managerUserId, String managerName, boolean canManage,
      Integer nextAmount, Instant nextBillingAt) {}
  @Schema(name = "TeamSettingsMember")
  public record Member(long userId, String handle, String name, String avatarUrl,
      String role, String githubOrgStatus, Instant joinedAt) {}
  @Schema(name = "TeamSettingsMembers")
  public record Members(List<Member> items, long count, Long limit) {}
}
