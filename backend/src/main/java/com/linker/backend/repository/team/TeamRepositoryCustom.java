package com.linker.backend.repository.team;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.dto.team.request.CreateTeamRequest;
import com.linker.backend.dto.team.response.TeamConnectionView;
import com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo;
import com.linker.backend.dto.team.response.TeamConnectionView.StatusMapping;
import com.linker.backend.dto.team.response.TeamPersistenceView;
import com.linker.backend.dto.team.response.TeamSetupResponse.Created;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.service.user.OwnedTeamLookup;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface TeamRepositoryCustom {
  List<OwnedTeamLookup.OwnedTeam> findOwnedTeams(long userId);

  /** installationId is the external GitHub installation ID, not github_installations.id. */
  Optional<TeamConnectionView> findConnection(long teamId);

  List<LinkedRepo> findLinkedRepos(long teamId);

  List<StatusMapping> findBoardStatusMappings(long boardId);

  boolean ready(String... tables);

  void requireSchema(String... tables);

  default boolean schemaReady() {
    return ready("teams", "team_members");
  }

  TeamPersistenceView.Team team(long id);

  Long linkedOrg(long orgId);

  boolean currentMember(long userId, long teamId);

  boolean currentOwner(long userId, long teamId);

  boolean lockActiveDeveloper(long userId);

  long countedTeams(long userId);

  Created create(
      long userId, GithubInstallationView verified, CreateTeamRequest command, Instant now);

  Created reconnect(
      long teamId, long userId, GithubInstallationView verified, String nextStatus, Instant now);

  long upsertInstallation(long userId, GithubInstallationView verified, Instant now);

  void saveRepos(long teamId, long userId, List<GithubTeamSource.Repository> repos, Instant now);

  long cacheRepo(GithubTeamSource.Repository repo, Instant now);

  void renameGithubRepository(long githubRepoId, String owner, String name, Instant now);

  List<GithubTeamSource.Repository> repos(long teamId);

  void saveBoard(
      long teamId,
      long userId,
      GithubTeamSource.Project project,
      boolean created,
      String statusField,
      String startField,
      String dueField,
      Map<String, String> mapping,
      Instant now);

  String boardId(long teamId);

  boolean boardCreatedByLinker(long teamId);

  void saveBasePermission(long teamId, String permission, Instant now);

  boolean isActiveUser(long userId);

  void requireActive(long userId);

  String setupRevision(long teamId);

  List<TeamPersistenceView.WorkspaceTeam> findCurrentTeams(long userId);

  long repoId(long githubRepoId);

  void cachePullRequest(long teamId, long repoId, GithubTeamSource.PullRequest pr, Instant now);

  List<TeamPersistenceView.GithubMember> githubMembers(long teamId);

  void confirmMember(long teamId, long userId, Instant now);

  int removeOrgMember(long teamId, long userId, Instant now);

  void closeChatMembership(long teamId, long userId, Instant now);

  List<Long> currentOwnerIds(long teamId, boolean activeAccountsOnly);

  boolean canReceiveNotification(long userId);

  void markInstallationRemoved(long installationId, Instant now);

  long creatorId(long teamId);

  void suspendInstallation(long localId, Instant suspendedAt);

  void linkInstallation(long teamId, long localId, String login, Instant now);

  int markReadOnly(long teamId, Instant now);

  void restoreActive(long teamId, Instant now);

  void renameOrganization(
      long teamId, long installationId, String oldLogin, String login, Instant now);

  void archiveReadOnly(Instant threshold, Instant now);

  @Transactional(propagation = Propagation.NEVER)
  <T> T withTeamSetupLock(long id, Supplier<T> operation);

  @Transactional(propagation = Propagation.NEVER)
  <T> T withOrganizationSetupLock(long id, Supplier<T> operation);
}
