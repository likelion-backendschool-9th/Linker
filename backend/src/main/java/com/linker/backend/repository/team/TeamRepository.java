package com.linker.backend.repository.team;

import com.linker.backend.entity.team.Team;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, Long>, TeamRepositoryCustom {
  Optional<Team> findByGithubOrgId(long githubOrgId);
}
