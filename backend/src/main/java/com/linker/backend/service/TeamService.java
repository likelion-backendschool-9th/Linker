package com.linker.backend.service;

import com.linker.backend.dto.team.response.TeamInviteResponse.*;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.team.*;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Clock;
import java.util.HexFormat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public invitation reads; never delegates to the authenticated group's business services. */
@Service
public class TeamService {
  private final TeamInviteLinkRepository links;
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final SubscriptionRepository subscriptions;
  private final Clock clock;

  public TeamService(
      TeamInviteLinkRepository links,
      TeamRepository teams,
      TeamMemberRepository members,
      SubscriptionRepository subscriptions,
      Clock clock) {
    this.links = links;
    this.teams = teams;
    this.members = members;
    this.subscriptions = subscriptions;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Landing invite(String code, AuthenticatedUser viewer) {
    if (code == null || code.length() > 128) throw missing();
    String digest;
    try {
      digest =
          HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(code.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    var link = links.findByTokenHash(digest).orElseThrow(TeamService::missing);
    var team = teams.findById(link.getTeamId()).orElseThrow(TeamService::missing);
    String status =
        link.getRevokedAt() != null || team.getStatus() == TeamStatus.DELETED
            ? "REVOKED"
            : !link.getExpiresAt().isAfter(clock.instant()) ? "EXPIRED" : "VALID";
    String state = "ELIGIBLE";
    if (team.getStatus() == TeamStatus.READ_ONLY) state = "READ_ONLY";
    else if (team.getStatus() == TeamStatus.ARCHIVED) state = "ARCHIVED";
    else if (viewer != null && teams.currentMember(viewer.userId(), team.getId()))
      state = "ALREADY_MEMBER";
    else if (!subscriptions.hasFlexBenefit(team.getId(), clock.instant())
        && members.countByTeamIdAndLeftAtIsNull(team.getId()) >= PlanLimits.TEAM_MEMBERS_FREE)
      state = "TEAM_MEMBER_LIMIT";
    else if (viewer != null && teams.countedTeams(viewer.userId()) >= PlanLimits.TEAMS_PER_USER_MAX)
      state = "TEAM_COUNT_LIMIT";
    return new Landing(code, status, new Team(team.getId()), new Participation(state));
  }

  private static ApiException missing() {
    return new ApiException(404, "NOT_FOUND", "초대 정보를 찾을 수 없어요");
  }
}
