package com.linker.backend.dto.team.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public final class TeamInviteResponse {
  private TeamInviteResponse() {}

  @Schema(name = "CreatedTeamInvite")
  public record Created(
      @Schema(requiredMode = REQUIRED) long id,
      @Schema(requiredMode = REQUIRED) String code,
      @Schema(requiredMode = REQUIRED) Instant expiresAt,
      @Schema(requiredMode = REQUIRED) String createdBy) {}

  @Schema(name = "TeamInviteMetadata")
  public record Metadata(
      @Schema(requiredMode = REQUIRED) long id,
      @Schema(requiredMode = REQUIRED) Instant expiresAt,
      @Schema(requiredMode = REQUIRED) String createdBy) {}

  @Schema(name = "TeamInviteLinks")
  public record Links(@Schema(requiredMode = REQUIRED) List<Metadata> items) {}

  @Schema(name = "TeamInviteLanding")
  public record Landing(
      @Schema(requiredMode = REQUIRED) String code,
      @Schema(
              requiredMode = REQUIRED,
              allowableValues = {"VALID", "EXPIRED", "REVOKED"})
          String status,
      @Schema(requiredMode = REQUIRED) Team team,
      @Schema(requiredMode = REQUIRED) Participation participation) {}

  @Schema(name = "TeamInviteTarget")
  public record Team(@Schema(requiredMode = REQUIRED) long id) {}

  @Schema(name = "TeamInviteParticipation")
  public record Participation(
      @Schema(
              requiredMode = REQUIRED,
              allowableValues = {
                "ELIGIBLE",
                "ALREADY_MEMBER",
                "TEAM_MEMBER_LIMIT",
                "TEAM_COUNT_LIMIT",
                "ACCEPTED",
                "READ_ONLY",
                "ARCHIVED"
              })
          String state) {}

  @Schema(name = "AcceptedTeamInvite")
  public record Accepted(
      @Schema(requiredMode = REQUIRED) long teamId,
      @Schema(requiredMode = REQUIRED) String orgLogin,
      @Schema(requiredMode = REQUIRED) boolean needsGithubInvite) {}
}
