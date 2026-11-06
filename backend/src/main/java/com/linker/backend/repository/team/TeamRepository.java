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
}
