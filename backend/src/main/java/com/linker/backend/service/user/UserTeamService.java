package com.linker.backend.service.user;

import com.linker.backend.dto.team.request.*;
import com.linker.backend.dto.team.response.MyTeamsResponse;
import com.linker.backend.dto.team.response.MyTeamsResponse.TeamItem;
import com.linker.backend.dto.team.response.TeamSetupResponse;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.team.WorkspaceTeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserTeamService {
  private final WorkspaceTeamRepository teams;
  private final UserTeamSetupService setup;

  public UserTeamService(WorkspaceTeamRepository teams, UserTeamSetupService setup) {
    this.teams = teams;
    this.setup = setup;
  }

  @Transactional(readOnly = true)
  public MyTeamsResponse myTeams(AuthenticatedUser user) {
    if (user.userType() != UserType.DEVELOPER) {
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    }
    if (!teams.schemaReady()) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "팀 목록을 준비하고 있어요. 잠시 후 다시 시도해 주세요");
    }
    var rows = teams.findCurrentTeams(user.userId());
    long counted = rows.stream().filter(team -> !"ARCHIVED".equals(team.status())).count();
    var items =
        rows.stream()
            .map(
                team ->
                    new TeamItem(
                        team.id(),
                        team.name(),
                        team.avatarUrl(),
                        team.status(),
                        team.role(),
                        team.memberCount(),
                        team.joinedAt(),
                        team.chatRoomId(),
                        // Subscription is not connected yet: unknown is not Free.
                        null,
                        team.openIssueCount(),
                        team.unreadCount()))
            .toList();
    return new MyTeamsResponse(items, PlanLimits.TEAMS_PER_USER_MAX, counted, null);
  }

  public TeamSetupResponse.Created create(AuthenticatedUser user, CreateTeamRequest request) {
    return setup.create(user, request);
  }

  public TeamSetupResponse.Repos setupRepos(AuthenticatedUser user, long id) {
    return setup.repos(user, id);
  }

  public void saveSetupRepos(AuthenticatedUser user, long id, SaveTeamReposRequest request) {
    setup.saveRepos(user, id, request);
  }

  public TeamSetupResponse.Boards setupBoards(AuthenticatedUser user, long id) {
    return setup.boards(user, id);
  }

  public TeamSetupResponse.BoardSaved saveSetupBoard(
      AuthenticatedUser user, long id, SetupBoardRequest request) {
    return setup.board(user, id, request);
  }

  public TeamSetupResponse.Permission setupPermission(AuthenticatedUser user, long id) {
    return setup.permission(user, id);
  }

  public TeamSetupResponse.Complete completeSetup(AuthenticatedUser user, long id, boolean retry) {
    return setup.complete(user, id, retry);
  }
}
