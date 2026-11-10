package com.linker.backend.service.user;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.team.request.NotifyTeamInviteRequest;
import com.linker.backend.dto.team.response.TeamInviteResponse.*;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.team.*;
import com.linker.backend.entity.team.type.*;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.*;
import com.linker.backend.repository.chat.*;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.team.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Page 09/10 writes. Permissions, membership and invite validity are always rechecked in the DB.
 */
@Service("userTeamInvitationService")
public class TeamInvitationService {
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final TeamInviteLinkRepository links;
  private final UserRepository users;
  private final AuthIdentityRepository identities;
  private final ChatRoomRepository rooms;
  private final ChatRoomMemberRepository participants;
  private final SubscriptionRepository subscriptions;
  private final UserBlockRepository blocks;
  private final NotificationService notifications;
  private final Clock clock;
  private final JsonMapper json;
  private final SecureRandom random = new SecureRandom();

  public TeamInvitationService(
      TeamRepository teams,
      TeamMemberRepository members,
      TeamInviteLinkRepository links,
      UserRepository users,
      AuthIdentityRepository identities,
      ChatRoomRepository rooms,
      ChatRoomMemberRepository participants,
      SubscriptionRepository subscriptions,
      UserBlockRepository blocks,
      NotificationService notifications,
      Clock clock,
      JsonMapper json) {
    this.teams = teams;
    this.members = members;
    this.links = links;
    this.users = users;
    this.identities = identities;
    this.rooms = rooms;
    this.participants = participants;
    this.subscriptions = subscriptions;
    this.blocks = blocks;
    this.notifications = notifications;
    this.clock = clock;
    this.json = json;
  }

  @Transactional(readOnly = true)
  public Links list(AuthenticatedUser user, long teamId) {
    requireAdmin(user, teams.findById(teamId).orElseThrow(TeamInvitationService::missing), false);
    return new Links(
        links
            .findByTeamIdAndRevokedAtIsNullAndExpiresAtGreaterThanOrderByIdDesc(
                teamId, clock.instant())
            .stream()
            .map(link ->
                new Metadata(
                    link.getId(),
                    link.getExpiresAt(),
                    users.findById(link.getCreatedBy()).map(User::visibleName).orElse("탈퇴한 사용자")))
            .toList());
  }

  @Transactional
  public Created create(AuthenticatedUser user, long teamId) {
    requireAdmin(user, teams.lockTeamForSetup(teamId).orElseThrow(TeamInvitationService::missing));
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    var link =
        links.saveAndFlush(
            TeamInviteLink.create(
                teamId,
                hash(code),
                user.userId(),
                clock.instant().plus(PlanLimits.TEAM_INVITE_VALID_DAYS, ChronoUnit.DAYS)));
    // Only creation returns plaintext; neither database rows nor list responses can reconstruct it.
    return new Created(
        link.getId(),
        code,
        link.getExpiresAt(),
        users.findById(user.userId()).orElseThrow(TeamInvitationService::missing).visibleName());
  }

  @Transactional
  public void revoke(AuthenticatedUser user, long teamId, long linkId) {
    requireAdmin(user, teams.lockTeamForSetup(teamId).orElseThrow(TeamInvitationService::missing));
    var link =
        links
            .findById(linkId)
            .filter(l -> l.getTeamId() == teamId)
            .orElseThrow(TeamInvitationService::missing);
    link.revoke(clock.instant());
  }

  @Transactional
  public void notify(
      AuthenticatedUser user, long teamId, long linkId, NotifyTeamInviteRequest request) {
    var team = teams.lockTeamForSetup(teamId).orElseThrow(TeamInvitationService::missing);
    requireAdmin(user, team);
    var link =
        links
            .findById(linkId)
            .filter(l -> l.getTeamId() == teamId)
            .orElseThrow(TeamInvitationService::missing);
    requireValid(link);
    if (!MessageDigest.isEqual(
        link.getTokenHash().getBytes(StandardCharsets.US_ASCII),
        hash(request.code()).getBytes(StandardCharsets.US_ASCII))) throw missing();
    String handle = request.handle().trim().replaceFirst("^@", "");
    var candidates =
        identities.findGithubUsersByLogin(handle).stream()
            .filter(u ->
                u.getUserType() == UserType.DEVELOPER
                    && u.getStatus() == UserStatus.ACTIVE
                    && u.getDeletedAt() == null)
            .toList();
    if (candidates.isEmpty()) throw new ApiException(404, "NOT_FOUND", "초대할 개발자를 찾을 수 없어요");
    if (candidates.size() != 1)
      throw new ApiException(400, "VALIDATION_ERROR", "초대할 개발자 아이디를 다시 확인해 주세요");
    var target = candidates.getFirst();
    if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(target.getId(), user.userId()))
      throw new ApiException(403, "FORBIDDEN", "이 사용자에게 초대를 보낼 수 없어요");
    if (teams.currentMember(target.getId(), teamId))
      throw new ApiException(409, "ALREADY_MEMBER", "이미 함께하는 팀이에요");
    String key = "team-invite:" + linkId + ":" + target.getId();
    if (!links.wasNotified(target.getId(), key))
      notifications.create(
          new CreateNotificationCommand(
              target.getId(),
              "TEAM_INVITE",
              user.userId(),
              "TEAM",
              teamId,
              "/invite/" + request.code(),
              json.writeValueAsString(
                  Map.of("title", team.getName() + " 팀에 초대됐어요.", "body", "확인하기")),
              key));
  }

  @Transactional
  public Accepted accept(AuthenticatedUser user, String code) {
    if (user.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자 계정만 팀에 참여할 수 있어요");
    // Personal cap is serialized across invitations to different teams, as in page 08 team
    // creation.
    users
        .lockActiveDeveloper(user.userId())
        .orElseThrow(() -> new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요"));
    String hash = hash(code);
    long teamId = links.findTeamIdByHash(hash).orElseThrow(TeamInvitationService::missing);
    var team = teams.lockTeamForSetup(teamId).orElseThrow(TeamInvitationService::missing);
    var link = links.lockByHash(hash).orElseThrow(TeamInvitationService::missing);
    requireValid(link);
    requireWritable(team);
    requireCapacity(team, user.userId());
    var room =
        rooms
            .lockTeamRoom(teamId)
            .orElseThrow(() -> new ApiException(409, "STATE_CONFLICT", "팀 채팅방을 확인해 주세요"));
    members.saveAndFlush(TeamMember.member(teamId, user.userId(), clock.instant()));
    var participant = participants.findAnyInRoom(room.getId(), user.userId()).orElse(null);
    if (participant == null) participants.saveAndFlush(ChatRoomMember.join(room, user.userId()));
    else participant.rejoin();
    return new Accepted(teamId, team.getGithubOrgLogin(), true);
  }

  private void requireAdmin(AuthenticatedUser user, com.linker.backend.entity.team.Team team) {
    requireAdmin(user, team, true);
  }

  private void requireAdmin(
      AuthenticatedUser user, com.linker.backend.entity.team.Team team, boolean write) {
    boolean readable =
        users
            .findById(user.userId())
            .filter(account ->
                account.getDeletedAt() == null
                    && (account.getStatus() == UserStatus.ACTIVE
                        || account.getStatus() == UserStatus.SUSPENDED))
            .isPresent();
    if (user.userType() != UserType.DEVELOPER
        || !readable
        || (write && !teams.isActiveUser(user.userId())))
      throw new ApiException(403, "FORBIDDEN", "이 기능을 사용할 수 없어요");
    var role =
        members
            .findByTeamIdAndUserIdAndLeftAtIsNull(team.getId(), user.userId())
            .map(TeamMember::getRole)
            .orElseThrow(() -> new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요"));
    if (role == TeamRole.MEMBER) throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
    if (write) requireWritable(team);
    else if (team.getStatus() == TeamStatus.ARCHIVED || team.getStatus() == TeamStatus.DELETED)
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
  }

  private void requireCapacity(com.linker.backend.entity.team.Team team, long userId) {
    if (teams.currentMember(userId, team.getId()))
      throw new ApiException(409, "ALREADY_MEMBER", "이미 함께하는 팀이에요");
    if (!subscriptions.hasFlexBenefit(team.getId(), clock.instant())
        && members.countByTeamIdAndLeftAtIsNull(team.getId()) >= PlanLimits.TEAM_MEMBERS_FREE)
      throw new ApiException(409, "TEAM_MEMBER_LIMIT", "팀 인원이 가득 찼어요");
    if (teams.countedTeams(userId) >= PlanLimits.TEAMS_PER_USER_MAX)
      throw new ApiException(
          409, "TEAM_COUNT_LIMIT", "팀은 " + PlanLimits.TEAMS_PER_USER_MAX + "개까지 참여할 수 있어요");
  }

  private void requireWritable(com.linker.backend.entity.team.Team team) {
    if (team.getStatus() != TeamStatus.ACTIVE && team.getStatus() != TeamStatus.COMPLETED)
      throw new ApiException(409, "STATE_CONFLICT", "읽기 전용 팀에는 참여할 수 없어요");
  }

  private void requireValid(TeamInviteLink link) {
    if (link.getRevokedAt() != null || !link.getExpiresAt().isAfter(clock.instant()))
      throw new ApiException(410, "INVITE_INVALID", "더 이상 쓸 수 없는 초대 링크예요");
  }

  private static ApiException missing() {
    return new ApiException(404, "NOT_FOUND", "초대 정보를 찾을 수 없어요");
  }

  private static String hash(String code) {
    if (code == null || code.length() > 128) throw missing();
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
