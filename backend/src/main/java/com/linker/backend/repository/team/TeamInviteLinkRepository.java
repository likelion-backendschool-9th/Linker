package com.linker.backend.repository.team;

import com.linker.backend.entity.team.TeamInviteLink;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface TeamInviteLinkRepository extends JpaRepository<TeamInviteLink, Long> {
  Optional<TeamInviteLink> findByTokenHash(String hash);

  @Query("select l.teamId from TeamInviteLink l where l.tokenHash=:hash")
  Optional<Long> findTeamIdByHash(String hash);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select l from TeamInviteLink l where l.tokenHash=:hash")
  Optional<TeamInviteLink> lockByHash(String hash);

  List<TeamInviteLink> findByTeamIdAndRevokedAtIsNullAndExpiresAtGreaterThanOrderByIdDesc(
      long teamId, Instant now);

  @Query(
      "select count(n)>0 from Notification n where n.user.id=:userId and n.groupKey=:key and n.notificationType='TEAM_INVITE'")
  boolean wasNotified(long userId, String key);
}
