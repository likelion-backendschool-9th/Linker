package com.linker.backend.dto.team.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** Page-08 response contracts; never exposes provider credentials. */
public final class TeamSetupResponse {
  private TeamSetupResponse() {}

  @Schema(
      name = "TeamCreatedResponse",
      requiredProperties = {"id", "name", "chatRoomId"})
  public record Created(long id, String name, long chatRoomId) {}

  @Schema(
      name = "TeamSetupRepository",
      requiredProperties = {"id", "name", "fullName", "private"})
  public record Repo(
      long id, String name, String fullName, @JsonProperty("private") boolean isPrivate) {}

  @Schema(
      name = "TeamSetupRepositories",
      requiredProperties = {"items", "notInstalledCount", "settingsUrl"})
  public record Repos(
      List<Repo> items, @Schema(nullable = true) Integer notInstalledCount, String settingsUrl) {}

  @Schema(
      name = "TeamSetupStatusOption",
      requiredProperties = {"id", "name", "color"})
  public record Option(
      String id,
      String name,
      @Schema(
              allowableValues = {
                "BLUE",
                "GRAY",
                "GREEN",
                "ORANGE",
                "PINK",
                "PURPLE",
                "RED",
                "YELLOW"
              })
          String color) {}

  @Schema(
      name = "TeamSetupBoardPreview",
      requiredProperties = {"id", "name", "cardCount", "statusColumns", "statusOptions"})
  public record Board(
      String id,
      String name,
      int cardCount,
      List<String> statusColumns,
      List<Option> statusOptions) {}

  @Schema(
      name = "TeamSetupBoards",
      requiredProperties = {"items"})
  public record Boards(List<Board> items) {}

  @Schema(
      name = "TeamSetupBoardSaved",
      requiredProperties = {"boardId", "name"})
  public record BoardSaved(String boardId, String name) {}

  @Schema(
      name = "TeamSetupPermission",
      requiredProperties = {"basePermission", "settingsUrl"})
  public record Permission(
      @Schema(allowableValues = {"NONE", "READ", "WRITE", "ADMIN"}) String basePermission,
      String settingsUrl) {}

  @Schema(
      name = "TeamSetupProgress",
      requiredProperties = {"queued", "state", "failedStep"})
  public record Complete(
      boolean queued,
      @Schema(allowableValues = {"QUEUED", "RUNNING", "COMPLETED", "FAILED", "STALE"}) String state,
      @Schema(nullable = true) String failedStep) {}
}
