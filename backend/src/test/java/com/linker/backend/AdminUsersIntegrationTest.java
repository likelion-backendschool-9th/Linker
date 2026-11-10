package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.linker.backend.entity.account.*;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.entity.moderation.*;
import com.linker.backend.entity.moderation.type.*;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.*;
import com.linker.backend.repository.moderation.*;
import com.linker.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class AdminUsersIntegrationTest {
  static final RsaMaterial KEYS=RsaMaterial.generate();
  @Container static final PostgreSQLContainer PG=new PostgreSQLContainer("postgres:16-alpine");
  @Container static final GenericContainer<?> REDIS=new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url",PG::getJdbcUrl); r.add("spring.datasource.username",PG::getUsername);
    r.add("spring.datasource.password",PG::getPassword); r.add("spring.data.redis.host",REDIS::getHost);
    r.add("spring.data.redis.port",() -> REDIS.getMappedPort(6379));
    r.add("linker.session.jwt-private-key",KEYS::privatePem);r.add("linker.session.jwt-public-key",KEYS::publicPem);
    r.add("linker.webhook.consumer-enabled",() -> "false");r.add("linker.issues.sync-enabled",() -> "false");
    r.add("linker.issues.webhook-enabled",() -> "false");r.add("spring.jpa.show-sql",() -> "false");
  }
  @Autowired org.springframework.data.redis.core.StringRedisTemplate redis;
  @Autowired org.springframework.context.ApplicationEventPublisher reviewEvents;
  @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
  @Autowired com.linker.backend.global.security.RedisRateLimiter limiter;
  @Autowired com.linker.backend.service.user.AiSummaryService ai;
  @Autowired com.linker.backend.repository.chat.ChatRoomMemberRepository chatMembers;
  @Autowired com.linker.backend.repository.chat.ChatRoomRepository chatRooms;
  @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
  com.linker.backend.repository.moderation.DailyLimitReviewRepository review;
  @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired UserRepository users;
  @Autowired AuthIdentityRepository identities; @Autowired AdminRepository admins;
  @Autowired SanctionRepository sanctions; @Autowired AuthService auth; @Autowired ObjectMapper json;
  @MockitoBean Clock clock;
  @MockitoBean com.linker.backend.integration.payment.PaymentGateway gateway;
  @Autowired com.linker.backend.repository.subscription.PaymentRepository payments;
  @Autowired com.linker.backend.repository.subscription.SubscriptionRepository subscriptions;
  @MockitoBean com.linker.backend.async.notification.NotificationDeliveryService delivery;
  @MockitoBean com.linker.backend.async.schedule.AccountSanctionExpiryJob expiry;
  Instant now; User operator,lead,target; Cookie op,root;
  @BeforeEach void setup() {
    var keys=redis.keys("admin-review:*");if(keys!=null && !keys.isEmpty()) redis.delete(keys);
    now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    when(clock.instant()).thenAnswer(i -> now); when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    when(clock.withZone(org.mockito.ArgumentMatchers.any())).thenAnswer(i -> Clock.fixed(now,i.getArgument(0)));
    jdbc.execute("TRUNCATE users,github_repos,banned_github_ids RESTART IDENTITY CASCADE");
    operator=user("operator",UserType.DEVELOPER);lead=user("lead",UserType.DEVELOPER);target=user("target",UserType.DEVELOPER);
    admins.saveAndFlush(Admin.assign(operator,AdminRole.OPERATOR));admins.saveAndFlush(Admin.assign(lead,AdminRole.LEAD));
    op=verified(operator);root=verified(lead);
  }
  @Test void dailyShareRejectionsFlagOnlyAboveThreeTimesAndExcludeMinuteLimits() throws Exception {
    var day=java.time.LocalDate.ofInstant(now,com.linker.backend.global.config.PlanLimits.APP_ZONE);
    org.mockito.Mockito.doAnswer(call -> {
      assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      return call.callRealMethod();
    }).when(review).record(org.mockito.ArgumentMatchers.anyLong(),org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyInt(),org.mockito.ArgumentMatchers.any());
    redis.opsForValue().set("rate:chat.share.day:"+day+":"+target.getId(),"100",java.time.Duration.ofHours(1));
    for(int i=0;i<300;i++) assertThat(limiter.tryAcquire("chat.share.day:"+day,target.getId(),100,3600).allowed()).isFalse();
    assertThat(review.flagged(day)).doesNotContain(target.getId());
    limiter.tryAcquire("chat.share.day:"+day,target.getId(),100,3600);
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("needsReview","true"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(target.getId())).andExpect(jsonPath("$.items[0].needsReview").value(true));
    redis.opsForValue().set("rate:chat.share:"+lead.getId(),"10",java.time.Duration.ofMinutes(1));
    for(int i=0;i<160;i++) limiter.tryAcquire("chat.share",lead.getId(),10,60);
    assertThat(review.flagged(day)).doesNotContain(lead.getId());
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("needsReview","true").param("q","no-match"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
  }

  @Test void deniedShareIsObservedAfterTheSqlTransactionRollsBack() {
    var day=java.time.LocalDate.ofInstant(now,com.linker.backend.global.config.PlanLimits.APP_ZONE);
    redis.opsForValue().set("rate:chat.share.day:"+day+":"+target.getId(),"100");
    redis.opsForValue().set("admin-review:"+day+":CHAT_SHARE:"+target.getId(),"300");
    org.mockito.Mockito.doAnswer(call -> {
      assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      return call.callRealMethod();
    }).when(review).record(org.mockito.ArgumentMatchers.anyLong(),org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyInt(),org.mockito.ArgumentMatchers.any());
    new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(tx -> {
      users.findById(target.getId()).orElseThrow();
      assertThat(limiter.tryAcquire("chat.share.day:"+day,target.getId(),100,3600).allowed()).isFalse();
      assertThat(review.flagged(day)).doesNotContain(target.getId());
      tx.setRollbackOnly();
    });
    assertThat(review.flagged(day)).contains(target.getId());
  }

  @Test void realAiQuotaRejectionsReachTheReviewCounter() throws Exception {
    long team=com.linker.backend.support.TeamTestFixtures.team(jdbc,target.getId(),"AI 테스트","ACTIVE");
    var room=chatRooms.saveAndFlush(com.linker.backend.entity.chat.ChatRoom.team(team));
    chatMembers.saveAndFlush(com.linker.backend.entity.chat.ChatRoomMember.join(room,target.getId()));
    subscriptions.saveAndFlush(com.linker.backend.entity.subscription.Subscription.paid(
        com.linker.backend.entity.subscription.type.SubscriptionPlan.FLEX,null,team,target.getId(),
        com.linker.backend.entity.subscription.type.BillingCycle.MONTHLY,6,now.minusSeconds(1),now.plusSeconds(86400)));
    var day=java.time.LocalDate.ofInstant(now,com.linker.backend.global.config.PlanLimits.APP_ZONE);
    redis.opsForValue().set("ai-summary:"+target.getId()+":"+day,"10");
    var principal=new com.linker.backend.global.security.AuthenticatedUser(target.getId(),target.getUsername(),UserType.DEVELOPER,
        UserStatus.ACTIVE,null,false,false,true,1);
    for(int i=0;i<30;i++) assertThatThrownBy(() -> ai.create(principal,room.getId())).isInstanceOf(com.linker.backend.global.error.ApiException.class);
    assertThat(review.flagged(day)).doesNotContain(target.getId());
    assertThatThrownBy(() -> ai.create(principal,room.getId())).isInstanceOf(com.linker.backend.global.error.ApiException.class);
    assertThat(review.flagged(day)).contains(target.getId());
  }

  @Test void reviewUsesTheAllowanceOfEachCategoryAndClearsNextKstDayWithoutLiftingSanctions() throws Exception {
    var category=com.linker.backend.dto.moderation.request.DailyLimitRejected.Category.RECRUITING_OFFER;
    for(int i=0;i<150;i++) reviewEvents.publishEvent(new com.linker.backend.dto.moderation.request.DailyLimitRejected(target.getId(),category,50,now));
    var day=java.time.LocalDate.ofInstant(now,com.linker.backend.global.config.PlanLimits.APP_ZONE);
    assertThat(review.flagged(day)).doesNotContain(target.getId());
    reviewEvents.publishEvent(new com.linker.backend.dto.moderation.request.DailyLimitRejected(target.getId(),category,50,now));
    assertThat(review.flagged(day)).contains(target.getId());
    jdbc.update("update users set status='SUSPENDED',suspended_until=? where id=?",java.sql.Timestamp.from(now.plusSeconds(86400*7)),target.getId());
    now=day.plusDays(1).atStartOfDay(com.linker.backend.global.config.PlanLimits.APP_ZONE).toInstant();op=verified(operator);
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("needsReview","true"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
  }

  @Test void listMasksEmailsSearchesAndPaginatesWithoutInventingReviewFlags() throws Exception {
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("q","@TARGET").param("userType","DEVELOPER"))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].emailMasked").value("tar***@example.com"))
        .andExpect(jsonPath("$.reviewFilterSupported").value(true)).andExpect(jsonPath("$.items[0].needsReview").value(false));
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("needsReview","true")).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    var first=mvc.perform(get("/api/v1/admin/users").cookie(op).param("size","1")).andExpect(status().isOk()).andReturn();
    String cursor=json.readTree(first.getResponse().getContentAsString()).path("nextCursor").asText();
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("size","1").param("cursor",cursor))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(lead.getId()));
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("q","%")).andExpect(jsonPath("$.items").isEmpty());
    mvc.perform(get("/api/v1/admin/users").cookie(op).param("status","INVALID")).andExpect(status().isBadRequest());
  }
  @Test void protectedRoutesNeedOtpAndRealAdminAndEmailRevealAuditsOnlyAfterReason() throws Exception {
    mvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/admin/users").cookie(cookie(operator))).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/admin/users").cookie(cookie(target))).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/admin/users/"+target.getId()+"/email-reveal").cookie(op).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\" \"}"))
        .andExpect(status().isBadRequest());
    assertThat(count("admin_actions")).isZero();
    mvc.perform(post("/api/v1/admin/users/"+target.getId()+"/email-reveal").cookie(op).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"회원 문의 확인\"}"))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.email").value("target@example.com"));
    assertThat(jdbc.queryForObject("select reason from admin_actions",String.class)).isEqualTo("회원 문의 확인");
    mvc.perform(get("/api/v1/admin/users/"+target.getId()).cookie(op)).andExpect(status().isOk())
        .andExpect(jsonPath("$.emailMasked").value("tar***@example.com")).andExpect(jsonPath("$.email").doesNotExist());
  }
  @Test void ladderEnforcesOrderLeadAndExactExpiryAndProducesAtomicAuditNotifications() throws Exception {
    apply(op,"DAYS_7",409);apply(op,"WARNING",200);apply(op,"DAYS_7",200);
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
    Cookie paused=cookie(target);
    mvc.perform(get("/api/v1/user/me").cookie(paused)).andExpect(status().isOk());
    mvc.perform(post("/api/v1/user/me/following/"+lead.getId()).cookie(paused)).andExpect(status().isForbidden());
    assertThat(count("admin_actions")).isEqualTo(2);assertThat(count("notifications")).isEqualTo(2);
    now=now.plus(7,java.time.temporal.ChronoUnit.DAYS);
    // New login restores at the exact boundary; no daily-review reset is involved.
    auth.issue(users.findById(target.getId()).orElseThrow(),"test","127.0.0.1");
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    op=verified(operator);root=verified(lead);
    apply(op,"DAYS_30",200);apply(op,"PERMANENT",403);apply(root,"PERMANENT",200);
    assertThat(count("banned_github_ids")).isEqualTo(1);
  }
  @Test void leadLiftKeepsOtherPenaltiesAndBanIsReleasedOnlyWithItsLinkedSanction() throws Exception {
    apply(op,"WARNING",200);apply(op,"DAYS_7",200);apply(op,"DAYS_30",200);
    long seven=sanctions.findByUser_IdOrderByIdDesc(target.getId()).get(1).getId();
    mvc.perform(delete(path()+"/"+seven).cookie(op)).andExpect(status().isForbidden());
    mvc.perform(delete(path()+"/"+seven).cookie(root)).andExpect(status().isNoContent());
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
    apply(root,"PERMANENT",200);
    long permanent=sanctions.findByUser_IdOrderByIdDesc(target.getId()).getFirst().getId();
    mvc.perform(delete(path()+"/"+permanent).cookie(root)).andExpect(status().isNoContent());
    assertThat(count("banned_github_ids")).isZero();
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
    assertThat(sanctions.findById(permanent).orElseThrow().getReasonDetail()).isEqualTo("반복 위반");
  }
  @Test void resetAfterOneYearAndSeverePermanentBanRequireExplicitCause() throws Exception {
    apply(op,"WARNING",200);
    jdbc.update("update sanctions set starts_at=?",java.sql.Timestamp.from(now.atZone(ZoneOffset.UTC).minusYears(1).toInstant()));
    apply(op,"WARNING",200);
    mvc.perform(post(path()).cookie(root).contentType(MediaType.APPLICATION_JSON)
        .content("{\"step\":\"PERMANENT\",\"reason\":\"불법 콘텐츠\",\"reasonCode\":\"ILLEGAL\"}"))
        .andExpect(status().isOk());
    mvc.perform(post(path()).cookie(root).contentType(MediaType.APPLICATION_JSON)
        .content("{\"step\":\"PERMANENT\",\"reason\":\"반복 위반\"}"))
        .andExpect(status().isConflict());
  }
  @Test void withdrawalIsNotCancelledBySanctionAndRestoringReappliesIt() throws Exception {
    target.markWithdrawing(now);users.saveAndFlush(target);
    apply(op,"WARNING",200);apply(op,"DAYS_7",200);
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.WITHDRAWING);
    User restored=users.findById(target.getId()).orElseThrow();restored.restoreWithdrawal(now,Duration.ofDays(30));users.saveAndFlush(restored);
    cookie(restored);
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
  }
  @Test void acceptedAppealClearsLinkedPermanentBanThroughExistingAFlow() throws Exception {
    mvc.perform(post(path()).cookie(root).contentType(MediaType.APPLICATION_JSON)
        .content("{\"step\":\"PERMANENT\",\"reason\":\"불법 콘텐츠\",\"reasonCode\":\"ILLEGAL\"}"))
        .andExpect(status().isOk());
    User second=user("secondlead",UserType.DEVELOPER);Admin admin=admins.saveAndFlush(Admin.assign(second,AdminRole.LEAD));
    long sanctionId=sanctions.findByUser_IdOrderByIdDesc(target.getId()).getFirst().getId();
    assertThat(jdbc.queryForObject("select sanction_id from banned_github_ids",Long.class)).isEqualTo(sanctionId);
    long appeal=jdbc.queryForObject("insert into appeals(sanction_id,user_id,body,status,created_at,updated_at) values (?,?,?,'PENDING',now(),now()) returning id",Long.class,sanctionId,target.getId(),"재심 요청");
    mvc.perform(post("/api/v1/admin/appeals/"+appeal+"/decision").cookie(verified(second)).contentType(MediaType.APPLICATION_JSON)
        .content("{\"accept\":true,\"reason\":\"오인 확인\"}")).andExpect(status().isNoContent());
    assertThat(count("banned_github_ids")).isZero();
    assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    mvc.perform(get("/api/v1/admin/users/"+target.getId()).cookie(root)).andExpect(status().isOk())
        .andExpect(jsonPath("$.sanctions").isEmpty());
    assertThat(jdbc.queryForObject("select count(*) from admin_actions where action='APPEAL_ACCEPT'",Integer.class)).isEqualTo(1);
  }
  @Test void refundRequiresAuditSchemaBeforeAnyProviderCall() throws Exception {
    jdbc.execute("alter table admin_actions drop constraint admin_actions_action_chk");
    jdbc.execute("alter table admin_actions add constraint admin_actions_action_chk check(action in ('SANCTION','REVOKE','VIEW_EMAIL'))");
    mvc.perform(post("/api/v1/admin/payments/999/refund").cookie(op)).andExpect(status().isServiceUnavailable());
    org.mockito.Mockito.verifyNoInteractions(gateway);
  }
  @Test void refundUsesDPolicyAndIdempotencyOutsideTransactionAndAuditsOnce() throws Exception {
    new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(new org.springframework.core.io.ClassPathResource(
        "db/admin-schema/26-refund-audit.sql")).execute(java.util.Objects.requireNonNull(jdbc.getDataSource()));
    var s=subscriptions.saveAndFlush(com.linker.backend.entity.subscription.Subscription.paid(
        com.linker.backend.entity.subscription.type.SubscriptionPlan.PRO,target.getId(),null,target.getId(),
        com.linker.backend.entity.subscription.type.BillingCycle.MONTHLY,null,now.plusSeconds(86400),now.plusSeconds(86400*32)));
    var old=payments.saveAndFlush(com.linker.backend.entity.subscription.Payment.order(target.getId(),s.getPlan(),s.getBillingCycle(),null,null,"old","Pro",2900));
    old.claim("oldkey");old.approve(s.getId(),"CARD",now.minusSeconds(86400),null);payments.saveAndFlush(old);
    var p=payments.saveAndFlush(com.linker.backend.entity.subscription.Payment.order(target.getId(),s.getPlan(),s.getBillingCycle(),null,null,"latest","Pro",2900));
    p.claim("latestkey");p.approve(s.getId(),"CARD",now,null);payments.saveAndFlush(p);
    jdbc.update("update payments set approved_at=? where id=?",java.sql.Timestamp.from(now.minusSeconds(7*86400)),p.getId());
    mvc.perform(post("/api/v1/admin/payments/"+p.getId()+"/refund").cookie(op)).andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REFUND_PERIOD_OVER"));
    org.mockito.Mockito.verifyNoInteractions(gateway);
    jdbc.update("update payments set approved_at=? where id=?",java.sql.Timestamp.from(now),p.getId());
    when(gateway.cancel(org.mockito.ArgumentMatchers.any())).thenThrow(new org.springframework.web.client.RestClientException("test timeout"));
    mvc.perform(post("/api/v1/admin/payments/"+p.getId()+"/refund").cookie(op)).andExpect(status().isBadGateway());
    assertThat(payments.findById(p.getId()).orElseThrow().getStatus().name()).isEqualTo("DONE");
    assertThat(count("admin_actions")).isZero();
    org.mockito.Mockito.doAnswer(i -> {
      assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
      com.linker.backend.integration.payment.PaymentCancelCommand command=i.getArgument(0);
      assertThat(command.idempotencyKey()).isEqualTo("cancel:latest");
      return new com.linker.backend.integration.payment.PaymentCancelResult("latestkey","latest","CANCELED",2900,2900,now.toString(),java.util.Map.of());
    }).when(gateway).cancel(org.mockito.ArgumentMatchers.any());
    mvc.perform(post("/api/v1/admin/payments/"+old.getId()+"/refund").cookie(op)).andExpect(status().isConflict());
    mvc.perform(post("/api/v1/admin/payments/"+p.getId()+"/refund").cookie(op)).andExpect(status().isOk())
        .andExpect(jsonPath("$.refunded").value(true));
    mvc.perform(post("/api/v1/admin/payments/"+p.getId()+"/refund").cookie(root)).andExpect(status().isOk());
    org.mockito.Mockito.verify(gateway,org.mockito.Mockito.times(2)).cancel(org.mockito.ArgumentMatchers.any());
    assertThat(jdbc.queryForObject("select count(*) from admin_actions where action='REFUND'",Integer.class)).isEqualTo(1);
    assertThat(payments.findById(p.getId()).orElseThrow().getRefundedAmount()).isEqualTo(2900);
    assertThat(subscriptions.findById(s.getId()).orElseThrow().getCurrentPeriodEnd()).isEqualTo(now.plusSeconds(86400));
    s=subscriptions.findById(s.getId()).orElseThrow();s.revokePeriod(s.getBillingCycle(),null,now,now.plusSeconds(86400));subscriptions.saveAndFlush(s);
    mvc.perform(post("/api/v1/admin/payments/"+old.getId()+"/refund").cookie(op)).andExpect(status().isConflict());
  }
  @Test void recruiterDetailCountsOfferEventsAndSuspensionHidesAdsUntilOperatorRestore() throws Exception {
    target=user("recruiter",UserType.RECRUITER);
    jdbc.update("insert into recruiter_profiles(user_id,company_name,company_email_domain,job_title,email_verified_at,created_at,updated_at) values (?,'회사','example.com','채용',now(),now(),now())",target.getId());
    long ad=jdbc.queryForObject("insert into recruiter_ads(recruiter_id,job_category,title,url,url_host,closes_on,status,created_at,updated_at) values (?,'BACKEND','백엔드','https://wanted.co.kr/1','wanted.co.kr',current_date+30,'ACTIVE',now(),now()) returning id",Long.class,target.getId());
    jdbc.update("insert into chat_rooms(room_type,dm_key,dm_status,request_kind,requester_id,responded_at,created_at,updated_at) values ('DIRECT','3:4','ACCEPTED','RECRUITING',?,?,?,now())",
        target.getId(),java.sql.Timestamp.from(now),java.sql.Timestamp.from(now.minusSeconds(31*86400)));
    jdbc.update("insert into chat_rooms(room_type,dm_key,dm_status,request_kind,requester_id,created_at,request_expires_at,updated_at) values ('DIRECT','3:5','REQUESTED','RECRUITING',?,?,now()+interval '30 days',now())",target.getId(),java.sql.Timestamp.from(now));
    mvc.perform(get("/api/v1/admin/users/"+target.getId()).cookie(op)).andExpect(status().isOk())
        .andExpect(jsonPath("$.recruiter.company").value("회사"))
        .andExpect(jsonPath("$.recruiter.offersSent30d").value(1)).andExpect(jsonPath("$.recruiter.offersAccepted30d").value(1));
    apply(op,"WARNING",200);
    assertThat(jdbc.queryForObject("select status from recruiter_ads where id=?",String.class,ad)).isEqualTo("ACTIVE");
    apply(op,"DAYS_7",200);
    assertThat(jdbc.queryForObject("select status from recruiter_ads where id=?",String.class,ad)).isEqualTo("HIDDEN");
    long sanction=sanctions.findByUser_IdOrderByIdDesc(target.getId()).getFirst().getId();
    mvc.perform(delete(path()+"/"+sanction).cookie(root)).andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select status from recruiter_ads where id=?",String.class,ad)).isEqualTo("HIDDEN");
  }
  @Test void twoWarningsForOneUserCannotSkipTheSanctionLadder() throws Exception {
    try (var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var start=new java.util.concurrent.CountDownLatch(1);
      java.util.concurrent.Callable<Integer> request=() -> {
        start.await();return mvc.perform(post(path()).cookie(op).contentType(MediaType.APPLICATION_JSON)
            .content("{\"step\":\"WARNING\",\"reason\":\"중복 요청\"}")).andReturn().getResponse().getStatus();
      };
      var a=pool.submit(request);var b=pool.submit(request);start.countDown();
      assertThat(java.util.List.of(a.get(15,java.util.concurrent.TimeUnit.SECONDS),b.get(15,java.util.concurrent.TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200,409);
      assertThat(sanctions.findByUser_IdOrderByIdDesc(target.getId())).hasSize(1);
    }
  }
  @Test void openApiKeepsMemberListDetailAndEmailSchemasDistinct() throws Exception {
    var result=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();
    var api=json.readTree(result.getResponse().getContentAsString());
    var schemas=api.path("components").path("schemas");
    assertThat(schemas.path("AdminUsersResponse").path("properties").path("items").path("items").path("$ref").asText())
        .endsWith("/AdminUserListItem");
    assertThat(schemas.path("AdminUserDetail").path("properties").has("payments")).isTrue();
    assertThat(schemas.path("AdminUserDetail").path("properties").has("email")).isFalse();
    assertThat(schemas.path("AdminUserRevealedEmail").path("properties").has("email")).isTrue();
    assertThat(schemas.path("AdminUserAllowedActions").path("properties").has("liftSanction")).isTrue();
    assertThat(schemas.path("AdminUserListItem").path("properties").path("needsReview").toString()).contains("null");
  }
  private void apply(Cookie actor,String step,int expected) throws Exception {
    mvc.perform(post(path()).cookie(actor).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(java.util.Map.of("step",step,"reason","반복 위반"))))
        .andExpect(status().is(expected));
  }
  private String path() { return "/api/v1/admin/users/"+target.getId()+"/sanctions"; }
  private int count(String table) { return jdbc.queryForObject("select count(*) from "+table,Integer.class); }
  private User user(String login,UserType type) {
    User u=User.create(login,type);u.changeDisplayName(login);u.keepNotificationEmail(login+"@example.com");u=users.saveAndFlush(u);
    identities.saveAndFlush(AuthIdentity.github(u,"gh-"+u.getId(),login,login+"@example.com",now));return u;
  }
  private Cookie cookie(User u) { return new Cookie("linker_session",auth.issue(u,"test","127.0.0.1").rawToken()); }
  private Cookie verified(User u) {
    var issued=auth.issue(u,"test","127.0.0.1");auth.markOperatorVerified(issued.sessionId(),now);
    return new Cookie("linker_session",issued.rawToken());
  }
}
