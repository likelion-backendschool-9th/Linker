package com.linker.backend.service.user;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.dto.notification.request.NotificationText;
import com.linker.backend.dto.team.request.*;
import com.linker.backend.dto.team.response.TeamSettingsResponse;
import com.linker.backend.dto.team.response.TeamSettingsResponse.*;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.team.Team;
import com.linker.backend.entity.team.TeamMember;
import com.linker.backend.entity.team.TeamRepo;
import com.linker.backend.entity.team.type.TeamLeaveType;
import com.linker.backend.entity.team.type.TeamRole;
import com.linker.backend.entity.team.type.TeamStatus;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubTeamSource;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.team.*;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Page 09 team management; provider calls remain outside write transactions. */
@Service("userTeamManagementService")
public class TeamManagementService {
  private final TeamRepository teams;
  private final TeamOwnershipTransferRepository transfers;
  private final TeamCompletionRepository completions;
  private final CompletionRecordRepository records;
  private final tools.jackson.databind.ObjectMapper json;
  private final TeamMemberRepository members;
  private final TeamRepoRepository repos;
  private final UserRepository users;
  private final com.linker.backend.repository.account.AuthIdentityRepository identities;
  private final SubscriptionRepository subscriptions;
  private final NotificationService notifications;
  private final GithubTeamSource github;
  private final TeamSyncService sync;
  private final Clock clock;
  private final TransactionTemplate write;

  public TeamManagementService(
      TeamRepository teams,
      TeamMemberRepository members,
      TeamRepoRepository repos,
      UserRepository users,
      SubscriptionRepository subscriptions,
      NotificationService notifications,
      GithubTeamSource github,
      TeamSyncService sync,
      Clock clock,
      PlatformTransactionManager transactions,
      com.linker.backend.repository.account.AuthIdentityRepository identities,
      TeamOwnershipTransferRepository transfers, TeamCompletionRepository completions,
      CompletionRecordRepository records, tools.jackson.databind.ObjectMapper json) {
    this.transfers=transfers;this.completions=completions;this.records=records;this.json=json;
    this.teams = teams;
    this.members = members;
    this.repos = repos;
    this.users = users;
    this.identities = identities;
    this.subscriptions = subscriptions;
    this.notifications = notifications;
    this.github = github;
    this.sync = sync;
    this.clock = clock;
    this.write = new TransactionTemplate(transactions);
  }

  @Transactional(readOnly = true)
  public TeamSettingsResponse settings(AuthenticatedUser principal, long teamId) {
    Team team = readable(principal, teamId);
    TeamRole role = member(teamId, principal.userId()).getRole();
    boolean writable = writable(team) && principal.status() == UserStatus.ACTIVE;
    boolean admin = role != TeamRole.MEMBER && writable;
    boolean owner = ownerAuthority(role,teamId) && writable;
    var linked = teams.findLinkedRepos(teamId).stream()
        .map(r -> new Repo(r.repoId(), r.githubRepoId(), r.name(), r.ownerLogin() + "/" + r.name()))
        .toList();
    Board board = teams.findSettingsBoard(teamId)
        .map(b -> new Board(b.getId(), b.getTitle(), "https://github.com/orgs/"
            + team.getGithubOrgLogin() + "/projects/" + b.getProjectNumber())).orElse(null);
    boolean flex = subscriptions.hasFlexBenefit(teamId, clock.instant());
    var paid = subscriptions.findByTeamIdInAndStatusIn(List.of(teamId), SubscriptionStatus.LIVE)
        .stream().findFirst().orElse(null);
    Long payer = paid == null ? null : paid.getPayerUserId();
    String payerName = payer == null ? null : users.findById(payer).map(User::visibleName).orElse(null);
    // D currently implements one-time checkout, not automatic renewal. Do not promise a next charge.
    var billing = new Billing(payer, payerName,
        writable && (role == TeamRole.OWNER || Objects.equals(payer, principal.userId())), null, null);
    var pending = transfers.findByTeamIdAndStatus(teamId, "PENDING").orElse(null);
    var completed = completions.findByTeamIdAndRevertedAtIsNull(teamId).orElse(null);
    return new TeamSettingsResponse(
        teamId,
        team.getName(),
        team.getDescription(),
        team.getGithubOrgLogin(),
        team.getAvatarUrl(),
        team.getStatus().name(),
        flex ? "FLEX" : "FREE",
        role.name(),
        new Permissions(
            admin,
            admin,
            admin,
            admin,
            owner,
            role == TeamRole.OWNER && writable,
            admin,
            owner,
            owner,
            role != TeamRole.OWNER && writable),
        linked,
        board,
        team.isAiSummaryEnabled(),
        flex ? null : (long) PlanLimits.TEAM_MEMBERS_FREE,
        billing,
        false,
        "팀 오너이면서 GitHub 조직 오너만 조직에 초대할 수 있어요",
        pending == null ? null : new OwnershipTransfer(pending.getId(),
            users.findById(pending.getFromUserId()).map(User::visibleName).orElse("탈퇴한 사용자"),
            users.findById(pending.getToUserId()).map(User::visibleName).orElse("탈퇴한 사용자"),
            pending.getToUserId() == principal.userId()),
        completed == null ? null : completed.getCompletedAt(),
        completed == null ? null : new Completion(admin && completed.getConfirmedAt() == null
            && clock.instant().isBefore(completed.getRevertibleUntil()), completed.getConfirmedAt() != null, false));
  }

  @Transactional(readOnly = true)
  public Members members(AuthenticatedUser principal, long teamId) {
    readable(principal, teamId);
    var current = members.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId);
    Map<Long, User> accounts = users.findAllById(current.stream().map(TeamMember::getUserId).toList())
        .stream().collect(Collectors.toMap(User::getId, Function.identity()));
    var githubLogins =
        identities.findGithubLogins(accounts.keySet()).stream()
            .filter(row -> row.getLogin() != null)
            .collect(
                Collectors.toMap(
                    com.linker.backend.repository.account.AuthIdentityRepository.GithubLogin
                        ::getUserId,
                    com.linker.backend.repository.account.AuthIdentityRepository.GithubLogin
                        ::getLogin));
    var items =
        current.stream()
            .map(m -> {
              User account = accounts.get(m.getUserId());
              boolean visible = account != null && account.getDeletedAt() == null;
              return new Member(
                  m.getUserId(),
                  visible ? account.getUsername() : null,
                  visible ? account.visibleName() : "탈퇴한 사용자",
                  visible ? account.getAvatarUrl() : null,
                  m.getRole().name(),
                  m.getGithubOrgState().name(),
                  m.getJoinedAt(),
                  visible ? githubLogins.get(m.getUserId()) : null);
            })
            .toList();
    return new Members(items, items.size(), subscriptions.hasFlexBenefit(teamId, clock.instant())
        ? null : (long) PlanLimits.TEAM_MEMBERS_FREE);
  }

  @Transactional
  public void update(AuthenticatedUser principal, long teamId, UpdateTeamRequest request) {
    Team team = locked(principal, teamId, false);
    if (request.name() == null || request.name().isBlank() || request.name().trim().length() > 255)
      throw new ApiException(400, "VALIDATION_ERROR", "팀 이름을 확인해 주세요");
    if (request.aiSummaryEnabled() != null) {
      // AI switch belongs to the actual owner, not a temporarily delegated administrator.
      if (member(teamId,principal.userId()).getRole()!=TeamRole.OWNER)
        throw new ApiException(403,"TEAM_ROLE_REQUIRED","팀 오너만 변경할 수 있어요");
      team.changeAiSummary(request.aiSummaryEnabled());
    }
    team.changeInfo(request.name().trim(), request.description());
  }

  @Transactional
  public void changeRole(AuthenticatedUser principal, long teamId, long targetId,
      ChangeTeamRoleRequest request) {
    locked(principal, teamId, true);
    TeamMember target = member(teamId, targetId);
    if (request.role() == null || request.role() == TeamRole.OWNER || target.getRole() == TeamRole.OWNER)
      throw new ApiException(409, "STATE_CONFLICT", "오너는 소유권 이전으로 변경해 주세요");
    teams.requireActive(targetId);
    target.changeRole(request.role());
  }

  @Transactional
  public void remove(AuthenticatedUser principal, long teamId, long targetId) {
    Team team = locked(principal, teamId, false);
    TeamMember actor = member(teamId, principal.userId());
    TeamMember target = member(teamId, targetId);
    if (targetId == principal.userId() || target.getRole() == TeamRole.OWNER
        || (actor.getRole() == TeamRole.ADMIN && !ownerAuthority(actor.getRole(), teamId)
            && target.getRole() != TeamRole.MEMBER))
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀원을 내보낼 권한이 없어요");
    close(teamId, target, TeamLeaveType.KICKED);
    Set<Long> recipients = new HashSet<>(teams.currentOwnerIds(teamId, false));
    recipients.add(targetId);
    String targetName = users.findById(targetId).map(User::visibleName).orElse("팀원");
    for (long recipient : recipients) {
      if (teams.canReceiveNotification(recipient))
        notifications.create(new CreateNotificationCommand(recipient, "TEAM_MEMBER_REMOVED",
            principal.userId(), "TEAM", teamId, "/workspace",
            recipient == targetId ? notificationText("팀에서 내보내졌어요", team.getName()
                + " 팀에서 내보내졌어요. 7일 동안 이 팀에 다시 지원할 수 없어요.")
                : NotificationText.json(targetName + "님이 " + team.getName() + " 팀에서 내보내졌어요.", null),
            null));
    }
  }

  @Transactional
  public void leave(AuthenticatedUser principal, long teamId) {
    active(principal);
    Team team = teams.lockTeamForSetup(teamId).orElseThrow(TeamManagementService::notFound);
    TeamMember member = member(teamId, principal.userId());
    requireWritable(team);
    if (member.getRole() == TeamRole.OWNER)
      throw new ApiException(409, "STATE_CONFLICT", "소유권을 이전한 뒤 팀을 나갈 수 있어요");
    close(teamId, member, TeamLeaveType.LEFT);
  }

  @Transactional
  public void archive(AuthenticatedUser principal, long teamId) {
    locked(principal, teamId, true).archive(clock.instant());
    // Keep team/chat memberships and transcripts: archived teams allow history reads.
  }

  @Transactional
  public void delete(AuthenticatedUser principal, long teamId, DeleteTeamRequest request) {
    Team team = locked(principal, teamId, true);
    if (!team.getName().equals(request.confirmName()))
      throw new ApiException(400, "VALIDATION_ERROR", "팀 이름을 정확히 입력해 주세요");
    var now = clock.instant();
    var current = members.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId);
    team.scheduleDeletion(now.plus(PlanLimits.TEAM_DELETED_CHAT_RETENTION_DAYS, ChronoUnit.DAYS));
    current.forEach(m -> m.leave(now, TeamLeaveType.TEAM_DELETED));
    members.saveAllAndFlush(current);
    for (var m : current) {
      teams.closeChatMembership(teamId, m.getUserId(), now);
      if (teams.canReceiveNotification(m.getUserId()))
        notifications.create(new CreateNotificationCommand(m.getUserId(), "TEAM_DELETED",
            principal.userId(), "TEAM", teamId, "/workspace",
            notificationText("팀이 삭제됐어요", team.getName()+" 팀이 삭제됐어요."), null));
    }
  }

  @Transactional(propagation = Propagation.NEVER)
  public void purgeDeletedChats() {
    var now = clock.instant();
    while (true) {
      // Technical batch size. Each team has its own short transaction; no team-count limit.
      var batch = teams.findChatDeletionCandidates(now, org.springframework.data.domain.PageRequest.of(0, 100));
      if (batch.isEmpty()) return;
      for (long id : batch) {
        write.executeWithoutResult(status -> {
          Team team = teams.lockTeamForSetup(id).orElse(null);
          if (team != null && team.getStatus() == TeamStatus.DELETED
              && team.getDeleteScheduledAt() != null && !team.getDeleteScheduledAt().isAfter(now))
            teams.purgeDeletedTeamChat(id);
        });
      }
    }
  }

  @Transactional(propagation = Propagation.NEVER)
  public void addRepo(AuthenticatedUser principal, long teamId, AddTeamRepoRequest request) {
    active(principal);
    teams.withTeamSetupLock(teamId, () -> {
      var expected = teams.team(teamId);
      requireAdmin(principal, teamId, false);
      var allowed = github.repositories(principal.userId(), expected.installationId(), expected.orgId());
      var selected = allowed.stream().filter(r -> r.id() == request.repoId()).findFirst()
          .orElseThrow(() -> new ApiException(403, "FORBIDDEN", "App 접근이 허용된 저장소만 연결할 수 있어요"));
      write.executeWithoutResult(status -> {
        locked(principal, teamId, false);
        teams.assertUnchanged(expected);
        long repoId = teams.cacheRepo(selected, clock.instant());
        if (repos.findByTeamIdAndRepoId(teamId, repoId).isEmpty())
          repos.saveAndFlush(TeamRepo.connect(teamId, repoId, principal.userId()));
      });
      sync.invalidate(teamId);
      return null;
    });
  }

  @Transactional(propagation = Propagation.NEVER)
  public void removeRepo(AuthenticatedUser principal, long teamId, long repoId) {
    teams.withTeamSetupLock(teamId, () -> {
      write.executeWithoutResult(status -> {
        locked(principal, teamId, false);
        // Only disconnect the join row. Keep the GitHub repo and C's issue history.
        repos.findByTeamIdAndRepoId(teamId, repoId).ifPresent(repos::delete);
      });
      sync.invalidate(teamId);
      return null;
    });
  }

  @Transactional
  public TransferCreated requestOwnership(AuthenticatedUser principal,long teamId,TransferTeamOwnershipRequest request) {
    locked(principal,teamId,true);
    if (member(teamId,principal.userId()).getRole()!=TeamRole.OWNER)
      throw new ApiException(403,"TEAM_ROLE_REQUIRED","팀 오너만 이전을 요청할 수 있어요");
    if (request.toUserId()==principal.userId()) throw new ApiException(409,"STATE_CONFLICT","다른 멤버를 선택해 주세요");
    member(teamId,request.toUserId()); teams.requireActive(request.toUserId());
    transfers.findByTeamIdAndStatus(teamId,"PENDING").ifPresent(t -> t.respond("CANCELED",clock.instant()));
    transfers.flush();
    var transfer=transfers.saveAndFlush(com.linker.backend.entity.team.TeamOwnershipTransfer.request(teamId,principal.userId(),request.toUserId()));
    return new TransferCreated(transfer.getId());
  }

  @Transactional
  public void acceptOwnership(AuthenticatedUser principal,long teamId,long transferId) {
    active(principal);
    Team team=teams.lockTeamForSetup(teamId).orElseThrow(TeamManagementService::notFound);
    requireWritable(team);
    var transfer=transfers.findById(transferId).filter(t -> t.getTeamId()==teamId && t.getToUserId()==principal.userId())
        .orElseThrow(() -> new ApiException(403,"TEAM_ROLE_REQUIRED","이전 요청의 수신자만 수락할 수 있어요"));
    if (!"PENDING".equals(transfer.getStatus())) throw new ApiException(409,"STATE_CONFLICT","이미 처리된 요청이에요");
    var from=member(teamId,transfer.getFromUserId());var to=member(teamId,principal.userId());
    if (from.getRole()!=TeamRole.OWNER) throw new ApiException(409,"STATE_CONFLICT","팀 오너가 변경됐어요");
    from.changeRole(TeamRole.ADMIN);members.saveAndFlush(from);
    to.changeRole(TeamRole.OWNER);members.saveAndFlush(to);
    transfer.respond("ACCEPTED",clock.instant());
    // Subscription payer is deliberately unchanged.
  }

  @Transactional
  public void complete(AuthenticatedUser principal,long teamId) {
    Team team=locked(principal,teamId,false);
    if (team.getStatus()!=TeamStatus.ACTIVE) throw new ApiException(409,"STATE_CONFLICT","활동 중인 팀만 완료할 수 있어요");
    var now=clock.instant();
    completions.saveAndFlush(com.linker.backend.entity.team.TeamCompletion.complete(teamId,principal.userId(),now,
        now.plus(PlanLimits.TEAM_COMPLETION_UNDO_DAYS,ChronoUnit.DAYS)));
    team.complete();
    for (var member:members.findByTeamIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc(teamId)) {
      if (teams.canReceiveNotification(member.getUserId()))
        // No link: org repos can't be posted from 22, so the notice only congratulates (members fork to post)
        notifications.create(new CreateNotificationCommand(member.getUserId(),"TEAM_COMPLETED",principal.userId(),
            "TEAM",teamId,null,notificationText("프로젝트를 완주 하셨습니다! 수고 하셨습니다",team.getName()),null));
    }
  }

  @Transactional
  public void undoCompletion(AuthenticatedUser principal,long teamId) {
    Team team=locked(principal,teamId,false);
    var completion=completions.findByTeamIdAndRevertedAtIsNull(teamId).orElseThrow(TeamManagementService::notFound);
    if (team.getStatus()!=TeamStatus.COMPLETED || completion.getConfirmedAt()!=null
        || !clock.instant().isBefore(completion.getRevertibleUntil()))
      throw new ApiException(409,"STATE_CONFLICT","완료 취소 기간이 지났어요");
    completion.revert(clock.instant());team.resume();
  }

  @Transactional(propagation=Propagation.NEVER)
  public void finalizeCompletions() {
    while (true) {
      var due=completions.findDue(clock.instant(),org.springframework.data.domain.PageRequest.of(0,100));
      if(due.isEmpty()) return;
      for(long id:due) write.executeWithoutResult(tx -> {
        long teamId=completions.teamId(id);
        teams.lockTeamForSetup(teamId).orElseThrow();
        // Refresh after the team lock: a concurrent undo may have committed while we waited.
        var completion=completions.findByTeamIdAndRevertedAtIsNull(teamId).orElse(null);
        if(completion==null || completion.getId()!=id || completion.getConfirmedAt()!=null
            || clock.instant().isBefore(completion.getRevertibleUntil())) return;
        var at=completion.getCompletedAt();
        Map<Long,TeamMember> latest=new HashMap<>();
        for(var membership:members.findByTeamIdOrderByJoinedAtAscIdAsc(completion.getTeamId()))
          if(!membership.getJoinedAt().isAfter(at)) latest.put(membership.getUserId(),membership);
        for(var membership:latest.values()) {
          boolean present=membership.getLeftAt()==null || membership.getLeftAt().isAfter(at);
          if(present && membership.getJoinedAt().plus(PlanLimits.TEAM_COMPLETION_MEMBERSHIP_DAYS,ChronoUnit.DAYS).isAfter(at)) continue;
          records.save(com.linker.backend.entity.team.CompletionRecord.record(id,membership.getUserId(),present?"COMPLETED":"DROPPED",
              records.countAssigned(completion.getTeamId(),membership.getUserId()),records.countDone(completion.getTeamId(),membership.getUserId())));
        }
        completion.confirm(clock.instant());
      });
    }
  }

  /** Runs in the account final-deletion transaction; the recovery window retains memberships. */
  @Transactional(propagation=Propagation.MANDATORY)
  public void closeDeletedAccountMemberships(User user,java.time.Instant now) {
    if(user.getStatus()!=UserStatus.DELETED || user.getDeletedAt()==null)
      throw new IllegalStateException("Account final deletion is required");
    for(var current:members.findByUserIdAndLeftAtIsNullOrderByTeamIdAsc(user.getId())) {
      teams.lockTeamForSetup(current.getTeamId()).orElseThrow();
      // Re-read after the team lock; another team action may have closed the membership.
      members.findByTeamIdAndUserIdAndLeftAtIsNull(current.getTeamId(),user.getId()).ifPresent(m -> {
        m.leave(now,TeamLeaveType.LEFT);members.saveAndFlush(m);
        teams.closeChatMembership(current.getTeamId(),user.getId(),now);
      });
    }
  }

  private String notificationText(String title,String body) {
    return json.writeValueAsString(Map.of("title",title,"body",body));
  }

  private void close(long teamId, TeamMember member, TeamLeaveType reason) {
    member.leave(clock.instant(), reason);
    members.saveAndFlush(member);
    teams.closeChatMembership(teamId, member.getUserId(), clock.instant());
  }

  private Team readable(AuthenticatedUser principal, long teamId) {
    if (principal.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    users.findById(principal.userId()).filter(u -> u.getDeletedAt()==null
        && (u.getStatus()==UserStatus.ACTIVE || u.getStatus()==UserStatus.SUSPENDED))
        .orElseThrow(() -> new ApiException(403,"FORBIDDEN","팀 권한이 필요해요"));
    Team team = teams.findById(teamId).orElseThrow(TeamManagementService::notFound);
    member(teamId, principal.userId());
    if (team.getStatus() == TeamStatus.ARCHIVED || team.getStatus() == TeamStatus.DELETED)
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
    return team;
  }

  private Team locked(AuthenticatedUser principal, long teamId, boolean owner) {
    active(principal);
    Team team = teams.lockTeamForSetup(teamId).orElseThrow(TeamManagementService::notFound);
    requireAdmin(principal, teamId, owner);
    return team;
  }

  private void requireAdmin(AuthenticatedUser principal, long teamId, boolean owner) {
    Team team = readable(principal, teamId);
    TeamRole role = member(teamId, principal.userId()).getRole();
    if (role == TeamRole.MEMBER || (owner && !ownerAuthority(role,teamId)))
      throw new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요");
    requireWritable(team);
  }

  private TeamMember member(long teamId, long userId) {
    return members.findByTeamIdAndUserIdAndLeftAtIsNull(teamId, userId)
        .orElseThrow(() -> new ApiException(403, "TEAM_ROLE_REQUIRED", "팀 권한이 필요해요"));
  }

  private boolean ownerAuthority(TeamRole role,long teamId) {
    return role==TeamRole.OWNER || (role==TeamRole.ADMIN
        && members.hasTemporarilySuspendedOwner(teamId,clock.instant()));
  }

  private void active(AuthenticatedUser principal) {
    if (principal.userType() != UserType.DEVELOPER)
      throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
    teams.requireActive(principal.userId());
  }

  private static boolean writable(Team team) {
    return team.getStatus() == TeamStatus.ACTIVE || team.getStatus() == TeamStatus.COMPLETED;
  }

  private static void requireWritable(Team team) {
    if (!writable(team)) throw new ApiException(409, "STATE_CONFLICT", "읽기 전용 팀은 변경할 수 없어요");
  }

  private static ApiException notFound() {
    return new ApiException(404, "NOT_FOUND", "팀을 찾을 수 없어요");
  }
}
