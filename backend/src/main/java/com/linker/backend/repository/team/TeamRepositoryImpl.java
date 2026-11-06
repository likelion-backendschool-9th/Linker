package com.linker.backend.repository.team;

import com.linker.backend.dto.team.response.TeamConnectionView;
import com.linker.backend.dto.team.response.TeamConnectionView.LinkedRepo;
import com.linker.backend.dto.team.response.TeamConnectionView.StatusMapping;
import com.linker.backend.entity.team.type.BoardStatus;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.service.user.OwnedTeamLookup.OwnedTeam;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/** Spring Data fragment. No component annotation: TeamRepository attaches it by name. */
@Transactional(readOnly = true)
public class TeamRepositoryImpl implements TeamRepositoryCustom {
  private final EntityManager entityManager;

  public TeamRepositoryImpl(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public List<OwnedTeam> findOwnedTeams(long userId) {
    // Preserve the withdrawal guard: even archived/deleted owned teams must not disappear here.
    return entityManager.createQuery("""
        select t.id, t.name from Team t, TeamMember m
        where m.teamId = t.id and m.userId = :user and m.role = 'OWNER'
          and m.leftAt is null order by t.id
        """, Object[].class).setParameter("user", userId).getResultList().stream()
        .map(row -> new OwnedTeam((Long) row[0], (String) row[1])).toList();
  }

  @Override
  public Optional<TeamConnectionView> findConnection(long teamId) {
    return entityManager.createQuery("""
        select t.id, i.githubInstallationId, t.githubOrgId, t.githubOrgLogin, t.status,
               b.id, b.githubProjectNodeId, b.statusFieldId, b.startDateFieldId, b.dueDateFieldId
        from Team t join GithubInstallation i on i.id = t.installationId
        left join TeamProjectBoard b on b.teamId = t.id
        where t.id = :team and t.status <> 'DELETED'
        """, Object[].class).setParameter("team", teamId).getResultList().stream()
        .map(row -> new TeamConnectionView((Long) row[0], (Long) row[1], (Long) row[2],
            (String) row[3], (TeamStatus) row[4], (Long) row[5], (String) row[6],
            (String) row[7], (String) row[8], (String) row[9])).findFirst();
  }

  @Override
  public List<LinkedRepo> findLinkedRepos(long teamId) {
    return entityManager.createQuery("""
        select r.id, r.githubRepoId, r.ownerLogin, r.name
        from TeamRepo tr join GithubRepo r on r.id = tr.repoId
        where tr.teamId = :team and r.deletedAt is null order by r.id
        """, Object[].class).setParameter("team", teamId).getResultList().stream()
        .map(row -> new LinkedRepo((Long) row[0], (Long) row[1], (String) row[2], (String) row[3]))
        .toList();
  }

  @Override
  public List<StatusMapping> findBoardStatusMappings(long boardId) {
    return entityManager.createQuery("""
        select m.githubOptionId, m.linkerStatus from BoardStatusMapping m
        where m.boardId = :board order by m.githubOptionId
        """, Object[].class).setParameter("board", boardId).getResultList().stream()
        .map(row -> new StatusMapping((String) row[0], (BoardStatus) row[1])).toList();
  }
}
