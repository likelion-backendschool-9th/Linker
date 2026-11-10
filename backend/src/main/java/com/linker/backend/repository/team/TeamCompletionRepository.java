package com.linker.backend.repository.team;
import com.linker.backend.entity.team.TeamCompletion;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
public interface TeamCompletionRepository extends JpaRepository<TeamCompletion,Long> {
  @Query("select c.teamId from TeamCompletion c where c.id=:id")
  long teamId(long id);
  Optional<TeamCompletion> findByTeamIdAndRevertedAtIsNull(long teamId);
  @Query("select c.id from TeamCompletion c where c.confirmedAt is null and c.revertedAt is null and c.revertibleUntil<=:now order by c.id")
  List<Long> findDue(Instant now,Pageable page);
}
