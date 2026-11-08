package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.integration.payment.PaymentCancelCommand;
import com.linker.backend.integration.payment.PaymentCancelResult;
import com.linker.backend.integration.payment.PaymentConfirmCommand;
import com.linker.backend.integration.payment.PaymentConfirmResult;
import com.linker.backend.integration.payment.PaymentGateway;
import com.linker.backend.integration.payment.PaymentGatewayException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.issue.IssueRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.SubscriptionService;
import com.linker.backend.support.TeamTestFixtures;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.client.ResourceAccessException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Pages 28 and 29: plans, Flex team candidates, server checkout, Toss confirm and cancel (fake gateway),
 * fail return, subscription list, cancel, payment history, refund and expiry.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SubscriptionPaymentIntegrationTest {

	private static final Instant NOW = Instant.parse("2026-11-05T14:30:00Z");
	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final FakeGateway GATEWAY = new FakeGateway();

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		registry.add("linker.storage.mode", () -> "local");
		registry.add("linker.github.webhook-secret", () -> "test-webhook-secret");
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@org.springframework.boot.test.context.TestConfiguration
	static class Fixtures {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}

		@Bean
		@Primary
		PaymentGateway fakePaymentGateway() {
			return GATEWAY;
		}
	}

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;
	@Autowired
	private IssueRepository issues;
	@Autowired
	private ObjectMapper json;
	@Autowired
	private SubscriptionService subscriptionService;

	@BeforeEach
	void resetGateway() {
		GATEWAY.reset();
	}

	@Test
	void plansArePersonalAndRecruitersSeeNoPlanBeforeScout() throws Exception {
		User developer = user("plans", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/user/plans").param("reason", "photo-limit").cookie(cookie(developer)))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.reason").value("photo-limit"))
				.andExpect(jsonPath("$.currentPlan").value("FREE"))
				.andExpect(jsonPath("$.plans[*].key").value(org.hamcrest.Matchers.contains("FREE", "PRO", "FLEX")))
				.andExpect(jsonPath("$.plans[1].monthly").value(2_900))
				.andExpect(jsonPath("$.plans[1].yearly").value(29_000))
				.andExpect(jsonPath("$.plans[1].trialAvailable").value(false))
				.andExpect(jsonPath("$.plans[1].perExtraMember").doesNotExist())
				.andExpect(jsonPath("$.plans[2].yearly").value(nullValue()))
				.andExpect(jsonPath("$.plans[2].perExtraMember").value(1_900));
		mockMvc.perform(get("/api/v1/user/plans").param("reason", "<script>").cookie(cookie(developer)))
				.andExpect(jsonPath("$.reason").value(nullValue()));

		User recruiter = user("plans-recruiter", UserType.RECRUITER);
		mockMvc.perform(get("/api/v1/user/plans").cookie(cookie(recruiter)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.plans", hasSize(0)))
				.andExpect(jsonPath("$.currentPlan").value("FREE"));
		mockMvc.perform(get("/api/v1/user/plans/team-candidates").cookie(cookie(recruiter)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
		mockMvc.perform(get("/api/v1/user/plans")).andExpect(status().isUnauthorized());
	}

	@Test
	void teamCandidatesListOwnedTeamsWithHeadcountPrice() throws Exception {
		User owner = user("cand-owner", UserType.DEVELOPER);
		User admin = user("cand-admin", UserType.DEVELOPER);
		long big = TeamTestFixtures.team(jdbc, owner.getId(), "Big", "ACTIVE");
		member(big, owner, "OWNER", false);
		member(big, admin, "ADMIN", false);
		for (int i = 0; i < 5; i++) {
			member(big, user("cand-m" + i, UserType.DEVELOPER), "MEMBER", false);
		}
		member(big, user("cand-left", UserType.DEVELOPER), "MEMBER", true);
		long archived = TeamTestFixtures.team(jdbc, owner.getId(), "Old", "ARCHIVED");
		member(archived, owner, "OWNER", false);

		mockMvc.perform(get("/api/v1/user/plans/team-candidates").cookie(cookie(owner)))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.items", hasSize(1)))
				.andExpect(jsonPath("$.items[0].teamId").value(big))
				.andExpect(jsonPath("$.items[0].memberCount").value(7))
				.andExpect(jsonPath("$.items[0].amount").value(9_800))
				.andExpect(jsonPath("$.items[0].currentPlan").value("FREE"));
		mockMvc.perform(get("/api/v1/user/plans/team-candidates").cookie(cookie(admin)))
				.andExpect(jsonPath("$.items", hasSize(0)));
		mockMvc.perform(checkout(admin, "FLEX", "MONTHLY", big))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_PERMISSION"));
		mockMvc.perform(checkout(owner, "FLEX", "MONTHLY", archived))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_PERMISSION"));
	}

	@Test
	void checkoutUsesServerAmountAndChecksPlanForMemberType() throws Exception {
		User developer = user("checkout", UserType.DEVELOPER);
		JsonNode monthly = body(mockMvc.perform(post("/api/v1/user/payments/checkout").cookie(cookie(developer))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"planKey\":\"PRO\",\"billing\":\"MONTHLY\",\"amount\":10}"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.orderId").value(startsWith("lnk_")))
				.andExpect(jsonPath("$.amount").value(2_900))
				.andExpect(jsonPath("$.orderName").value("Pro 월간 구독"))
				.andExpect(jsonPath("$.teamId").value(nullValue()))
				.andReturn());
		assertThat(monthly.get("customerKey").asString()).startsWith("lnk_c_").doesNotContain(String.valueOf(developer.getId()));
		JsonNode again = body(mockMvc.perform(checkout(developer, "PRO", "YEARLY", null))
				.andExpect(jsonPath("$.amount").value(29_000))
				.andReturn());
		assertThat(again.get("customerKey").asString()).isEqualTo(monthly.get("customerKey").asString());
		assertThat(paymentStatus(monthly.get("orderId").asString())).isEqualTo("READY");

		mockMvc.perform(checkout(developer, "FLEX", "YEARLY", 1L))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_BILLING"));
		mockMvc.perform(checkout(developer, "PRO", "WEEKLY", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_BILLING"));
		mockMvc.perform(checkout(developer, "SCOUT", "MONTHLY", null))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("PLAN_MISMATCH"));
		mockMvc.perform(checkout(developer, "GOLD", "MONTHLY", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(checkout(developer, "FLEX", "MONTHLY", null))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_PERMISSION"));

		User recruiter = user("checkout-recruiter", UserType.RECRUITER);
		mockMvc.perform(checkout(recruiter, "PRO", "MONTHLY", null))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("PLAN_MISMATCH"));
		mockMvc.perform(checkout(recruiter, "SCOUT", "MONTHLY", null))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("PLAN_MISMATCH"));
	}

	@Test
	void confirmActivatesProOnlyAfterTossAndReplaysWithoutSecondCall() throws Exception {
		User developer = user("confirm", UserType.DEVELOPER);
		String orderId = order(developer, "PRO", "MONTHLY", null);

		mockMvc.perform(confirm(developer, orderId, "pay_" + orderId, 100))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("AMOUNT_MISMATCH"));
		User stranger = user("confirm-stranger", UserType.DEVELOPER);
		mockMvc.perform(confirm(stranger, orderId, "pay_" + orderId, 2_900))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
		mockMvc.perform(post("/api/v1/user/payments/" + orderId + "/fail").cookie(cookie(stranger))
						.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"X\"}"))
				.andExpect(status().isNotFound());
		assertThat(GATEWAY.calls).isEmpty();
		assertThat(liveRows(developer)).isZero();
		mockMvc.perform(get("/api/v1/user/recruit-editor/options").cookie(cookie(developer)))
				.andExpect(jsonPath("$.openLimit").value(3));

		mockMvc.perform(confirm(developer, orderId, "pay_" + orderId, 2_900))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.planKey").value("PRO"))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.expiresOn").value("2026-12-05"))
				.andExpect(jsonPath("$.amount").value(2_900))
				.andExpect(jsonPath("$.benefits[2]").value("피드 저장소 사진 10장으로 확장"));
		assertThat(GATEWAY.calls).singleElement().satisfies(call -> {
			assertThat(call.amount()).isEqualTo(2_900);
			assertThat(call.idempotencyKey()).isEqualTo("confirm:" + orderId);
		});
		Map<String, Object> row = jdbc.queryForMap(
				"select plan, status, billing_cycle, payer_user_id, current_period_end from subscriptions where user_id = ?",
				developer.getId());
		assertThat(row).containsEntry("plan", "PRO").containsEntry("status", "ACTIVE")
				.containsEntry("billing_cycle", "MONTHLY").containsEntry("payer_user_id", developer.getId());
		assertThat(((Timestamp) row.get("current_period_end")).toInstant()).isEqualTo(Instant.parse("2026-12-05T14:30:00Z"));
		Map<String, Object> payment = jdbc.queryForMap(
				"select status, method, approved_at, raw_response::text as raw, subscription_id from payments where order_id = ?", orderId);
		assertThat(payment).containsEntry("status", "DONE").containsEntry("method", "카드");
		assertThat((String) payment.get("raw")).contains("DONE");
		mockMvc.perform(get("/api/v1/user/plans").cookie(cookie(developer)))
				.andExpect(jsonPath("$.currentPlan").value("PRO"));
		// PlanLimits applied by the existing readers: Pro open recruit posts 3 → 10.
		mockMvc.perform(get("/api/v1/user/recruit-editor/options").cookie(cookie(developer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.openLimit").value(10));

		mockMvc.perform(confirm(developer, orderId, "pay_" + orderId, 2_900))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.expiresOn").value("2026-12-05"));
		assertThat(GATEWAY.calls).hasSize(1);
		mockMvc.perform(confirm(developer, orderId, "pay_other", 2_900))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PAYMENT_CONFIRMED"));
		mockMvc.perform(post("/api/v1/user/payments/" + orderId + "/fail").cookie(cookie(developer))
						.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"PAY_PROCESS_CANCELED\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PAYMENT_CONFIRMED"));

		// A second one-time payment extends the same live row from the old period end.
		String yearly = order(developer, "PRO", "YEARLY", null);
		mockMvc.perform(confirm(developer, yearly, "pay_" + yearly, 29_000))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.expiresOn").value("2027-12-05"));
		assertThat(liveRows(developer)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select billing_cycle from subscriptions where user_id = ?", String.class,
				developer.getId())).isEqualTo("YEARLY");

		// The same paymentKey cannot be bound to another order.
		String reused = order(developer, "PRO", "MONTHLY", null);
		mockMvc.perform(confirm(developer, reused, "pay_" + orderId, 2_900))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PAYMENT"));
	}

	@Test
	void tossRefusalFailsTheOrderAndAnOutageKeepsItRetryable() throws Exception {
		User developer = user("refuse", UserType.DEVELOPER);
		String refused = order(developer, "PRO", "MONTHLY", null);
		GATEWAY.next.set(command -> {
			throw new PaymentGatewayException(400, "REJECT_CARD_COMPANY", "카드사 거절", "{\"code\":\"REJECT_CARD_COMPANY\"}");
		});
		mockMvc.perform(confirm(developer, refused, "pay_" + refused, 2_900))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PAYMENT_REJECTED"))
				.andExpect(jsonPath("$.detail.providerCode").value("REJECT_CARD_COMPANY"));
		assertThat(paymentStatus(refused)).isEqualTo("FAILED");
		mockMvc.perform(confirm(developer, refused, "pay_" + refused, 2_900))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ORDER_FAILED"));

		String outage = order(developer, "PRO", "MONTHLY", null);
		GATEWAY.next.set(command -> {
			throw new ResourceAccessException("read timed out");
		});
		mockMvc.perform(confirm(developer, outage, "pay_" + outage, 2_900))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.code").value("PAYMENT_GATEWAY_ERROR"));
		GATEWAY.next.set(command -> {
			throw new PaymentGatewayException(500, "FAILED_INTERNAL_SYSTEM_PROCESSING", "내부 오류", "");
		});
		mockMvc.perform(confirm(developer, outage, "pay_" + outage, 2_900))
				.andExpect(status().isBadGateway());
		assertThat(paymentStatus(outage)).isEqualTo("READY");
		assertThat(liveRows(developer)).isZero();
		// A claimed order is not ended by the fail return while its confirm is unresolved.
		mockMvc.perform(post("/api/v1/user/payments/" + outage + "/fail").cookie(cookie(developer))
						.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"PAY_PROCESS_CANCELED\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PAYMENT_PROCESSING"));

		GATEWAY.next.set(FakeGateway::approve);
		mockMvc.perform(confirm(developer, outage, "pay_" + outage, 2_900)).andExpect(status().isOk());
		assertThat(GATEWAY.calls).extracting(PaymentConfirmCommand::idempotencyKey).containsOnly("confirm:" + refused, "confirm:" + outage);

		String odd = order(developer, "PRO", "MONTHLY", null);
		GATEWAY.next.set(command -> new PaymentConfirmResult(command.paymentKey(), command.orderId(), command.amount(),
				"WAITING_FOR_DEPOSIT", "가상계좌", null, Map.of("status", "WAITING_FOR_DEPOSIT")));
		mockMvc.perform(confirm(developer, odd, "pay_" + odd, 2_900))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PAYMENT_REJECTED"));
		assertThat(jdbc.queryForObject("select failure_code from payments where order_id = ?", String.class, odd))
				.isEqualTo("UNEXPECTED_WAITING_FOR_DEPOSIT");
	}

	@Test
	void failReturnRecordsReadyOrdersOnce() throws Exception {
		User developer = user("fail", UserType.DEVELOPER);
		String orderId = order(developer, "PRO", "MONTHLY", null);
		mockMvc.perform(post("/api/v1/user/payments/" + orderId + "/fail").cookie(cookie(developer))
						.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"PAY_PROCESS_CANCELED\"}"))
				.andExpect(status().isNoContent())
				.andExpect(header().string("Cache-Control", "no-store, private"));
		mockMvc.perform(post("/api/v1/user/payments/" + orderId + "/fail").cookie(cookie(developer))
						.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"OTHER\"}"))
				.andExpect(status().isNoContent());
		assertThat(jdbc.queryForMap("select status, failure_code from payments where order_id = ?", orderId))
				.containsEntry("status", "FAILED").containsEntry("failure_code", "PAY_PROCESS_CANCELED");
		mockMvc.perform(confirm(developer, orderId, "pay_" + orderId, 2_900))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ORDER_FAILED"));
		mockMvc.perform(post("/api/v1/user/payments/missing-order/fail").cookie(cookie(developer)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
		assertThat(GATEWAY.calls).isEmpty();
	}

	@Test
	void flexConfirmActivatesTheTeamAndALostOwnerCannotConfirm() throws Exception {
		User owner = user("flex-owner", UserType.DEVELOPER);
		long team = TeamTestFixtures.team(jdbc, owner.getId(), "Flex Team", "ACTIVE");
		member(team, owner, "OWNER", false);
		member(team, user("flex-m", UserType.DEVELOPER), "MEMBER", false);
		JsonNode order = body(mockMvc.perform(checkout(owner, "FLEX", "MONTHLY", team))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.amount").value(7_900))
				.andExpect(jsonPath("$.orderName").value("Flex · Flex Team 구독"))
				.andExpect(jsonPath("$.teamId").value(team))
				.andReturn());
		String orderId = order.get("orderId").asString();
		assertThat(issues.flexActive(team, NOW)).isFalse();
		mockMvc.perform(confirm(owner, orderId, "pay_" + orderId, 7_900))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.planKey").value("FLEX"))
				.andExpect(jsonPath("$.benefits[0]").value("팀 인원 무제한"));
		assertThat(issues.flexActive(team, NOW)).isTrue();
		assertThat(jdbc.queryForMap("select user_id, seats, payer_user_id from subscriptions where team_id = ?", team))
				.containsEntry("user_id", null).containsEntry("seats", 2).containsEntry("payer_user_id", owner.getId());
		mockMvc.perform(get("/api/v1/user/plans/team-candidates").cookie(cookie(owner)))
				.andExpect(jsonPath("$.items[0].currentPlan").value("FLEX"));
		mockMvc.perform(get("/api/v1/user/plans").cookie(cookie(owner)))
				.andExpect(jsonPath("$.currentPlan").value("FREE"));

		String later = order(owner, "FLEX", "MONTHLY", team);
		jdbc.update("update team_members set role = 'ADMIN' where team_id = ? and user_id = ?", team, owner.getId());
		jdbc.update("update subscriptions set payer_user_id = ? where team_id = ?",
				users.saveAndFlush(User.create("flex-payer-" + System.nanoTime(), UserType.DEVELOPER)).getId(), team);
		mockMvc.perform(confirm(owner, later, "pay_" + later, 7_900))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_PERMISSION"));
		assertThat(paymentStatus(later)).isEqualTo("FAILED");
		assertThat(GATEWAY.calls).hasSize(1);
	}

	@Test
	void concurrentConfirmsNeverActivateTwice() throws Exception {
		User developer = user("race", UserType.DEVELOPER);
		String first = order(developer, "PRO", "MONTHLY", null);
		String second = order(developer, "PRO", "MONTHLY", null);
		List<Callable<Integer>> calls = new ArrayList<>();
		CountDownLatch start = new CountDownLatch(1);
		for (String orderId : List.of(first, first, second, second)) {
			calls.add(() -> {
				start.await();
				return mockMvc.perform(confirm(developer, orderId, "pay_" + orderId, 2_900)).andReturn().getResponse().getStatus();
			});
		}
		ExecutorService pool = Executors.newFixedThreadPool(calls.size());
		try {
			List<Future<Integer>> futures = new ArrayList<>();
			for (Callable<Integer> call : calls) {
				futures.add(pool.submit(call));
			}
			start.countDown();
			for (Future<Integer> future : futures) {
				assertThat(future.get(30, TimeUnit.SECONDS)).isEqualTo(200);
			}
		}
		finally {
			pool.shutdownNow();
		}
		assertThat(liveRows(developer)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select current_period_end from subscriptions where user_id = ?", Timestamp.class,
				developer.getId()).toInstant()).isEqualTo(Instant.parse("2027-01-05T14:30:00Z"));
		assertThat(jdbc.queryForObject("select count(*) from payments where payer_user_id = ? and status = 'DONE'",
				Integer.class, developer.getId())).isEqualTo(2);
	}

	@Test
	void openApiDocumentsPageTwentyEightRoutes() throws Exception {
		String confirm = "$.paths['/api/v1/user/payments/confirm'].post";
		String fail = "$.paths['/api/v1/user/payments/{orderId}/fail'].post";
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/user/plans'].get.operationId").value("listPlans"))
				.andExpect(jsonPath("$.paths['/api/v1/user/plans'].get.tags[0]").value("p28-subscribe"))
				.andExpect(jsonPath("$.paths['/api/v1/user/plans/team-candidates'].get.operationId").value("listFlexTeamCandidates"))
				.andExpect(jsonPath("$.paths['/api/v1/user/payments/checkout'].post.operationId").value("createCheckout"))
				.andExpect(jsonPath("$.paths['/api/v1/user/payments/checkout'].post.responses['403']").exists())
				.andExpect(jsonPath(confirm + ".operationId").value("confirmPayment"))
				.andExpect(jsonPath(confirm + ".responses['409']").exists())
				.andExpect(jsonPath(confirm + ".responses['502']").exists())
				.andExpect(jsonPath(fail + ".operationId").value("recordPaymentFailure"))
				.andExpect(jsonPath(fail + ".responses['204']").exists())
				.andExpect(jsonPath(fail + ".responses['200']").doesNotExist());
	}

	// ---------------------------------------------------------------- page 29

	@Test
	void mySubscriptionsListOwnProAndPaidFlexWithNextHeadcount() throws Exception {
		User developer = user("manage", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/user/me/subscriptions").cookie(cookie(developer)))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.items", hasSize(0)));
		pay(developer, "PRO", "MONTHLY", null, 2_900);

		User member = user("manage-m", UserType.DEVELOPER);
		long team = TeamTestFixtures.team(jdbc, developer.getId(), "Manage Team", "ACTIVE");
		member(team, developer, "OWNER", false);
		member(team, member, "MEMBER", false);
		pay(developer, "FLEX", "MONTHLY", team, 7_900);
		for (int i = 0; i < 5; i++) {
			member(team, user("manage-x" + i, UserType.DEVELOPER), "MEMBER", false);
		}

		mockMvc.perform(get("/api/v1/user/me/subscriptions").cookie(cookie(developer)))
				.andExpect(jsonPath("$.items", hasSize(2)))
				.andExpect(jsonPath("$.items[0].planKey").value("PRO"))
				.andExpect(jsonPath("$.items[0].status").value("ACTIVE"))
				.andExpect(jsonPath("$.items[0].billing").value("MONTHLY"))
				.andExpect(jsonPath("$.items[0].expiresOn").value("2026-12-05"))
				.andExpect(jsonPath("$.items[0].nextBillingOn").value(nullValue()))
				.andExpect(jsonPath("$.items[0].cancelAtPeriodEnd").value(false))
				.andExpect(jsonPath("$.items[0].teamId").value(nullValue()))
				.andExpect(jsonPath("$.items[0].nextAmount").value(nullValue()))
				.andExpect(jsonPath("$.items[1].planKey").value("FLEX"))
				.andExpect(jsonPath("$.items[1].teamId").value(team))
				.andExpect(jsonPath("$.items[1].teamName").value("Manage Team"))
				.andExpect(jsonPath("$.items[1].seats").value(2))
				.andExpect(jsonPath("$.items[1].nextSeats").value(7))
				.andExpect(jsonPath("$.items[1].nextAmount").value(9_800));
		// A team member who does not pay sees neither the owner's Pro nor the team's Flex.
		mockMvc.perform(get("/api/v1/user/me/subscriptions").cookie(cookie(member)))
				.andExpect(jsonPath("$.items", hasSize(0)));
		mockMvc.perform(get("/api/v1/user/me/subscriptions")).andExpect(status().isUnauthorized());
	}

	@Test
	void mySubscriptionsListOwnProWithoutAnyTeam() throws Exception {
		// Pro only (the MVP demo): no team ids, so the team lookups are empty maps.
		User developer = user("pro-only", UserType.DEVELOPER);
		pay(developer, "PRO", "MONTHLY", null, 2_900);
		mockMvc.perform(get("/api/v1/user/me/subscriptions").cookie(cookie(developer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items", hasSize(1)))
				.andExpect(jsonPath("$.items[0].planKey").value("PRO"))
				.andExpect(jsonPath("$.items[0].teamName").value(nullValue()))
				.andExpect(jsonPath("$.items[0].nextSeats").value(nullValue()));
	}

	@Test
	void paymentHistoryShowsPaidOrdersNewestFirstWithRefundReason() throws Exception {
		User developer = user("history", UserType.DEVELOPER);
		String first = pay(developer, "PRO", "MONTHLY", null, 2_900);
		order(developer, "PRO", "MONTHLY", null); // READY order: not history
		String failed = order(developer, "PRO", "MONTHLY", null);
		mockMvc.perform(post("/api/v1/user/payments/" + failed + "/fail").cookie(cookie(developer))
				.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"PAY_PROCESS_CANCELED\"}"));
		String second = pay(developer, "PRO", "MONTHLY", null, 2_900);

		mockMvc.perform(get("/api/v1/user/me/payments").cookie(cookie(developer)))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.items", hasSize(2)))
				.andExpect(jsonPath("$.items[0].paymentId").value(paymentId(second)))
				.andExpect(jsonPath("$.items[0].status").value("DONE"))
				.andExpect(jsonPath("$.items[0].orderName").value("Pro 월간 구독"))
				.andExpect(jsonPath("$.items[0].method").value("카드"))
				.andExpect(jsonPath("$.items[0].approvedAt").value("2026-11-05T14:30:00Z"))
				.andExpect(jsonPath("$.items[0].refundable").value(true))
				.andExpect(jsonPath("$.items[0].refundReason").value(nullValue()))
				.andExpect(jsonPath("$.items[1].paymentId").value(paymentId(first)))
				.andExpect(jsonPath("$.items[1].refundable").value(false))
				.andExpect(jsonPath("$.items[1].refundReason").value("가장 최근 결제부터 환불할 수 있어요."))
				.andExpect(jsonPath("$.nextCursor").value(nullValue()));

		User other = user("history-other", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/user/me/payments").cookie(cookie(other)))
				.andExpect(jsonPath("$.items", hasSize(0)));
		mockMvc.perform(get("/api/v1/user/me/payments").param("cursor", "x").cookie(cookie(developer)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(get("/api/v1/user/me/payments").param("cursor", String.valueOf(paymentId(second)))
						.cookie(cookie(developer)))
				.andExpect(jsonPath("$.items", hasSize(1)))
				.andExpect(jsonPath("$.items[0].paymentId").value(paymentId(first)));
	}

	@Test
	void historyPagesByTwenty() throws Exception {
		User developer = user("paging", UserType.DEVELOPER);
		for (int i = 0; i < 21; i++) {
			pay(developer, "PRO", "MONTHLY", null, 2_900);
		}
		JsonNode page = body(mockMvc.perform(get("/api/v1/user/me/payments").cookie(cookie(developer)))
				.andExpect(jsonPath("$.items", hasSize(20)))
				.andReturn());
		String cursor = page.get("nextCursor").asString();
		assertThat(cursor).isEqualTo(page.get("items").get(19).get("paymentId").asString());
		mockMvc.perform(get("/api/v1/user/me/payments").param("cursor", cursor).cookie(cookie(developer)))
				.andExpect(jsonPath("$.items", hasSize(1)))
				.andExpect(jsonPath("$.nextCursor").value(nullValue()));
	}

	@Test
	void cancelKeepsBenefitsUntilPeriodEndAndPayingAgainUndoesIt() throws Exception {
		User developer = user("cancel", UserType.DEVELOPER);
		pay(developer, "PRO", "MONTHLY", null, 2_900);
		long subscriptionId = subscriptionId(developer);

		mockMvc.perform(cancelSubscription(developer, subscriptionId))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.subscriptionId").value(subscriptionId))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.cancelAtPeriodEnd").value(true))
				.andExpect(jsonPath("$.expiresOn").value("2026-12-05"));
		assertThat(jdbc.queryForObject("select canceled_at from subscriptions where id = ?", Timestamp.class,
				subscriptionId).toInstant()).isEqualTo(NOW);
		mockMvc.perform(cancelSubscription(developer, subscriptionId)).andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/user/plans").cookie(cookie(developer)))
				.andExpect(jsonPath("$.currentPlan").value("PRO"));
		mockMvc.perform(get("/api/v1/user/recruit-editor/options").cookie(cookie(developer)))
				.andExpect(jsonPath("$.openLimit").value(10));

		User stranger = user("cancel-stranger", UserType.DEVELOPER);
		mockMvc.perform(cancelSubscription(stranger, subscriptionId))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("SUBSCRIPTION_NOT_FOUND"));

		pay(developer, "PRO", "MONTHLY", null, 2_900);
		assertThat(jdbc.queryForMap("select cancel_at_period_end, canceled_at from subscriptions where id = ?", subscriptionId))
				.containsEntry("cancel_at_period_end", false).containsEntry("canceled_at", null);

		jdbc.update("update subscriptions set current_period_start = ?, current_period_end = ? where id = ?",
				Timestamp.from(NOW.minusSeconds(86_400 * 31L)), Timestamp.from(NOW.minusSeconds(60)), subscriptionId);
		mockMvc.perform(cancelSubscription(developer, subscriptionId))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("SUBSCRIPTION_ENDED"));
	}

	@Test
	void onlyTheFlexBillingOwnerCancels() throws Exception {
		User owner = user("flex-cancel", UserType.DEVELOPER);
		User admin = user("flex-cancel-admin", UserType.DEVELOPER);
		long team = TeamTestFixtures.team(jdbc, owner.getId(), "Cancel Team", "ACTIVE");
		member(team, owner, "OWNER", false);
		member(team, admin, "ADMIN", false);
		pay(owner, "FLEX", "MONTHLY", team, 7_900);
		long subscriptionId = jdbc.queryForObject("select id from subscriptions where team_id = ?", Long.class, team);

		mockMvc.perform(cancelSubscription(admin, subscriptionId))
				.andExpect(status().isNotFound());
		mockMvc.perform(cancelSubscription(owner, subscriptionId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.planKey").value("FLEX"))
				.andExpect(jsonPath("$.teamName").value("Cancel Team"))
				.andExpect(jsonPath("$.cancelAtPeriodEnd").value(true));
		assertThat(issues.flexActive(team, NOW)).isTrue();
	}

	@Test
	void refundTakesBackOnlyAPaidPeriodThatHasNotStarted() throws Exception {
		User developer = user("refund", UserType.DEVELOPER);
		String first = pay(developer, "PRO", "MONTHLY", null, 2_900);
		mockMvc.perform(refund(developer, paymentId(first)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("REFUND_BENEFITS_USED"));

		String yearly = pay(developer, "PRO", "YEARLY", null, 29_000);
		assertThat(periodEnd(developer)).isEqualTo(Instant.parse("2027-12-05T14:30:00Z"));
		mockMvc.perform(refund(developer, paymentId(first)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("REFUND_NOT_LATEST"));
		User stranger = user("refund-stranger", UserType.DEVELOPER);
		mockMvc.perform(refund(stranger, paymentId(yearly)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("PAYMENT_NOT_FOUND"));
		String ready = order(developer, "PRO", "MONTHLY", null);
		mockMvc.perform(refund(developer, paymentId(ready)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("NOT_REFUNDABLE"));
		assertThat(GATEWAY.cancels).isEmpty();

		mockMvc.perform(refund(developer, paymentId(yearly)))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store, private"))
				.andExpect(jsonPath("$.status").value("CANCELED"))
				.andExpect(jsonPath("$.refundedAmount").value(29_000))
				.andExpect(jsonPath("$.canceledAt").value("2026-11-05T15:00:00Z"))
				.andExpect(jsonPath("$.refundable").value(false));
		assertThat(GATEWAY.cancels).singleElement().satisfies(call -> {
			assertThat(call.paymentKey()).isEqualTo("pay_" + yearly);
			assertThat(call.cancelAmount()).isNull();
			assertThat(call.idempotencyKey()).isEqualTo("cancel:" + yearly);
		});
		Map<String, Object> row = jdbc.queryForMap("""
				select status, billing_cycle, current_period_start, current_period_end from subscriptions where user_id = ?
				""", developer.getId());
		assertThat(row).containsEntry("status", "ACTIVE").containsEntry("billing_cycle", "MONTHLY");
		assertThat(((Timestamp) row.get("current_period_start")).toInstant()).isEqualTo(NOW);
		assertThat(((Timestamp) row.get("current_period_end")).toInstant()).isEqualTo(Instant.parse("2026-12-05T14:30:00Z"));
		assertThat(jdbc.queryForMap("""
				select status, cancel_reason, refunded_amount, raw_response::text as raw from payments where order_id = ?
				""", yearly))
				.containsEntry("status", "CANCELED").containsEntry("refunded_amount", 29_000)
				.containsEntry("cancel_reason", "7일 이내 혜택 시작 전 환불")
				.hasEntrySatisfying("raw", raw -> assertThat((String) raw).contains("CANCELED"));

		mockMvc.perform(refund(developer, paymentId(yearly)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELED"));
		assertThat(GATEWAY.cancels).hasSize(1);
		// A refunded order cannot be confirmed again to win the period back.
		mockMvc.perform(confirm(developer, yearly, "pay_" + yearly, 29_000))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ORDER_FAILED"));
		assertThat(periodEnd(developer)).isEqualTo(Instant.parse("2026-12-05T14:30:00Z"));
		mockMvc.perform(get("/api/v1/user/me/payments").cookie(cookie(developer)))
				.andExpect(jsonPath("$.items[0].status").value("CANCELED"))
				.andExpect(jsonPath("$.items[0].refundReason").value(nullValue()))
				.andExpect(jsonPath("$.items[1].refundReason").value(
						"이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요."));

		// Past the 7-day window a not-yet-started period is still not refundable.
		String late = pay(developer, "PRO", "MONTHLY", null, 2_900);
		jdbc.update("update payments set approved_at = ? where order_id = ?",
				Timestamp.from(NOW.minusSeconds(86_400 * 7L)), late);
		mockMvc.perform(refund(developer, paymentId(late)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("REFUND_PERIOD_OVER"));
	}

	@Test
	void flexRefundRestoresThePaidHeadcount() throws Exception {
		User owner = user("flex-refund", UserType.DEVELOPER);
		long team = TeamTestFixtures.team(jdbc, owner.getId(), "Refund Team", "ACTIVE");
		member(team, owner, "OWNER", false);
		pay(owner, "FLEX", "MONTHLY", team, 7_900);
		for (int i = 0; i < 6; i++) {
			member(team, user("flex-refund-m" + i, UserType.DEVELOPER), "MEMBER", false);
		}
		String extension = pay(owner, "FLEX", "MONTHLY", team, 9_800);
		assertThat(jdbc.queryForObject("select seats from subscriptions where team_id = ?", Integer.class, team)).isEqualTo(7);

		mockMvc.perform(refund(owner, paymentId(extension))).andExpect(status().isOk());
		assertThat(jdbc.queryForMap("select seats, current_period_end from subscriptions where team_id = ?", team))
				.containsEntry("seats", 1)
				.hasEntrySatisfying("current_period_end", end ->
						assertThat(((Timestamp) end).toInstant()).isEqualTo(Instant.parse("2026-12-05T14:30:00Z")));
		assertThat(issues.flexActive(team, NOW)).isTrue();
	}

	@Test
	void tossRefusalKeepsThePaymentAndALostAnswerIsRecordedOnRetry() throws Exception {
		User developer = user("refund-fail", UserType.DEVELOPER);
		pay(developer, "PRO", "MONTHLY", null, 2_900);
		String extension = pay(developer, "PRO", "MONTHLY", null, 2_900);
		long id = paymentId(extension);

		GATEWAY.nextCancel.set(command -> {
			throw new PaymentGatewayException(400, "NOT_CANCELABLE_PAYMENT", "취소할 수 없는 결제", "{}");
		});
		mockMvc.perform(refund(developer, id))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("REFUND_REJECTED"))
				.andExpect(jsonPath("$.detail.providerCode").value("NOT_CANCELABLE_PAYMENT"));
		GATEWAY.nextCancel.set(command -> {
			throw new ResourceAccessException("read timed out");
		});
		mockMvc.perform(refund(developer, id))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.code").value("PAYMENT_GATEWAY_ERROR"));
		GATEWAY.nextCancel.set(command -> new PaymentCancelResult(command.paymentKey(), null, "PARTIAL_CANCELED",
				2_900, 100, null, Map.of()));
		mockMvc.perform(refund(developer, id)).andExpect(status().isBadGateway());
		assertThat(paymentStatus(extension)).isEqualTo("DONE");
		assertThat(periodEnd(developer)).isEqualTo(Instant.parse("2027-01-05T14:30:00Z"));

		// The earlier cancel reached Toss after all: Toss now answers "already canceled".
		GATEWAY.nextCancel.set(command -> {
			throw new PaymentGatewayException(400, "ALREADY_CANCELED_PAYMENT", "이미 취소된 결제", "{}");
		});
		mockMvc.perform(refund(developer, id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELED"))
				.andExpect(jsonPath("$.canceledAt").value("2026-11-05T14:30:00Z"));
		assertThat(periodEnd(developer)).isEqualTo(Instant.parse("2026-12-05T14:30:00Z"));
		assertThat(GATEWAY.cancels).extracting(PaymentCancelCommand::idempotencyKey).containsOnly("cancel:" + extension);
	}

	@Test
	void concurrentRefundsTakeThePeriodBackOnce() throws Exception {
		User developer = user("refund-race", UserType.DEVELOPER);
		pay(developer, "PRO", "MONTHLY", null, 2_900);
		long id = paymentId(pay(developer, "PRO", "MONTHLY", null, 2_900));
		List<Callable<Integer>> calls = new ArrayList<>();
		CountDownLatch start = new CountDownLatch(1);
		for (int i = 0; i < 3; i++) {
			calls.add(() -> {
				start.await();
				return mockMvc.perform(refund(developer, id)).andReturn().getResponse().getStatus();
			});
		}
		ExecutorService pool = Executors.newFixedThreadPool(calls.size());
		try {
			List<Future<Integer>> futures = new ArrayList<>();
			for (Callable<Integer> call : calls) {
				futures.add(pool.submit(call));
			}
			start.countDown();
			for (Future<Integer> future : futures) {
				assertThat(future.get(30, TimeUnit.SECONDS)).isEqualTo(200);
			}
		}
		finally {
			pool.shutdownNow();
		}
		assertThat(periodEnd(developer)).isEqualTo(Instant.parse("2026-12-05T14:30:00Z"));
		assertThat(liveRows(developer)).isEqualTo(1);
	}

	@Test
	void expiryEndsLapsedRowsAndRecordsTheFlexGrace() throws Exception {
		User pro = user("expire-pro", UserType.DEVELOPER);
		pay(pro, "PRO", "MONTHLY", null, 2_900);
		User running = user("expire-running", UserType.DEVELOPER);
		pay(running, "PRO", "MONTHLY", null, 2_900);
		User owner = user("expire-flex", UserType.DEVELOPER);
		long team = TeamTestFixtures.team(jdbc, owner.getId(), "Expire Team", "ACTIVE");
		member(team, owner, "OWNER", false);
		pay(owner, "FLEX", "MONTHLY", team, 7_900);

		Instant ended = NOW.minusSeconds(3_600);
		jdbc.update("""
				update subscriptions set current_period_start = ?, current_period_end = ?
				where user_id = ? or team_id = ?
				""", Timestamp.from(ended.minusSeconds(86_400 * 30L)), Timestamp.from(ended), pro.getId(), team);

		assertThat(subscriptionService.expireLapsed()).isGreaterThanOrEqualTo(2);
		assertThat(jdbc.queryForMap("select status, grace_ends_at from subscriptions where user_id = ?", pro.getId()))
				.containsEntry("status", "EXPIRED").containsEntry("grace_ends_at", null);
		Map<String, Object> flex = jdbc.queryForMap("select status, grace_ends_at from subscriptions where team_id = ?", team);
		assertThat(flex).containsEntry("status", "EXPIRED");
		assertThat(((Timestamp) flex.get("grace_ends_at")).toInstant()).isEqualTo(ended.plusSeconds(86_400 * 30L));
		assertThat(jdbc.queryForObject("select status from subscriptions where user_id = ?", String.class, running.getId()))
				.isEqualTo("ACTIVE");
		assertThat(subscriptionService.expireLapsed()).isZero();

		mockMvc.perform(get("/api/v1/user/me/subscriptions").cookie(cookie(pro)))
				.andExpect(jsonPath("$.items", hasSize(0)));
		mockMvc.perform(get("/api/v1/user/recruit-editor/options").cookie(cookie(pro)))
				.andExpect(jsonPath("$.openLimit").value(3));
		// Expired rows stay as history; paying again starts a new live row.
		pay(pro, "PRO", "MONTHLY", null, 2_900);
		assertThat(jdbc.queryForObject("select count(*) from subscriptions where user_id = ?", Integer.class, pro.getId()))
				.isEqualTo(2);
		assertThat(liveRows(pro)).isEqualTo(1);
	}

	@Test
	void openApiDocumentsPageTwentyNineRoutes() throws Exception {
		String refund = "$.paths['/api/v1/user/me/payments/{paymentId}/refund'].post";
		String cancel = "$.paths['/api/v1/user/me/subscriptions/{subscriptionId}/cancel'].post";
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/user/me/subscriptions'].get.operationId").value("listMySubscriptions"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/subscriptions'].get.tags[0]").value("p29-subscription-manage"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/payments'].get.operationId").value("listMyPayments"))
				.andExpect(jsonPath(cancel + ".operationId").value("cancelSubscription"))
				.andExpect(jsonPath(cancel + ".responses['409']").exists())
				.andExpect(jsonPath(refund + ".operationId").value("refundPayment"))
				.andExpect(jsonPath(refund + ".responses['409']").exists())
				.andExpect(jsonPath(refund + ".responses['502']").exists());
	}

	// ---------------------------------------------------------------- helpers

	private String pay(User user, String plan, String billing, Long teamId, long amount) throws Exception {
		String orderId = order(user, plan, billing, teamId);
		mockMvc.perform(confirm(user, orderId, "pay_" + orderId, amount)).andExpect(status().isOk());
		return orderId;
	}

	private long paymentId(String orderId) {
		return jdbc.queryForObject("select id from payments where order_id = ?", Long.class, orderId);
	}

	private long subscriptionId(User user) {
		return jdbc.queryForObject("select id from subscriptions where user_id = ? and status = 'ACTIVE'", Long.class,
				user.getId());
	}

	private Instant periodEnd(User user) {
		return jdbc.queryForObject("select current_period_end from subscriptions where user_id = ? and status = 'ACTIVE'",
				Timestamp.class, user.getId()).toInstant();
	}

	private org.springframework.test.web.servlet.RequestBuilder cancelSubscription(User user, long subscriptionId) {
		return post("/api/v1/user/me/subscriptions/" + subscriptionId + "/cancel").cookie(cookie(user));
	}

	private org.springframework.test.web.servlet.RequestBuilder refund(User user, long paymentId) {
		return post("/api/v1/user/me/payments/" + paymentId + "/refund").cookie(cookie(user));
	}

	private String order(User user, String plan, String billing, Long teamId) throws Exception {
		return body(mockMvc.perform(checkout(user, plan, billing, teamId)).andExpect(status().isOk()).andReturn())
				.get("orderId").asString();
	}

	private org.springframework.test.web.servlet.RequestBuilder checkout(User user, String plan, String billing, Long teamId) {
		String team = teamId == null ? "null" : teamId.toString();
		return post("/api/v1/user/payments/checkout").cookie(cookie(user))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"planKey\":\"" + plan + "\",\"billing\":\"" + billing + "\",\"teamId\":" + team + "}");
	}

	private org.springframework.test.web.servlet.RequestBuilder confirm(User user, String orderId, String paymentKey, long amount) {
		return post("/api/v1/user/payments/confirm").cookie(cookie(user))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"orderId\":\"" + orderId + "\",\"paymentKey\":\"" + paymentKey + "\",\"amount\":" + amount + "}");
	}

	private JsonNode body(MvcResult result) throws Exception {
		return json.readTree(result.getResponse().getContentAsString());
	}

	private String paymentStatus(String orderId) {
		return jdbc.queryForObject("select status from payments where order_id = ?", String.class, orderId);
	}

	private int liveRows(User user) {
		return jdbc.queryForObject(
				"select count(*) from subscriptions where user_id = ? and status in ('TRIALING','ACTIVE','PAST_DUE')",
				Integer.class, user.getId());
	}

	private void member(long teamId, User user, String role, boolean left) {
		jdbc.update("""
				insert into team_members(team_id,user_id,role,github_org_state,joined_at,left_at,leave_type,created_at,updated_at)
				values (?,?,?,'MEMBER',now(),?,?,now(),now())
				""", teamId, user.getId(), role, left ? Timestamp.from(NOW) : null, left ? "LEFT" : null);
	}

	private User user(String prefix, UserType type) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), type));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	static final class FakeGateway implements PaymentGateway {

		final AtomicReference<Function<PaymentConfirmCommand, PaymentConfirmResult>> next = new AtomicReference<>();
		final List<PaymentConfirmCommand> calls = new CopyOnWriteArrayList<>();
		final AtomicReference<Function<PaymentCancelCommand, PaymentCancelResult>> nextCancel = new AtomicReference<>();
		final List<PaymentCancelCommand> cancels = new CopyOnWriteArrayList<>();
		/** paymentKey → approved amount, so a full cancel answers the paid amount like Toss. */
		final Map<String, Long> approved = new ConcurrentHashMap<>();

		void reset() {
			next.set(FakeGateway::approve);
			calls.clear();
			nextCancel.set(this::refund);
			cancels.clear();
		}

		PaymentCancelResult refund(PaymentCancelCommand command) {
			long amount = approved.getOrDefault(command.paymentKey(), 0L);
			return new PaymentCancelResult(command.paymentKey(), null, "CANCELED", amount, amount,
					"2026-11-06T00:00:00+09:00", Map.of("status", "CANCELED", "paymentKey", command.paymentKey()));
		}

		static PaymentConfirmResult approve(PaymentConfirmCommand command) {
			return new PaymentConfirmResult(command.paymentKey(), command.orderId(), command.amount(), "DONE", "카드",
					"2026-11-05T23:30:00+09:00", Map.of("status", "DONE", "orderId", command.orderId()));
		}

		@Override
		public PaymentConfirmResult confirm(PaymentConfirmCommand command) {
			calls.add(command);
			PaymentConfirmResult result = next.get().apply(command);
			approved.put(command.paymentKey(), command.amount());
			return result;
		}

		@Override
		public PaymentCancelResult cancel(PaymentCancelCommand command) {
			cancels.add(command);
			return nextCancel.get().apply(command);
		}
	}
}
