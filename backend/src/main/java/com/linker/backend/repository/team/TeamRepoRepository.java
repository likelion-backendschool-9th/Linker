package com.linker.backend.repository.team;

import com.linker.backend.entity.team.TeamRepo;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepoRepository extends JpaRepository<TeamRepo, Long> {
  Optional<TeamRepo> findByTeamIdAndRepoId(long teamId, long repoId);
}
