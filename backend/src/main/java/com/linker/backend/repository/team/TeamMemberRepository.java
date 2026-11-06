package com.linker.backend.repository.team;

import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.entity.team.type.TeamMemberRole;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
  @Query("""
      select m.role from TeamMember m, Team t, User u
      where m.teamId = t.id and m.userId = u.id and m.teamId = :teamId
        and m.userId = :userId and m.leftAt is null
        and t.status not in ('ARCHIVED', 'DELETED') and u.userType = 'DEVELOPER'
        and u.deletedAt is null and u.status not in ('DELETED', 'WITHDRAWING')
      """)
  List<TeamMemberRole> findCurrentAccessRoles(long userId, long teamId);

  List<TeamMember> findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(long teamId);
}
