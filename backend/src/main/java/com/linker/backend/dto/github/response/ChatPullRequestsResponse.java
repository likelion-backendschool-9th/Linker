package com.linker.backend.dto.github.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(name = "ChatPullRequestsResponse")
public record ChatPullRequestsResponse(List<Item> items) {
  @Schema(name = "ChatPullRequest")
  public record Item(long id, long repoId, long githubRepoId, long githubPrId, String repo,
      int number, String title, String state, boolean draft, String author, String url) {}
}
