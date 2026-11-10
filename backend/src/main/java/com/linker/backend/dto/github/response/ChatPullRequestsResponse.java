package com.linker.backend.dto.github.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.time.Instant;

@Schema(name = "ChatPullRequestsResponse", requiredProperties = {"items"})
public record ChatPullRequestsResponse(List<Item> items) {
  @Schema(name = "ChatPullRequest", requiredProperties = {"id", "repoId", "githubRepoId", "githubPrId",
      "repo", "number", "title", "state", "draft", "author", "url", "githubUpdatedAt"})
  public record Item(long id, long repoId, long githubRepoId, long githubPrId, String repo,
      int number, String title, String state, boolean draft, String author, String url,
      @Schema(description = "Last update time reported by GitHub; not the local cache creation time") Instant githubUpdatedAt) {}
}
