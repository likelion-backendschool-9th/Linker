package com.linker.backend.repository.subscription;

import static org.assertj.core.api.Assertions.assertThat;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.BillingCycle;
import com.linker.backend.entity.subscription.type.SubscriptionPlan;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.support.TeamTestFixtures;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Exact old SQL vs new scalar JPQL on V24, without selecting a new subscription policy. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class SubscriptionBenefitIntegrationTest {
  static final Instant NOW = Instant.parse("2026-11-08T00:00:00Z");
  @Container static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine");
  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }
  @Autowired SubscriptionRepository subscriptions;
  @Autowired UserRepository users;
  @Autowired JdbcTemplate jdbc;

  static Stream<Arguments> states() {
    return Stream.of(SubscriptionStatus.values()).flatMap(status ->
        Stream.of(-1L, 0L, 1L).flatMap(period ->
            Stream.of((Long)null, -1L, 0L, 1L).map(grace -> Arguments.of(status, period, grace))));
  }

  @ParameterizedTest
  @MethodSource("states")
  void consumersKeepTheirDifferentLegacyPredicates(SubscriptionStatus status, long end, Long grace) {
    User person = users.saveAndFlush(User.create("member", UserType.DEVELOPER));
    User recruiter = users.saveAndFlush(User.create("recruiter", UserType.RECRUITER));
    long team = TeamTestFixtures.team(jdbc, person.getId(), "혜택 팀", "ACTIVE");
    var pro = subscriptions.saveAndFlush(Subscription.paid(SubscriptionPlan.PRO, person.getId(), null,
        person.getId(), BillingCycle.MONTHLY, null, NOW.minusSeconds(100), NOW.plusSeconds(end)));
    var flex = subscriptions.saveAndFlush(Subscription.paid(SubscriptionPlan.FLEX, null, team,
        person.getId(), BillingCycle.MONTHLY, 1, NOW.minusSeconds(100), NOW.plusSeconds(end)));
    var scout = subscriptions.saveAndFlush(Subscription.paid(SubscriptionPlan.SCOUT, recruiter.getId(), null,
        recruiter.getId(), BillingCycle.MONTHLY, null, NOW.minusSeconds(100), NOW.plusSeconds(end)));
    jdbc.update("update subscriptions set status=?, grace_until=?", status.name(), grace == null ? null : Timestamp.from(NOW.plusSeconds(grace)));
    boolean oldPro = legacy(pro.getId(), "((status in ('TRIALING','ACTIVE','PAST_DUE') and current_period_end>?) or (status='PAST_DUE' and grace_until>?))", true);
    boolean oldFlex = legacy(flex.getId(), "((status in ('TRIALING','ACTIVE') and current_period_end>?) or (status='PAST_DUE' and grace_until>?))", true);
    boolean oldScout = legacy(scout.getId(), "status in ('ACTIVE','PAST_DUE') and (current_period_end>? or grace_until>?)", true);
    assertThat(subscriptions.hasProBenefit(person.getId(), NOW, true)).isEqualTo(oldPro);
    assertThat(subscriptions.hasFlexBenefit(team, NOW)).isEqualTo(oldFlex);
    assertThat(subscriptions.hasScoutBenefit(recruiter.getId(), NOW, true)).isEqualTo(oldScout);
    assertThat(subscriptions.hasProBenefit(person.getId(), NOW, false)).isEqualTo(
        legacy(pro.getId(), "status in ('TRIALING','ACTIVE','PAST_DUE') and current_period_end>?", false));
    assertThat(subscriptions.hasScoutBenefit(recruiter.getId(), NOW, false)).isEqualTo(
        legacy(scout.getId(), "status in ('ACTIVE','PAST_DUE') and current_period_end>?", false));
    assertThat(subscriptions.hasProBenefit(recruiter.getId(), NOW, true)).isFalse();
    assertThat(subscriptions.hasScoutBenefit(person.getId(), NOW, true)).isFalse();
    assertThat(subscriptions.hasFlexBenefit(team + 100, NOW)).isFalse();
  }

  private boolean legacy(long id, String predicate, boolean grace) {
    String sql = "select count(*)>0 from subscriptions where id=? and (" + predicate + ")";
    return Boolean.TRUE.equals(grace
        ? jdbc.queryForObject(sql, Boolean.class, id, Timestamp.from(NOW), Timestamp.from(NOW))
        : jdbc.queryForObject(sql, Boolean.class, id, Timestamp.from(NOW)));
  }

  @Test void schemaFallbackStaysFalseWithoutTheTableAndReturnsAfterRecovery() {
    assertThat(subscriptions.benefitSchema(null).ready()).isTrue();
    assertThat(subscriptions.benefitSchema("public").grace()).isTrue();
    jdbc.execute("alter table subscriptions rename to temporarily_missing_subscriptions");
    try {
      assertThat(subscriptions.subscriptionTableExists()).isFalse();
      assertThat(subscriptions.benefitSchema(null).ready()).isFalse();
      assertThat(subscriptions.benefitSchema("public").ready()).isFalse();
    } finally { jdbc.execute("alter table temporarily_missing_subscriptions rename to subscriptions"); }
    assertThat(subscriptions.subscriptionTableExists()).isTrue();
    jdbc.execute("alter table subscriptions rename column current_period_end to temporarily_missing_end");
    try {
      assertThat(subscriptions.subscriptionTableExists()).isTrue(); // C's existence-only contract.
      assertThat(subscriptions.benefitSchema(null).ready()).isFalse();
    } finally { jdbc.execute("alter table subscriptions rename column temporarily_missing_end to current_period_end"); }
  }
}
