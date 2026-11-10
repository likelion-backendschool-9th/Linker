package com.linker.backend.repository.team;
import com.linker.backend.entity.team.CompletionRecord;
import org.springframework.data.jpa.repository.*;
public interface CompletionRecordRepository extends JpaRepository<CompletionRecord,Long> {
  @Query("select count(distinct i.id) from Issue i, IssueAssignee a where a.issueId=i.id and i.teamId=:teamId and a.userId=:userId and i.deletedAt is null")
  int countAssigned(long teamId,long userId);
  @Query("select count(distinct i.id) from Issue i, IssueAssignee a where a.issueId=i.id and i.teamId=:teamId and a.userId=:userId and i.deletedAt is null and i.boardStatus='DONE'")
  int countDone(long teamId,long userId);
}
