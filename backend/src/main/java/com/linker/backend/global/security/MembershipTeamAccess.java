package com.linker.backend.global.security;

import com.linker.backend.entity.team.type.TeamMemberRole;
import com.linker.backend.repository.team.TeamMemberRepository;
import org.springframework.stereotype.Component;

/** Current DB membership, shared by B entry checks and C. Missing schema never grants access. */
@Component
public class MembershipTeamAccess implements TeamAccess {
  private final TeamMemberRepository members;

  public MembershipTeamAccess(TeamMemberRepository members) {
    this.members = members;
  }

  @Override
  public boolean hasRole(long userId, long teamId, TeamRole.Level required) {
    if (userId <= 0 || teamId <= 0 || required == null) return false;
    return members.findCurrentAccessRoles(userId, teamId).stream()
        .anyMatch(
            role ->
                switch (required) {
                  case MEMBER -> true;
                  case ADMIN -> role == TeamMemberRole.OWNER || role == TeamMemberRole.ADMIN;
                  case OWNER -> role == TeamMemberRole.OWNER;
                });
  }
}
