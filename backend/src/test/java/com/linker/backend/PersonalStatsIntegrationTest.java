package com.linker.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.linker.backend.entity.account.*;
import com.linker.backend.entity.account.type.*;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.*;
import com.linker.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
class PersonalStatsIntegrationTest {
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
  @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired UserRepository users;
  @Autowired AuthIdentityRepository identities; @Autowired AuthService auth; @Autowired ObjectMapper json;
  @MockitoBean Clock clock;
  @Autowired com.linker.backend.repository.subscription.SubscriptionRepository subscriptions;
  @MockitoBean com.linker.backend.async.notification.NotificationDeliveryService delivery;
  @Autowired com.linker.backend.repository.post.PostRepository posts;
  @Autowired com.linker.backend.repository.post.PostViewRepository views;
  @Autowired com.linker.backend.repository.profile.ProfileVisitRepository visits;
  Instant now; User target,other,recruiter; Cookie own;
  @BeforeEach void setup() {
    // Monday 00:00 KST, still Sunday UTC: catches week/day boundary errors.
    now=Instant.parse("2026-11-08T15:00:00Z");
    when(clock.instant()).thenAnswer(i -> now);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    jdbc.execute("TRUNCATE users,github_repos,banned_github_ids RESTART IDENTITY CASCADE");
    target=user("author",UserType.DEVELOPER);other=user("other",UserType.DEVELOPER);recruiter=user("recruiter",UserType.RECRUITER);
    own=cookie(target);
  }
  @Test void freeSummaryContainsOnlyMyNonDeletedPostsAndNeverRequiresPro() throws Exception {
    long mine=post(target,"내 작업물",7,3,10);long hidden=post(target,"숨긴 작업물",1,2,5);
    jdbc.update("update posts set visibility='HIDDEN' where id=?",hidden);
    long deleted=post(target,"삭제",1,1,1);jdbc.update("update posts set deleted_at=now() where id=?",deleted);
    post(other,"다른 사람",99,99,99);
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(status().isOk())
        .andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.isPro").value(false));
    var result=json.readTree(mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andReturn().getResponse().getContentAsString());
    assertThat(result.toString()).contains("내 작업물","숨긴 작업물").doesNotContain("다른 사람","삭제","author@example.com");
    java.util.List<Long> counts=new java.util.ArrayList<>();
    for (var row:result.path("items")) counts.add(row.path("viewCount").asLong());
    assertThat(counts).containsExactlyInAnyOrder(10L,5L);
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("PLAN_LIMIT"));
  }
  @Test void allThreeApisRequireDeveloperAndPersonalAuthorization() throws Exception {
    for (String path:java.util.List.of("summary","posts","recruiter-views")) {
      mvc.perform(get("/api/v1/user/me/stats/"+path)).andExpect(status().isUnauthorized());
      mvc.perform(get("/api/v1/user/me/stats/"+path).cookie(cookie(recruiter))).andExpect(status().isForbidden())
          .andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
    }
    post(other,"비공개 통계",1,1,1);
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own).param("userId",""+other.getId()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    target.suspendUntil(now.plusSeconds(3600));users.saveAndFlush(target);
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(status().isOk());
  }
  @Test void proAuthorizationIsRecheckedAfterCancelRefundExpiryAndRepayment() throws Exception {
    var subscription=pro();
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(jsonPath("$.isPro").value(true));
    subscription.cancelAtPeriodEnd(now);subscriptions.saveAndFlush(subscription);
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isOk());
    subscription.endNow(now);subscriptions.saveAndFlush(subscription);
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(jsonPath("$.isPro").value(false));
    subscription=pro();
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isOk());
    now=now.plusSeconds(3600);
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(jsonPath("$.isPro").value(false));
  }
  @Test void recruiterCountsAreDistinctPerKstWeekAndNeverRevealWhoOrCompany() throws Exception {
    pro();var previous=java.time.LocalDate.parse("2026-11-08");var monday=previous.plusDays(1);
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,recruiter,previous));
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,recruiter,previous.minusDays(3)));
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,recruiter,monday));
    User second=user("second-recruiter",UserType.RECRUITER);
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,second,monday));
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,other,monday));
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(other,recruiter,monday));
    visits.saveAndFlush(com.linker.backend.entity.profile.ProfileVisit.record(target,recruiter,monday.plusDays(1)));
    var result=mvc.perform(get("/api/v1/user/me/stats/recruiter-views").cookie(own).param("weeks","2"))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.thisWeek").value(2)).andExpect(jsonPath("$.weeks[0].weekStart").value("2026-11-02"))
        .andExpect(jsonPath("$.weeks[0].count").value(1)).andExpect(jsonPath("$.weeks[1].weekStart").value("2026-11-09"))
        .andExpect(jsonPath("$.weeks[1].count").value(2)).andReturn();
    assertThat(result.getResponse().getContentAsString()).doesNotContain("recruiter","visitor","company","example.com");
    mvc.perform(get("/api/v1/user/me/stats/recruiter-views").cookie(own)).andExpect(jsonPath("$.weeks.length()").value(8));
  }
  @Test void sourcesTrendAndReadmeUseTheSameRecordedRowsWithoutSelfOrForeignViews() throws Exception {
    pro();long mine=post(target,"작업물",0,0,5);long foreign=post(other,"다른 사람",0,0,1);
    var today=java.time.LocalDate.parse("2026-11-09");int index=0;
    for (var source:com.linker.backend.entity.post.type.PostViewSource.values()) {
      User viewer=user("viewer-"+index,UserType.DEVELOPER);
      var view=com.linker.backend.entity.post.PostView.of(posts.findById(mine).orElseThrow(),viewer,index==0?today.minusDays(29):today,source);
      if (index<2) view.markReadmeExpanded();views.saveAndFlush(view);index++;
    }
    views.saveAndFlush(com.linker.backend.entity.post.PostView.of(posts.findById(mine).orElseThrow(),target,today,com.linker.backend.entity.post.type.PostViewSource.EXTERNAL));
    views.saveAndFlush(com.linker.backend.entity.post.PostView.of(posts.findById(foreign).orElseThrow(),target,today,com.linker.backend.entity.post.type.PostViewSource.EXTERNAL));
    views.saveAndFlush(com.linker.backend.entity.post.PostView.of(posts.findById(mine).orElseThrow(),other,today.minusDays(30),com.linker.backend.entity.post.type.PostViewSource.EXTERNAL));
    var result=mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].bySource.length()").value(5))
        .andExpect(jsonPath("$.items[0].readmeExpands").value(2)).andExpect(jsonPath("$.items[0].trend.length()").value(30))
        .andExpect(jsonPath("$.items[0].trend[0].views").value(1)).andExpect(jsonPath("$.items[0].trend[29].views").value(4)).andReturn();
    var row=json.readTree(result.getResponse().getContentAsString()).path("items").get(0);
    long bySource=0,byDay=0;
    for (var source:row.path("bySource")) bySource+=source.path("count").asLong();
    for (var day:row.path("trend")) byDay+=day.path("views").asLong();
    assertThat(bySource).isEqualTo(5).isEqualTo(byDay);
  }
  @Test void realEPostReadsDeduplicateAndGuestSelfReadsDoNotInventViews() throws Exception {
    long mine=post(target,"실제 조회",0,0,0);
    mvc.perform(get("/api/v1/public/posts/"+mine).cookie(cookie(other)).param("from","share")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/public/posts/"+mine).cookie(cookie(other)).param("from","feed")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/public/posts/"+mine).cookie(own)).andExpect(status().isOk());
    mvc.perform(get("/api/v1/public/posts/"+mine)).andExpect(status().isOk());
    mvc.perform(get("/api/v1/user/me/stats/summary").cookie(own)).andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].viewCount").value(1));
    assertThat(views.count()).isEqualTo(1);
    // E currently stores UTC view_date; B does not rewrite that producer or historical rows.
    assertThat(jdbc.queryForObject("select view_date from post_views",java.time.LocalDate.class)).isEqualTo(java.time.LocalDate.parse("2026-11-08"));
    pro();mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own)).andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].bySource[4].count").value(1));
  }
  @Test void periodsAreBoundedAndEmptyDatesAreZeroFilled() throws Exception {
    pro();post(target,"아직 조회 없음",0,0,0);
    mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own).param("days","1")).andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].trend[0].date").value("2026-11-09")).andExpect(jsonPath("$.items[0].trend[0].views").value(0));
    for (String days:java.util.List.of("0","31","-1","abc")) mvc.perform(get("/api/v1/user/me/stats/posts").cookie(own).param("days",days)).andExpect(status().isBadRequest());
    for (String weeks:java.util.List.of("0","9","-1","abc")) mvc.perform(get("/api/v1/user/me/stats/recruiter-views").cookie(own).param("weeks",weeks)).andExpect(status().isBadRequest());
  }
  @Test void openApiKeepsSummaryAndPaidChartItemsDistinct() throws Exception {
    var result=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();
    var root=json.readTree(result.getResponse().getContentAsString());
    var schemas=root.path("components").path("schemas");
    assertThat(schemas.path("StatsSummaryResponse").path("properties").path("items").path("items").path("$ref").asText())
        .endsWith("/StatsSummaryItem");
    assertThat(schemas.path("PostStatsResponse").path("properties").path("items").path("items").path("$ref").asText())
        .endsWith("/PostStatsItem");
    assertThat(schemas.path("StatsSummaryItem").path("properties").has("likeCount")).isTrue();
    assertThat(schemas.path("PostStatsItem").path("properties").has("bySource")).isTrue();
    for (String path:java.util.List.of("summary","recruiter-views","posts")) {
      var operation=root.path("paths").path("/api/v1/user/me/stats/"+path).path("get");
      assertThat(operation.path("tags").get(0).asText()).isEqualTo("p30-stats");
      assertThat(operation.path("responses").has("401")).isTrue();
      assertThat(operation.path("responses").has("403")).isTrue();
    }
  }
  private long post(User author,String summary,int likes,int comments,int count) {
    long repo=jdbc.queryForObject("insert into github_repos(github_repo_id,owner_login,name,full_name,is_private,is_fork,created_at,updated_at) values (nextval('github_repos_id_seq'),?,'repo',?,false,false,now(),now()) returning id",Long.class,author.getUsername(),author.getUsername()+"/repo-"+java.util.UUID.randomUUID());
    return jdbc.queryForObject("insert into posts(author_id,repo_id,summary,body,visibility,like_count,comment_count,view_count,created_at,updated_at) values (?,?,?,'설명','VISIBLE',?,?,?,now(),now()) returning id",Long.class,author.getId(),repo,summary,likes,comments,count);
  }
  private com.linker.backend.entity.subscription.Subscription pro() {
    return subscriptions.saveAndFlush(com.linker.backend.entity.subscription.Subscription.paid(
        com.linker.backend.entity.subscription.type.SubscriptionPlan.PRO,target.getId(),null,target.getId(),
        com.linker.backend.entity.subscription.type.BillingCycle.MONTHLY,null,now.minusSeconds(1),now.plusSeconds(3600)));
  }
  private int count(String table) { return jdbc.queryForObject("select count(*) from "+table,Integer.class); }
  private User user(String login,UserType type) {
    User u=User.create(login,type);u.changeDisplayName(login);u.keepNotificationEmail(login+"@example.com");u=users.saveAndFlush(u);
    identities.saveAndFlush(AuthIdentity.github(u,"gh-"+u.getId(),login,login+"@example.com",now));return u;
  }
  private Cookie cookie(User u) { return new Cookie("linker_session",auth.issue(u,"test","127.0.0.1").rawToken()); }
}
