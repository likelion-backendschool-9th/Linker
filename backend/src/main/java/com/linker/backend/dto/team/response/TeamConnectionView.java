package com.linker.backend.dto.team.response;

import com.linker.backend.entity.team.type.BoardStatus;
import com.linker.backend.entity.team.type.BoardStatusColor;
import com.linker.backend.entity.team.type.BoardStatusColors;
import com.linker.backend.entity.team.type.TeamStatus;

/** Internal repository projection shared by B/C; not an additional HTTP response contract. */
public record TeamConnectionView(
    long teamId, long installationId, long githubOrgId, String githubOrgLogin, TeamStatus status,
    Long boardId, String projectNodeId, String statusFieldId, String startDateFieldId,
    String dueDateFieldId) {

  public record LinkedRepo(long repoId, long githubRepoId, String ownerLogin, String name) {}

  public record StatusMapping(
          String githubOptionId, BoardStatus linkerStatus, BoardStatusColor color)
      implements BoardStatusColors.ColoredMapping {}
}
