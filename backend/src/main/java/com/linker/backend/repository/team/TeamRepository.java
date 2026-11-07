package com.linker.backend.repository.team;

import com.linker.backend.dto.team.response.TeamPersistenceView;
import com.linker.backend.entity.team.Team;
import com.linker.backend.global.error.ApiException;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface TeamRepository extends JpaRepository<Team, Long>, TeamRepositoryCustom {
  Optional<Team> findByGithubOrgId(long githubOrgId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select t from Team t where t.id = :id")
  Optional<Team> lockTeamForSetup(long id);

  @Transactional(propagation = Propagation.MANDATORY)
  default void assertUnchanged(TeamPersistenceView.Team expected) {
    lockTeamForSetup(expected.id())
        .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "팀을 찾을 수 없어요"));
    if (!team(expected.id()).equals(expected))
      throw new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요. 다시 확인해 주세요");
  }

  @Query("""
      select t.id from Team t, GithubInstallation i, TeamRepo link, GithubRepo r
      where t.installationId=i.id and link.teamId=t.id and link.repoId=r.id
        and i.githubInstallationId=:installationId and t.githubOrgId=:orgId
        and r.githubRepoId=:githubRepoId and i.suspendedAt is null and i.removedAt is null
        and t.status in ('ACTIVE','COMPLETED') and r.deletedAt is null
        and lower(r.ownerLogin)=lower(t.githubOrgLogin)
      """)
  Optional<Long> findPullRequestTeam(long installationId, long orgId, long githubRepoId);

  @Query("select t.id from Team t where t.status in ('ACTIVE','COMPLETED') order by t.id")
  java.util.List<Long> findPullRequestSyncTeams();
}
