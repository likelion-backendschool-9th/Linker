package com.linker.backend.service.user;

import com.linker.backend.dto.github.request.VerifyInstallationRequest;
import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.github.response.InstallUrlResponse;
import com.linker.backend.dto.github.response.VerifyInstallationResponse;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.GithubInstallationState;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.integration.github.GithubUserAccessTokenSource;
import com.linker.backend.repository.team.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Installation entry contract; team creation/linking lives in the paired team use cases. */
@Service("userGithubService")
public class GithubService {
  private final GithubAppProperties properties;
  private final GithubInstallationState states;
  private final GithubUserAccessTokenSource tokens;
  private final GithubAppClient github;
  private final GithubTeamSource setup;
  private final TeamRepository teams;
  private final GithubPullRequestService requests;
  private final GithubInvitationService invitations;

  public GithubService(
      GithubAppProperties properties,
      GithubInstallationState states,
      GithubUserAccessTokenSource tokens,
      GithubAppClient github,
      GithubTeamSource setup,
      TeamRepository teams,
      GithubPullRequestService requests,
      GithubInvitationService invitations) {
    this.properties = properties;
    this.states = states;
    this.tokens = tokens;
    this.github = github;
    this.setup = setup;
    this.teams = teams;
    this.requests = requests;
    this.invitations = invitations;
  }

  @Transactional(propagation = Propagation.NEVER)
  public InstallUrlResponse installUrl(AuthenticatedUser user) {
    requireDeveloper(user);
    if (properties.id().isBlank() || !properties.slug().matches("[a-zA-Z0-9-]+")) {
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub App 설정이 필요해요");
    }
    String state = states.issue(user.userId(), user.sessionId());
    return new InstallUrlResponse(
        "https://github.com/apps/" + properties.slug() + "/installations/new?state=" + state,
        state);
  }

  @Transactional(propagation = Propagation.NEVER)
  public VerifyInstallationResponse verify(
      AuthenticatedUser user, VerifyInstallationRequest request) {
    requireDeveloper(user);
    if ("request".equals(request.setupAction())) {
      states.consume(request.state(), user.userId(), user.sessionId());
      if (!setup.hasPendingInstallationRequest(user.userId()))
        throw new ApiException(403, "FORBIDDEN", "GitHub 앱 설치 요청을 확인할 수 없어요");
      return new VerifyInstallationResponse("REQUESTED_FROM_OWNER", null, null, null);
    }
    long id;
    try {
      id = Long.parseLong(request.installationId());
      if (id <= 0) {
        throw new NumberFormatException();
      }
    } catch (NumberFormatException exception) {
      throw new ApiException(400, "VALIDATION_ERROR", "설치 정보를 확인해 주세요");
    }
    states.consume(request.state(), user.userId(), user.sessionId());
    GithubInstallationView verified =
        github.verifyUserInstallation(tokens.tokenFor(user.userId()), id);
    Long linked = teams.linkedOrg(verified.orgId());
    boolean reconnect = false;
    if (linked != null && teams.currentOwner(user.userId(), linked)) {
      // Let the owner reach create(), which revalidates permissions and reuses the
      // team/chat. A webhook may already have replaced the installation ID before this callback.
      reconnect = teams.findConnection(linked)
          .filter(team -> java.util.List.of(TeamStatus.ACTIVE, TeamStatus.COMPLETED, TeamStatus.READ_ONLY).contains(team.status()))
          .isPresent();
    }
    return new VerifyInstallationResponse(
        linked == null || reconnect ? "INSTALLED" : "ALREADY_LINKED",
        new VerifyInstallationResponse.Organization(
            verified.orgId(), verified.login(), verified.avatarUrl()),
        Long.toString(verified.installationId()),
        linked != null && teams.currentMember(user.userId(), linked) ? linked : null);
  }

  private void requireDeveloper(AuthenticatedUser user) {
    if (user == null) {
      throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
    }
    if (user.userType() != UserType.DEVELOPER || user.status() != UserStatus.ACTIVE) {
      throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
    }
  }

  public com.linker.backend.dto.github.response.ChatPullRequestsResponse pullRequests(
      AuthenticatedUser user, long roomId, String state) {
    return requests.list(user, roomId, state);
  }

  public com.linker.backend.dto.github.response.GithubOrgInvitationResponse inviteToOrganization(
      AuthenticatedUser user, long teamId, long targetId) {
    return invitations.invite(user, teamId, targetId);
  }
}
