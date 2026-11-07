package com.linker.backend.service.admin;

import com.linker.backend.dto.moderation.request.*;
import com.linker.backend.dto.moderation.response.AdminUsersResponse;
import com.linker.backend.dto.moderation.response.AdminUsersResponse.*;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.entity.moderation.*;
import com.linker.backend.entity.moderation.type.*;
import com.linker.backend.entity.profile.type.AdStatus;
import com.linker.backend.entity.subscription.type.PaymentStatus;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.*;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.moderation.*;
import com.linker.backend.repository.profile.RecruiterAdRepository;
import com.linker.backend.repository.subscription.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** B's account administration use cases; entered through the paired admin ModerationService. */
@Service("adminUserAdministrationService")
public class UserAdministrationService {
  private final UserRepository users;
  private final AdminRepository admins;
  private final SanctionRepository sanctions;
  private final BannedGithubIdRepository bans;
  private final AuthIdentityRepository identities;
  private final AdminActionRepository actions;
  private final UserSessionRepository sessions;
  private final ReportCaseRepository reports;
  private final SubscriptionRepository subscriptions;
  private final PaymentRepository payments;
  private final RecruiterProfileRepository profiles;
  private final RecruiterAdRepository ads;
  private final ChatRoomRepository rooms;
  private final NotificationService notifications;
  private final Clock clock;
  private final ObjectMapper json;

  public UserAdministrationService(UserRepository users, AdminRepository admins, SanctionRepository sanctions,
      BannedGithubIdRepository bans, AuthIdentityRepository identities, AdminActionRepository actions,
      UserSessionRepository sessions, ReportCaseRepository reports, SubscriptionRepository subscriptions,
      PaymentRepository payments, RecruiterProfileRepository profiles, RecruiterAdRepository ads,
      ChatRoomRepository rooms, NotificationService notifications, Clock clock, ObjectMapper json) {
    this.users=users; this.admins=admins; this.sanctions=sanctions; this.bans=bans;
    this.identities=identities; this.actions=actions; this.sessions=sessions; this.reports=reports;
    this.subscriptions=subscriptions; this.payments=payments; this.profiles=profiles; this.ads=ads;
    this.rooms=rooms; this.notifications=notifications; this.clock=clock; this.json=json;
  }

  @Transactional(readOnly=true)
  public AdminUsersResponse list(AuthenticatedUser actor, String q, String status, String type,
      Boolean needsReview, Long cursor, int size) {
    requireAdmin(actor);
    if (Boolean.TRUE.equals(needsReview))
      throw new ApiException(503, "SERVICE_UNAVAILABLE", "확인 필요 판정과 해제 기준은 팀 합의 후 제공해요");
    if (size<1 || size>100 || (cursor!=null && cursor<=0) || (q!=null && q.length()>100)) throw invalid();
    String search = q==null ? "" : q.strip().replaceFirst("^@", "").toLowerCase(Locale.ROOT);
    String pattern="%"+search.replace("!","!!").replace("%","!%").replace("_","!_")+"%";
    var rows=users.findAdministrationPage(pattern, parse(UserStatus.class,status), parse(UserType.class,type),
        cursor, PageRequest.of(0,size+1));
    boolean more=rows.size()>size;
    var page=rows.stream().limit(size).map(this::item).toList();
    return new AdminUsersResponse(page, more ? Long.toString(page.getLast().id()) : null, false);
  }

  @Transactional(readOnly=true)
  public Detail detail(AuthenticatedUser actor, long id) {
    Admin admin=requireAdmin(actor);
    User user=users.findById(id).orElseThrow(UserAdministrationService::missing);
    Instant now=clock.instant();
    var reportHistory=reports.findByTargetUserIdOrderByIdDesc(id,PageRequest.of(0,100)).stream()
        .map(r -> new ReportView(r.getId(),r.getTargetType().name(),r.getStatus().name(),r.getCreatedAt())).toList();
    var subscriptionHistory=subscriptions.findAdministrationHistory(id,PageRequest.of(0,100)).stream()
        .map(s -> new SubscriptionView(s.getId(),s.getPlan().name(),s.getStatus().name(),s.getTeamId(),s.getCurrentPeriodEnd())).toList();
    var paymentHistory=payments.findHistory(id,EnumSet.allOf(PaymentStatus.class),null,PageRequest.of(0,100)).stream()
        .map(p -> new PaymentView(p.getId(),p.getAmount(),p.getStatus().name(),p.getApprovedAt(),p.getRefundedAmount())).toList();
    Instant since=now.minus(PlanLimits.RECRUITING_OFFER_REPLY_DAYS,ChronoUnit.DAYS);
    RecruiterView recruiter=user.getUserType()!=UserType.RECRUITER ? null : profiles.findByUser_Id(id)
        .map(p -> new RecruiterView(p.getCompanyName(),p.getCompanyEmailDomain(),p.getJobTitle(),
            rooms.countRecruitingOffersSince(id,since),rooms.countAcceptedRecruitingOffersSince(id,since))).orElse(null);
    return new Detail(id,user.getUsername(),user.visibleName(),user.getAvatarUrl(),user.getUserType().name(),
        mask(user.getEmail()),user.getStatus().name(),user.getCreatedAt(),
        new Actions(admin.getAdminRole()==AdminRole.LEAD && actor.userId()!=id,admin.getAdminRole()==AdminRole.LEAD,actions.supportsRefundAudit()),
        sanctions.findByUser_IdOrderByIdDesc(id).stream().map(s -> view(s,now)).toList(),
        reportHistory,subscriptionHistory,paymentHistory,recruiter);
  }

  @Transactional
  public SanctionView sanction(AuthenticatedUser actor, long id, AccountSanctionRequest request) {
    Admin admin=requireAdmin(actor);
    if (request==null) throw invalid();
    String reason=reason(request.reason());
    String step=request.step();
    if (!List.of("WARNING","DAYS_7","DAYS_30","PERMANENT").contains(step==null?"":step)) throw invalid();
    if ("PERMANENT".equals(step)) lead(admin);
    if (actor.userId()==id) throw new ApiException(403,"FORBIDDEN","본인 계정은 제재할 수 없어요");
    if (admins.findByUser_Id(id).isPresent()) lead(admin);
    User target=users.lockById(id).orElseThrow(UserAdministrationService::missing);
    Instant now=clock.instant();
    String code=request.reasonCode()==null ? "OTHER" : request.reasonCode();
    ReportReason reasonCode=parse(ReportReason.class,code);
    if (reasonCode==null) throw invalid();
    var history=sanctions.findByUser_IdOrderByIdDesc(id);
    if (history.stream().anyMatch(s -> s.getSanctionType()==SanctionType.PERMANENT_BAN && active(s,now)))
      throw new ApiException(409,"STATE_CONFLICT","이미 영구 정지된 계정이에요");
    Instant reset=now.atZone(PlanLimits.APP_ZONE).minusYears(PlanLimits.SANCTION_RESET_YEARS).toInstant();
    var latest=history.stream().filter(s -> accountType(s) && s.getStartsAt().isAfter(reset)
        && (s.getReasonDetail()!=null || s.getRevokedAt()==null))
        .max(Comparator.comparing(Sanction::getStartsAt).thenComparing(Sanction::getId)).orElse(null);
    String expected=latest==null ? "WARNING" : switch (step(latest)) {
      case "WARNING" -> "DAYS_7"; case "DAYS_7" -> "DAYS_30"; default -> "PERMANENT";
    };
    boolean severe=Set.of(ReportReason.ILLEGAL,ReportReason.SEXUAL,ReportReason.SPAM,ReportReason.IMPERSONATION).contains(reasonCode);
    if (!step.equals(expected) && !(step.equals("PERMANENT") && severe))
      throw new ApiException(409,"STATE_CONFLICT","제재 단계가 맞지 않아요. 회원 이력을 다시 확인해 주세요");
    Instant end=switch(step) {
      case "DAYS_7" -> now.plus(PlanLimits.SANCTION_FIRST_DAYS,ChronoUnit.DAYS);
      case "DAYS_30" -> now.plus(PlanLimits.SANCTION_SECOND_DAYS,ChronoUnit.DAYS);
      default -> null;
    };
    String githubId=null;
    if (step.equals("PERMANENT") && target.getUserType()==UserType.DEVELOPER)
      githubId=identities.findGithubUserId(id).orElseThrow(() -> new ApiException(409,"STATE_CONFLICT","GitHub 계정 식별자를 확인해야 해요"));
    Sanction row=sanctions.saveAndFlush(Sanction.account(target,step.equals("WARNING") ? SanctionType.WARNING :
        step.equals("PERMANENT") ? SanctionType.PERMANENT_BAN : SanctionType.SUSPENSION,admin,now,end,code,reason));
    if (githubId!=null && !bans.existsByGithubUserId(githubId)) bans.saveAndFlush(BannedGithubId.ban(githubId,row.getId()));
    if (!step.equals("WARNING")) {
      reconcile(target,now);
      sessions.clearOperatorAccess(id);
      if (target.getUserType()==UserType.RECRUITER) ads.findByRecruiter_Id(id).filter(a -> !a.locked())
          .ifPresent(a -> ads.updateReportedState(a.getId(),AdStatus.HIDDEN,now,null));
    }
    actions.save(AdminAction.record(admin,AdminActionType.SANCTION,"USER",id,null,reason,json.writeValueAsString(Map.of("sanctionId",row.getId(),"step",step))));
    notify(target,row,"계정 제재가 적용됐어요",reason);
    return view(row,now);
  }

  @Transactional
  public void lift(AuthenticatedUser actor, long id, long sanctionId) {
    Admin admin=requireAdmin(actor); lead(admin);
    User target=users.lockById(id).orElseThrow(UserAdministrationService::missing);
    Sanction row=sanctions.findById(sanctionId).filter(s -> s.getUser().getId()==id)
        .orElseThrow(UserAdministrationService::missing);
    if (row.getRevokedAt()!=null) return;
    if (!accountType(row)) throw new ApiException(409,"STATE_CONFLICT","회원 제재만 이 화면에서 해제할 수 있어요");
    Instant now=clock.instant(); row.lift(now,admin.getId());
    removeLinkedBan(row);
    reconcile(target,now);
    actions.save(AdminAction.record(admin,AdminActionType.REVOKE,"USER",id,null,"회원 제재 해제 #"+sanctionId,json.writeValueAsString(Map.of("sanctionId",sanctionId))));
    notify(target,row,"계정 제재가 해제됐어요","운영자 해제");
  }

  /** Accepted appeals erase violation details in A's flow; also release B's linked account ban. */
  @Transactional
  public void afterAppealRevoked(Sanction row) {
    if (!accountType(row)) return;
    User target=users.lockById(row.getUser().getId()).orElseThrow(UserAdministrationService::missing);
    removeLinkedBan(row); reconcile(target,clock.instant());
  }

  @Transactional
  public RevealedEmail reveal(AuthenticatedUser actor, long id, EmailRevealRequest request) {
    Admin admin=requireAdmin(actor);
    String reason=reason(request==null?null:request.reason());
    User target=users.findById(id).orElseThrow(UserAdministrationService::missing);
    actions.saveAndFlush(AdminAction.record(admin,AdminActionType.VIEW_EMAIL,"USER",id,null,reason));
    return new RevealedEmail(target.getEmail());
  }

  @Transactional
  public void expire(long id) {
    users.lockById(id).ifPresent(user -> reconcile(user,clock.instant()));
  }

  private void removeLinkedBan(Sanction row) {
    if (row.getSanctionType()!=SanctionType.PERMANENT_BAN) return;
    boolean another=sanctions.findByUser_IdOrderByIdDesc(row.getUser().getId()).stream()
        .anyMatch(s -> !s.getId().equals(row.getId()) && s.getSanctionType()==SanctionType.PERMANENT_BAN && active(s,clock.instant()));
    if (!another) bans.deleteLinkedBan(row.getId());
  }

  private void reconcile(User user, Instant now) {
    var state=users.accountSanctionState(user,now);
    user.reconcileSanctions(state.restricted(),state.until(),state.revokedCurrent(),now);
  }

  private Admin requireAdmin(AuthenticatedUser actor) {
    if (actor==null || !actor.operatorAuthorized()) throw new ApiException(403,"FORBIDDEN","운영자 인증이 필요해요");
    return admins.findByUser_Id(actor.userId()).filter(a -> a.getUser().getStatus()==UserStatus.ACTIVE
        && a.getUser().getDeletedAt()==null).orElseThrow(() -> new ApiException(403,"FORBIDDEN","운영자만 쓸 수 있어요"));
  }
  private static void lead(Admin admin) {
    if (admin.getAdminRole()!=AdminRole.LEAD) throw new ApiException(403,"LEAD_REQUIRED","리드 운영자만 할 수 있어요");
  }
  private void notify(User target,Sanction row,String message,String reason) {
    if (target.getStatus()==UserStatus.DELETED || target.getDeletedAt()!=null) return;
    Map<String,Object> payload=new LinkedHashMap<>();
    payload.put("message",message); payload.put("reason",reason); payload.put("sanctionId",row.getId());
    payload.put("startsAt",row.getStartsAt().toString()); payload.put("endsAt",row.getEndsAt()==null?null:row.getEndsAt().toString());
    notifications.create(new CreateNotificationCommand(target.getId(),"SANCTION",null,"SANCTION",row.getId(),
        "/notifications",json.writeValueAsString(payload),null));
  }
  private Item item(User u) {
    return new Item(u.getId(),u.getUsername(),u.visibleName(),u.getAvatarUrl(),u.getUserType().name(),mask(u.getEmail()),
        u.getStatus().name(),null,u.getCreatedAt());
  }
  private static SanctionView view(Sanction s,Instant now) {
    return new SanctionView(s.getId(),step(s),s.getReasonDetail(),s.getReasonCode(),s.getStartsAt(),s.getEndsAt(),s.getRevokedAt(),active(s,now));
  }
  private static String step(Sanction s) {
    if (s.getSanctionType()==SanctionType.SUSPENSION)
      return s.getEndsAt()!=null && Duration.between(s.getStartsAt(),s.getEndsAt()).toDays()<=PlanLimits.SANCTION_FIRST_DAYS ? "DAYS_7" : "DAYS_30";
    return s.getSanctionType()==SanctionType.PERMANENT_BAN ? "PERMANENT" : s.getSanctionType().name();
  }
  private static boolean accountType(Sanction s) {
    return Set.of(SanctionType.WARNING,SanctionType.SUSPENSION,SanctionType.PERMANENT_BAN).contains(s.getSanctionType());
  }
  private static boolean active(Sanction s,Instant now) {
    return s.getRevokedAt()==null && !s.getStartsAt().isAfter(now) && (s.getEndsAt()==null || s.getEndsAt().isAfter(now));
  }
  private static String mask(String email) {
    if (email==null || !email.contains("@")) return null;
    int at=email.indexOf('@'); return email.substring(0,Math.min(3,at))+"***"+email.substring(at);
  }
  private static String reason(String raw) {
    if (raw==null || raw.isBlank()) throw new ApiException(400,"REASON_REQUIRED","사유를 입력해 주세요");
    if (raw.strip().length()>2000) throw invalid(); return raw.strip();
  }
  private static <E extends Enum<E>> E parse(Class<E> type,String raw) {
    if (raw==null || raw.isBlank()) return null;
    try { return Enum.valueOf(type,raw); } catch (IllegalArgumentException e) { throw invalid(); }
  }
  private static ApiException missing() { return new ApiException(404,"NOT_FOUND","회원을 찾지 못했어요"); }
  private static ApiException invalid() { return new ApiException(400,"VALIDATION_ERROR","요청 값을 확인해 주세요"); }
}
