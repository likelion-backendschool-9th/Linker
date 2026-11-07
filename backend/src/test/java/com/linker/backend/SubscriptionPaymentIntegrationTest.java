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

/** Page 28: plans, Flex team candidates, server checkout, Toss confirm (fake gateway) and fail return. */
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
				.andExpect(jsonPath("$.benefits[2]").value("사진 10장"));
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
				.andExpect(jsonPath("$.benefits[0]").value("팀원 수 제한 없음"));
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

	// ---------------------------------------------------------------- helpers

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

		void reset() {
			next.set(FakeGateway::approve);
			calls.clear();
		}

		static PaymentConfirmResult approve(PaymentConfirmCommand command) {
			return new PaymentConfirmResult(command.paymentKey(), command.orderId(), command.amount(), "DONE", "카드",
					"2026-11-05T23:30:00+09:00", Map.of("status", "DONE", "orderId", command.orderId()));
		}

		@Override
		public PaymentConfirmResult confirm(PaymentConfirmCommand command) {
			calls.add(command);
			return next.get().apply(command);
		}

		@Override
		public PaymentCancelResult cancel(PaymentCancelCommand command) {
			throw new UnsupportedOperationException("refund is page 29");
		}
	}
}
