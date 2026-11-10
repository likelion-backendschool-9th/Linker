package com.linker.backend.global.security;

import com.linker.backend.repository.team.TeamMemberRepository;
import org.springframework.stereotype.Component;

/** Current DB membership, shared by B entry checks and C. Missing schema never grants access. */
@Component
public class MembershipTeamAccess implements TeamAccess {
  private final TeamMemberRepository members;
  private final java.time.Clock clock;

  public MembershipTeamAccess(TeamMemberRepository members, java.time.Clock clock) {
    this.members = members;
    this.clock = clock;
  }

  @Override
  public boolean hasRole(long userId, long teamId, TeamRole.Level required) {
    if (userId <= 0 || teamId <= 0 || required == null) return false;
    return members.findCurrentAccessRoles(userId, teamId).stream()
        .anyMatch(
            role ->
                switch (required) {
                  case MEMBER -> true;
                  case ADMIN -> role == com.linker.backend.entity.team.type.TeamRole.OWNER
                      || role == com.linker.backend.entity.team.type.TeamRole.ADMIN;
                  case OWNER -> role == com.linker.backend.entity.team.type.TeamRole.OWNER
                      || (role == com.linker.backend.entity.team.type.TeamRole.ADMIN
                          && members.hasTemporarilySuspendedOwner(teamId, clock.instant()));
                });
  }
}
