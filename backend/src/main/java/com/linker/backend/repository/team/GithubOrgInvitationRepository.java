package com.linker.backend.repository.team;

import com.linker.backend.entity.team.GithubOrgInvitation;
import com.linker.backend.entity.team.type.GithubInvitationStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GithubOrgInvitationRepository extends JpaRepository<GithubOrgInvitation, Long> {
  Optional<GithubOrgInvitation> findFirstByTeamIdAndInviteeUserIdOrderByIdDesc(
      long teamId, long userId);
}
