package com.linker.backend.service.user;

import com.linker.backend.dto.team.request.*;
import com.linker.backend.dto.team.response.MyTeamsResponse;
import com.linker.backend.dto.team.response.MyTeamsResponse.TeamItem;
import com.linker.backend.dto.team.response.TeamSetupResponse;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.team.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("userTeamService")
public class TeamService {
  private final TeamRepository teams;
  private final TeamSetupService setup;
  private final TeamManagementService management;
  private final TeamInvitationService invitations;
  private final GithubInvitationService githubInvitations;
  private final com.linker.backend.repository.subscription.SubscriptionRepository subscriptions;
  private final java.time.Clock clock;

  public TeamService(
      TeamRepository teams,
      TeamSetupService setup,
      TeamManagementService management,
      TeamInvitationService invitations,
      GithubInvitationService githubInvitations,
      com.linker.backend.repository.subscription.SubscriptionRepository subscriptions,
      java.time.Clock clock) {
    this.teams = teams;
    this.setup = setup;
    this.management = management;
    this.invitations = invitations;
    this.githubInvitations = githubInvitations;
    this.subscriptions = subscriptions;
    this.clock = clock;
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
    // V24 is now integrated. Unknown remains unknown only when the subscription schema is
    // unavailable.
    var schema = subscriptions.benefitSchema(null);
    boolean plansReady = schema.ready() && schema.grace();
    java.util.Set<Long> flexTeams =
        plansReady && !rows.isEmpty()
            ? new java.util.HashSet<>(
                subscriptions.findTeamsWithFlexBenefit(
                    rows.stream().map(r -> r.id()).toList(), clock.instant()))
            : java.util.Set.of();
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
                        plansReady ? (flexTeams.contains(team.id()) ? "FLEX" : "FREE") : null,
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

  public com.linker.backend.dto.team.response.TeamSettingsResponse settings(AuthenticatedUser user, long id) {
    var response = management.settings(user, id);
    if (!"OWNER".equals(response.myRole()) || !response.permissions().editInfo()) return response;
    // The read transaction has ended before asking GitHub; an outage must not hide DB settings.
    try {
      boolean owner = githubInvitations.canInvite(user, id);
      return response.withGithubInvitation(owner, owner ? null : "GitHub 조직 오너만 조직에 초대할 수 있어요");
    } catch (ApiException failure) {
      return response.withGithubInvitation(false, failure.getMessage());
    }
  }

  public com.linker.backend.dto.team.response.TeamSettingsResponse.Members members(AuthenticatedUser user, long id) {
    return management.members(user, id);
  }

  public void update(AuthenticatedUser user, long id, UpdateTeamRequest request) {
    management.update(user, id, request);
  }

  public void changeRole(AuthenticatedUser user, long id, long targetId, ChangeTeamRoleRequest request) {
    management.changeRole(user, id, targetId, request);
  }

  public void removeMember(AuthenticatedUser user, long id, long targetId) {
    management.remove(user, id, targetId);
  }

  public void leave(AuthenticatedUser user, long id) {
    management.leave(user, id);
  }

  public void archive(AuthenticatedUser user, long id) {
    management.archive(user, id);
  }

  public void delete(AuthenticatedUser user, long id, DeleteTeamRequest request) {
    management.delete(user, id, request);
  }

  public void addRepo(AuthenticatedUser user, long id, AddTeamRepoRequest request) {
    management.addRepo(user, id, request);
  }

  public void removeRepo(AuthenticatedUser user, long id, long repoId) {
    management.removeRepo(user, id, repoId);
  }

  public com.linker.backend.dto.team.response.TeamInviteResponse.Links inviteLinks(
      AuthenticatedUser user, long teamId) {
    return invitations.list(user, teamId);
  }

  public com.linker.backend.dto.team.response.TeamInviteResponse.Created createInvite(
      AuthenticatedUser user, long teamId) {
    return invitations.create(user, teamId);
  }

  public void notifyInvite(
      AuthenticatedUser user, long teamId, long linkId, NotifyTeamInviteRequest request) {
    invitations.notify(user, teamId, linkId, request);
  }

  public void revokeInvite(AuthenticatedUser user, long teamId, long linkId) {
    invitations.revoke(user, teamId, linkId);
  }

  public com.linker.backend.dto.team.response.TeamInviteResponse.Accepted acceptInvite(
      AuthenticatedUser user, String code) {
    return invitations.accept(user, code);
  }
  public com.linker.backend.dto.team.response.TeamSettingsResponse.TransferCreated requestOwnership(AuthenticatedUser user,long teamId,TransferTeamOwnershipRequest request) {return management.requestOwnership(user,teamId,request);}
  public void acceptOwnership(AuthenticatedUser user,long teamId,long transferId) {management.acceptOwnership(user,teamId,transferId);}
  public void completeProject(AuthenticatedUser user,long teamId) {management.complete(user,teamId);}
  public void undoCompletion(AuthenticatedUser user,long teamId) {management.undoCompletion(user,teamId);}

}
