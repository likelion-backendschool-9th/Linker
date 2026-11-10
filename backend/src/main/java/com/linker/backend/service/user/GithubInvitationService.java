package com.linker.backend.service.user;

import com.linker.backend.dto.github.response.GithubOrgInvitationResponse;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.team.*;
import com.linker.backend.entity.team.type.*;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.account.AuthIdentityRepository;
import com.linker.backend.repository.team.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

@Service("userGithubInvitationService")
public class GithubInvitationService {
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final GithubOrgInvitationRepository invitations;
  private final AuthIdentityRepository identities;
  private final GithubTeamSource github;
  private final TransactionTemplate write;
  private final java.time.Clock clock;

  public GithubInvitationService(
      TeamRepository teams,
      TeamMemberRepository members,
      GithubOrgInvitationRepository invitations,
      AuthIdentityRepository identities,
      GithubTeamSource github,
      PlatformTransactionManager transactions,
      java.time.Clock clock) {
    this.clock = clock;
    this.teams = teams;
    this.members = members;
    this.invitations = invitations;
    this.identities = identities;
    this.github = github;
    this.write = new TransactionTemplate(transactions);
  }

  @Transactional(propagation = Propagation.NEVER)
  public boolean canInvite(AuthenticatedUser user, long teamId) {
    var team = authorize(user, teamId);
    return github.organizationOwner(user.userId(), team.getGithubOrgId(), team.getGithubOrgLogin());
  }

  @Transactional(propagation = Propagation.NEVER)
  public GithubOrgInvitationResponse invite(AuthenticatedUser user, long teamId, long targetId) {
    return teams.withTeamSetupLock(
        teamId,
        () -> {
          var team = authorize(user, teamId);
          if (!github.organizationOwner(
              user.userId(), team.getGithubOrgId(), team.getGithubOrgLogin()))
            throw new ApiException(403, "FORBIDDEN", "GitHub 조직 오너만 조직에 초대할 수 있어요");
          var target =
              members
                  .findByTeamIdAndUserIdAndLeftAtIsNull(teamId, targetId)
                  .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "현재 팀원을 찾을 수 없어요"));
          if (target.getGithubOrgState() == GithubOrgState.MEMBER)
            return new GithubOrgInvitationResponse(false, "MEMBER");
          if (!teams.isActiveUser(targetId))
            throw new ApiException(403, "FORBIDDEN", "이 사용자에게 초대를 보낼 수 없어요");
          long githubId;
          try {
            githubId =
                Long.parseLong(
                    identities
                        .findGithubUserId(targetId)
                        .orElseThrow(
                            () -> new ApiException(404, "NOT_FOUND", "GitHub 계정을 찾을 수 없어요")));
          } catch (NumberFormatException e) {
            throw new ApiException(409, "STATE_CONFLICT", "GitHub 계정을 확인해 주세요");
          }
          if (githubId <= 0) throw new ApiException(409, "STATE_CONFLICT", "GitHub 계정을 확인해 주세요");
          String targetLogin =
              identities
                  .findGithubLogin(targetId)
                  .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "GitHub 계정을 찾을 수 없어요"));
          String remoteState =
              github.organizationMemberState(
                  user.userId(),
                  team.getGithubOrgId(),
                  team.getGithubOrgLogin(),
                  targetLogin,
                  githubId);
          var previous =
              invitations.findFirstByTeamIdAndInviteeUserIdOrderByIdDesc(teamId, targetId);
          if ("ACTIVE".equals(remoteState)) {
            write.executeWithoutResult(status -> {
              teams.confirmMember(teamId, targetId, clock.instant());
              previous.ifPresent(
                  row -> invitations.findById(row.getId()).ifPresent(GithubOrgInvitation::accept));
            });
            return new GithubOrgInvitationResponse(false, "MEMBER");
          }
          if ("PENDING".equals(remoteState)) {
            write.executeWithoutResult(status -> {
              teams.lockTeamForSetup(teamId).orElseThrow();
              authorize(user, teamId);
              var saved =
                  previous
                      .flatMap(row -> invitations.findById(row.getId()))
                      .orElseGet(() ->
                          invitations.save(
                              GithubOrgInvitation.pending(
                                  teamId, user.userId(), targetId, targetLogin)));
              saved.pending();
              members
                  .findByTeamIdAndUserIdAndLeftAtIsNull(teamId, targetId)
                  .ifPresent(TeamMember::markGithubInvited);
            });
            return new GithubOrgInvitationResponse(false, "PENDING");
          }
          if (!"NONE".equals(remoteState))
            throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 초대 상태를 확인해 주세요");
          // Remote membership resolves uncertain previous attempts before any new invitation write.
          previous
              .filter(row -> row.getStatus() == GithubInvitationStatus.PENDING)
              .ifPresent(row ->
                  write.executeWithoutResult(status ->
                      invitations.findById(row.getId()).ifPresent(GithubOrgInvitation::expire)));
          var row =
              write.execute(status -> {
                teams.lockTeamForSetup(teamId).orElseThrow();
                authorize(user, teamId);
                teams.requireActive(targetId);
                members
                    .findByTeamIdAndUserIdAndLeftAtIsNull(teamId, targetId)
                    .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "현재 팀원을 찾을 수 없어요"));
                return invitations.saveAndFlush(
                    GithubOrgInvitation.pending(teamId, user.userId(), targetId, targetLogin));
              });
          try {
            long remoteId =
                github.inviteOrganizationMember(
                    user.userId(), team.getGithubOrgId(), team.getGithubOrgLogin(), githubId);
            write.executeWithoutResult(status -> {
              var saved = invitations.findById(row.getId()).orElseThrow();
              saved.sent(remoteId);
              members
                  .findByTeamIdAndUserIdAndLeftAtIsNull(teamId, targetId)
                  .ifPresent(TeamMember::markGithubInvited);
              // Existing member confirmation/sync owns ACCEPTED; PENDING never means org
              // membership.
            });
            return new GithubOrgInvitationResponse(true, "PENDING");
          } catch (RuntimeException failure) {
            write.executeWithoutResult(
                status -> invitations.findById(row.getId()).ifPresent(GithubOrgInvitation::fail));
            throw failure;
          }
        });
  }

  private Team authorize(AuthenticatedUser user, long teamId) {
    if (user.userType() != UserType.DEVELOPER
        || !teams.isActiveUser(user.userId())
        || !teams.currentOwner(user.userId(), teamId))
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 오너만 사용할 수 있어요");
    var team =
        teams.findById(teamId).orElseThrow(() -> new ApiException(404, "NOT_FOUND", "팀을 찾을 수 없어요"));
    if (team.getStatus() != TeamStatus.ACTIVE && team.getStatus() != TeamStatus.COMPLETED)
      throw new ApiException(409, "STATE_CONFLICT", "읽기 전용 팀은 변경할 수 없어요");
    return team;
  }
}
