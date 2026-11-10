package com.linker.backend.dto.team.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "TeamSettingsResponse")
public record TeamSettingsResponse(
    @Schema(requiredMode = REQUIRED) long id,
    @Schema(requiredMode = REQUIRED) String name,
    @Schema(requiredMode = REQUIRED, nullable = true) String description,
    @Schema(requiredMode = REQUIRED) String orgLogin,
    @Schema(requiredMode = REQUIRED, nullable = true) String orgAvatarUrl,
    @Schema(
            requiredMode = REQUIRED,
            allowableValues = {"ACTIVE", "COMPLETED", "READ_ONLY", "ARCHIVED"})
        String status,
    @Schema(
            requiredMode = REQUIRED,
            allowableValues = {"FREE", "FLEX"})
        String plan,
    @Schema(
            requiredMode = REQUIRED,
            allowableValues = {"OWNER", "ADMIN", "MEMBER"})
        String myRole,
    @Schema(requiredMode = REQUIRED) Permissions permissions,
    @Schema(requiredMode = REQUIRED) List<Repo> repos,
    @Schema(requiredMode = REQUIRED, nullable = true) Board board,
    @Schema(requiredMode = REQUIRED) boolean aiSummaryEnabled,
    @Schema(requiredMode = REQUIRED, nullable = true) Long memberLimit,
    @Schema(requiredMode = REQUIRED) Billing billing,
    @Schema(requiredMode = REQUIRED) boolean githubOrgOwner,
    @Schema(requiredMode = REQUIRED, nullable = true) String githubInvitationBlockedReason,
    @Schema(requiredMode=REQUIRED,nullable=true) OwnershipTransfer ownershipTransfer,
    @Schema(requiredMode=REQUIRED,nullable=true) Instant completedAt,
    @Schema(requiredMode=REQUIRED,nullable=true) Completion completion) {
  public record OwnershipTransfer(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) String fromName, @Schema(requiredMode=REQUIRED) String toName, @Schema(requiredMode=REQUIRED) boolean isRecipient) {}
  public record Completion(@Schema(requiredMode=REQUIRED) boolean canUndo, @Schema(requiredMode=REQUIRED) boolean finalized, @Schema(requiredMode=REQUIRED) boolean canRestart) {}
  public record TransferCreated(@Schema(requiredMode=REQUIRED) long transferId) {}
  public TeamSettingsResponse withGithubInvitation(boolean orgOwner, String reason) {
    return new TeamSettingsResponse(
        id,
        name,
        description,
        orgLogin,
        orgAvatarUrl,
        status,
        plan,
        myRole,
        permissions,
        repos,
        board,
        aiSummaryEnabled,
        memberLimit,
        billing,
        orgOwner,
        reason, ownershipTransfer, completedAt, completion);
  }

  @Schema(name = "TeamSettingsPermissions")
  public record Permissions(
      @Schema(requiredMode = REQUIRED) boolean editInfo,
      @Schema(requiredMode = REQUIRED) boolean manageRepos,
      @Schema(requiredMode = REQUIRED) boolean createInviteLink,
      @Schema(requiredMode = REQUIRED) boolean manageMembers,
      @Schema(requiredMode = REQUIRED) boolean changeRoles,
      @Schema(requiredMode = REQUIRED) boolean transferOwnership,
      @Schema(requiredMode = REQUIRED) boolean completeProject,
      @Schema(requiredMode = REQUIRED) boolean archive,
      @Schema(requiredMode = REQUIRED) boolean deleteTeam,
      @Schema(requiredMode = REQUIRED) boolean leave) {}

  @Schema(name = "TeamSettingsRepository")
  public record Repo(
      @Schema(requiredMode = REQUIRED) long id,
      @Schema(requiredMode = REQUIRED) long githubRepoId,
      @Schema(requiredMode = REQUIRED) String name,
      @Schema(requiredMode = REQUIRED) String fullName) {}

  @Schema(name = "TeamSettingsBoard")
  public record Board(
      @Schema(requiredMode = REQUIRED) long id,
      @Schema(requiredMode = REQUIRED) String name,
      @Schema(requiredMode = REQUIRED) String url) {}

  /** Current payer stays the billing manager after an ownership change (Policy ch. 11). */
  @Schema(name = "TeamSettingsBilling")
  public record Billing(
      @Schema(requiredMode = REQUIRED, nullable = true) Long managerUserId,
      @Schema(requiredMode = REQUIRED, nullable = true) String managerName,
      @Schema(requiredMode = REQUIRED) boolean canManage,
      @Schema(requiredMode = REQUIRED, nullable = true) Integer nextAmount,
      @Schema(requiredMode = REQUIRED, nullable = true) Instant nextBillingAt) {}

  @Schema(name = "TeamSettingsMember")
  public record Member(
      @Schema(requiredMode = REQUIRED) long userId,
      @Schema(requiredMode = REQUIRED, nullable = true) String handle,
      @Schema(requiredMode = REQUIRED) String name,
      @Schema(requiredMode = REQUIRED, nullable = true) String avatarUrl,
      @Schema(
              requiredMode = REQUIRED,
              allowableValues = {"OWNER", "ADMIN", "MEMBER"})
          String role,
      @Schema(
              requiredMode = REQUIRED,
              allowableValues = {"MEMBER", "INVITED", "NOT_MEMBER"})
          String githubOrgStatus,
      @Schema(requiredMode = REQUIRED) Instant joinedAt,
      @Schema(requiredMode = REQUIRED, nullable = true) String githubLogin) {}

  @Schema(name = "TeamSettingsMembers")
  public record Members(
      @Schema(requiredMode = REQUIRED) List<Member> items,
      @Schema(requiredMode = REQUIRED) long count,
      @Schema(requiredMode = REQUIRED, nullable = true) Long limit) {}
}
