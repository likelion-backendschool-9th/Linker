package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"repos", "labels", "members", "statuses"})
public record IssueFilterOptionsResponse(
    List<Repo> repos,
    List<IssueListResponse.Label> labels,
    List<Member> members,
    @Schema(description = "TODO, IN_PROGRESS, BLOCKED, DONE, OTHER, NONE") List<String> statuses) {
  @Schema(
      name = "IssueRepositoryOption",
      requiredProperties = {"id", "name"})
  public record Repo(long id, String name) {}

  @Schema(
      name = "IssueMemberOption",
      requiredProperties = {"id", "login", "name", "avatarUrl"})
  public record Member(
      long id, String login, String name, @Schema(nullable = true) String avatarUrl) {}
}
