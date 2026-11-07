package com.linker.backend.dto.github.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(name = "ChatPullRequestsResponse", requiredProperties = {"items"})
public record ChatPullRequestsResponse(List<Item> items) {
  @Schema(name = "ChatPullRequest", requiredProperties = {"id", "repoId", "githubRepoId", "githubPrId",
      "repo", "number", "title", "state", "draft", "author", "url"})
  public record Item(long id, long repoId, long githubRepoId, long githubPrId, String repo,
      int number, String title, String state, boolean draft, String author, String url) {}
}
