package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.linker.backend.dto.sitemap.SitemapItem;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.post.PostRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

/** B's public index contract against the real E tables; no shared DB or external calls. */
@SpringBootTest(properties = "spring.jpa.show-sql=false")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
class SitemapIntegrationTest {
  static final RsaMaterial KEYS = RsaMaterial.generate();
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");

  @Container
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
    r.add("spring.data.redis.host", REDIS::getHost);
    r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    r.add("linker.session.jwt-private-key", KEYS::privatePem);
    r.add("linker.session.jwt-public-key", KEYS::publicPem);
    r.add("linker.webhook.consumer-enabled", () -> "false");
    r.add("linker.team-setup.worker-enabled", () -> "false");
    r.add("linker.issues.sync-enabled", () -> "false");
    r.add("linker.issues.webhook-enabled", () -> "false");
  }

  // Delivery has separate coverage and must not race this fixture's TRUNCATE.
  @org.springframework.test.context.bean.override.mockito.MockitoBean
  com.linker.backend.async.notification.NotificationDeliveryService notificationDelivery;

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired UserRepository users;
  @Autowired PostRepository posts;
  @Autowired RecruitPostRepository recruits;
  @Autowired ObjectMapper json;
  User author;

  @BeforeEach
  void seed() {
    jdbc.execute("truncate users,github_repos,banned_github_ids restart identity cascade");
    author = users.saveAndFlush(User.create("public-author", UserType.DEVELOPER));
  }

  @ParameterizedTest
  @ValueSource(strings = {"posts", "recruits"})
  void publicContentUsesCanonicalUrlsAndStableBoundedPages(String kind) throws Exception {
    long first = content(kind, author);
    long second = content(kind, author);
    var response =
        mvc.perform(get("/api/v1/public/sitemap/" + kind))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "max-age=86400, public"))
            .andExpect(jsonPath("$.kind").value(kind))
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].id").value(first))
            .andExpect(jsonPath("$.items[0].url").value("/" + kind + "/" + first))
            .andExpect(jsonPath("$.items[1].id").value(second))
            .andExpect(jsonPath("$.items[0].updatedAt").isNotEmpty())
            .andReturn();
    var item = json.readTree(response.getResponse().getContentAsString()).path("items").get(0);
    assertThat(item.properties())
        .extracting(java.util.Map.Entry::getKey)
        .containsExactlyInAnyOrder("id", "url", "updatedAt");
    assertThat(index(kind, 0)).extracting(SitemapItem::id).containsExactly(first);
    assertThat(index(kind, 1)).extracting(SitemapItem::id).containsExactly(second);
    assertThat(index(kind, 2)).isEmpty();
    mvc.perform(get("/api/v1/public/sitemap/" + kind).param("page", "2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @ParameterizedTest
  @CsvSource({
    "posts,HIDDEN",
    "posts,UNDER_REVIEW",
    "posts,DELETED",
    "recruits,HIDDEN",
    "recruits,UNDER_REVIEW",
    "recruits,DELETED",
    "recruits,CLOSED"
  })
  void hiddenReviewedDeletedAndClosedContentNeverEntersSitemap(String kind, String state)
      throws Exception {
    long visible = content(kind, author);
    long excluded = content(kind, author);
    if (state.equals("DELETED"))
      jdbc.update("update " + table(kind) + " set deleted_at=now() where id=?", excluded);
    else if (state.equals("CLOSED"))
      jdbc.update("update recruit_posts set status='CLOSED',closed_at=now() where id=?", excluded);
    else jdbc.update("update " + table(kind) + " set visibility=? where id=?", state, excluded);
    mvc.perform(get("/api/v1/public/sitemap/" + kind))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(visible));
  }

  @ParameterizedTest
  @CsvSource({
    "posts,SUSPENDED",
    "posts,WITHDRAWING",
    "posts,DELETED",
    "posts,RECRUITER",
    "posts,DELETED_AT",
    "recruits,SUSPENDED",
    "recruits,WITHDRAWING",
    "recruits,DELETED",
    "recruits,RECRUITER",
    "recruits,DELETED_AT"
  })
  void inactiveDeletedAndRecruiterAuthorsAreExcluded(String kind, String state) throws Exception {
    User owner =
        state.equals("RECRUITER")
            ? users.saveAndFlush(User.create("recruiter", UserType.RECRUITER))
            : author;
    content(kind, owner);
    if (state.equals("DELETED_AT"))
      jdbc.update("update users set deleted_at=now() where id=?", owner.getId());
    else if (!state.equals("RECRUITER"))
      jdbc.update("update users set status=? where id=?", state, owner.getId());
    mvc.perform(get("/api/v1/public/sitemap/" + kind))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @ParameterizedTest
  @ValueSource(strings = {"posts", "recruits"})
  void persistedModerationChangesAreReflectedWithoutChangingContent(String kind) throws Exception {
    long id = content(kind, author);
    jdbc.update("update " + table(kind) + " set visibility='UNDER_REVIEW' where id=?", id);
    mvc.perform(get("/api/v1/public/sitemap/" + kind)).andExpect(jsonPath("$.items").isEmpty());
    jdbc.update("update " + table(kind) + " set visibility='VISIBLE' where id=?", id);
    mvc.perform(get("/api/v1/public/sitemap/" + kind))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(id));
  }

  private List<SitemapItem> index(String kind, int page) {
    return kind.equals("posts")
        ? posts.findIndexable(PageRequest.of(page, 1))
        : recruits.findIndexable(PageRequest.of(page, 1));
  }

  private static String table(String kind) {
    return kind.equals("posts") ? "posts" : "recruit_posts";
  }

  private long content(String kind, User owner) {
    if (kind.equals("recruits"))
      return jdbc.queryForObject(
          """
insert into recruit_posts(author_id,title,description,work_mode,deadline,status,visibility,sort_at,created_at,updated_at)
values (?,'공개 모집','비공개 연락처를 포함할 수 있는 본문','ONLINE',current_date+30,'OPEN','VISIBLE',now(),now(),now()) returning id
""",
          Long.class,
          owner.getId());
    long repo =
        jdbc.queryForObject(
            """
insert into github_repos(github_repo_id,owner_login,name,full_name,created_at,updated_at)
values (nextval('github_repos_id_seq'),'public-author','repo',?,now(),now()) returning id
""",
            Long.class,
            "public-author/repo-" + java.util.UUID.randomUUID());
    return jdbc.queryForObject(
        """
        insert into posts(author_id,repo_id,summary,body,visibility,created_at,updated_at)
        values (?,?,'공개 작업물','비공개 연락처를 포함할 수 있는 본문','VISIBLE',now(),now()) returning id
        """,
        Long.class,
        owner.getId(),
        repo);
  }
}
