package com.linker.backend.repository.team;

import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.entity.team.type.TeamRole;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
  long countByTeamIdAndLeftAtIsNull(long teamId);

  @Query("""
      select count(m)>0 from TeamMember m, User u where m.userId=u.id and m.teamId=:teamId
        and m.role='OWNER' and m.leftAt is null and u.deletedAt is null
        and u.status='SUSPENDED' and u.suspendedUntil>:now
      """)
  boolean hasTemporarilySuspendedOwner(long teamId, java.time.Instant now);
  @Query("""
      select m.role from TeamMember m, Team t, User u
      where m.teamId = t.id and m.userId = u.id and m.teamId = :teamId
        and m.userId = :userId and m.leftAt is null
        and t.status not in ('ARCHIVED', 'DELETED') and u.userType = 'DEVELOPER'
        and u.deletedAt is null and u.status not in ('DELETED', 'WITHDRAWING')
      """)
  List<TeamRole> findCurrentAccessRoles(long userId, long teamId);

  List<TeamMember> findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(long teamId);

  java.util.Optional<TeamMember> findByTeamIdAndUserIdAndLeftAtIsNull(long teamId, long userId);

  /** Both people are current members of one team that is not deleted (POL-C-4 "same team"). */
  @Query("""
      select count(t) > 0 from TeamMember a, TeamMember b, Team t
      where a.teamId = b.teamId and t.id = a.teamId
        and a.userId = :firstUserId and b.userId = :secondUserId
        and a.leftAt is null and b.leftAt is null
        and t.status <> 'DELETED'
      """)
  boolean existsSharedTeam(long firstUserId, long secondUserId);

  /** Teams a recruit post can link (POL-R-1): current owner/admin of an active team, by name. */
  @Query("""
      select new com.linker.backend.dto.recruit.response.TeamOptionResponse(t.id, t.name)
      from TeamMember m, Team t
      where m.teamId = t.id and m.userId = :userId and m.leftAt is null
        and m.role in ('OWNER', 'ADMIN') and t.status = 'ACTIVE'
      order by lower(t.name), t.id
      """)
  List<com.linker.backend.dto.recruit.response.TeamOptionResponse> findRecruitLinkableTeams(long userId);

  /** Team chat @mention candidates (17): current members whose account is active, by login. */
  @Query("""
      select new com.linker.backend.dto.chat.response.ChatMemberResponse(
          u.id, u.username, coalesce(nullif(u.displayName, ''), u.username), u.avatarUrl)
      from TeamMember m, User u
      where m.userId = u.id and m.teamId = :teamId and m.leftAt is null
        and u.deletedAt is null and u.status = 'ACTIVE'
      order by lower(u.username), u.id
      """)
  List<com.linker.backend.dto.chat.response.ChatMemberResponse> findChatMentionCandidates(long teamId);
}
