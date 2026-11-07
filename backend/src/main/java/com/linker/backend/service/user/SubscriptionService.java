package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.dto.subscription.request.CheckoutRequest;
import com.linker.backend.dto.subscription.request.ConfirmPaymentRequest;
import com.linker.backend.dto.subscription.request.PaymentFailureRequest;
import com.linker.backend.dto.subscription.response.CheckoutResponse;
import com.linker.backend.dto.subscription.response.PaymentResultResponse;
import com.linker.backend.dto.subscription.response.PlanResponse;
import com.linker.backend.dto.subscription.response.PlansResponse;
import com.linker.backend.dto.subscription.response.TeamCandidateResponse;
import com.linker.backend.dto.subscription.response.TeamCandidatesResponse;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.subscription.Payment;
import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.BillingCycle;
import com.linker.backend.entity.subscription.type.PaymentStatus;
import com.linker.backend.entity.subscription.type.SubscriptionPlan;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;
import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.payment.PaymentConfirmCommand;
import com.linker.backend.integration.payment.PaymentConfirmResult;
import com.linker.backend.integration.payment.PaymentGateway;
import com.linker.backend.integration.payment.PaymentGatewayException;
import com.linker.backend.integration.payment.UnconfiguredPaymentGateway;
import com.linker.backend.repository.subscription.PaymentRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.subscription.SubscriptionRepositoryCustom.FlexTeam;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;

import tools.jackson.databind.ObjectMapper;

/**
 * Page 28 plans and Toss test checkout (WBS S15). First stage is one-time payment + period end:
 * trial, billing key, auto-renewal and Scout are [Included] and not offered.
 *
 * <p>The browser success return is never trusted. Confirm runs in three steps so no DB transaction stays
 * open across the Toss call: (1) lock the order, re-check owner, amount and team, and bind the paymentKey;
 * (2) call the Toss confirm API with an idempotency key per order; (3) lock the order again and only then
 * activate or extend the subscription. A replay of a DONE order returns the stored result.
 */
@Service("userSubscriptionService")
public class SubscriptionService {

	private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

	private static final Pattern REASON = Pattern.compile("[a-z0-9-]{1,40}");
	private static final Pattern ORDER_ID = Pattern.compile("[A-Za-z0-9_-]{6,64}");
	private static final Pattern FAILURE_CODE = Pattern.compile("[A-Z0-9_]{1,64}");
	private static final int PAYMENT_KEY_MAX = 200;
	private static final int ORDER_NAME_MAX = 100;
	/** Toss outcomes that do not prove the payment was refused: keep the order READY so a retry can finish. */
	private static final Set<String> RETRYABLE_CODES = Set.of(
			"IDEMPOTENT_REQUEST_PROCESSING", "ALREADY_PROCESSED_PAYMENT", "UNAUTHORIZED_KEY",
			"PROVIDER_ERROR", "FAILED_INTERNAL_SYSTEM_PROCESSING", "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING");

	private static final List<String> FREE_BENEFITS = List.of(
			"팔로우·좋아요·댓글", "작업물 올리기", "팀·이슈·캘린더·상태 보드");
	private static final List<String> PRO_BENEFITS = List.of(
			"채용 담당자 프로필 열람 알림", "게시물 유입 경로 통계", "사진 10장", "대표 게시물 5개", "모집 글 동시 10개");
	private static final List<String> FLEX_BENEFITS = List.of(
			"팀원 수 제한 없음", "채팅 전체 기간 검색", "AI 채팅 요약", "진행 현황 그래프");
	private static final List<String> SCOUT_BENEFITS = List.of("채용 제안 하루 50건", "피드 채용 광고 1개");

	private final SubscriptionRepository subscriptions;
	private final PaymentRepository payments;
	private final PaymentGateway gateway;
	private final Clock clock;
	private final ObjectMapper objectMapper;
	private final TransactionTemplate write;
	private final byte[] customerKeySecret;

	public SubscriptionService(
			SubscriptionRepository subscriptions,
			PaymentRepository payments,
			PaymentGateway gateway,
			Clock clock,
			ObjectMapper objectMapper,
			PlatformTransactionManager transactions,
			LinkerProperties properties) {
		this.subscriptions = subscriptions;
		this.payments = payments;
		this.gateway = gateway;
		this.clock = clock;
		this.objectMapper = objectMapper;
		this.write = new TransactionTemplate(transactions);
		String secret = properties.payment() == null ? null : properties.payment().secretKey();
		this.customerKeySecret = ("linker-customer:" + (secret == null ? "" : secret)).getBytes(StandardCharsets.UTF_8);
	}

	// ---------------------------------------------------------------- plans

	@Transactional(readOnly = true)
	public PlansResponse plans(AuthenticatedUser user, String reason) {
		String entry = reason != null && REASON.matcher(reason).matches() ? reason : null;
		Instant now = clock.instant();
		String current = subscriptions.findFirstByUserIdAndStatusIn(user.userId(), SubscriptionStatus.LIVE)
				.filter(subscription -> current(subscription, now))
				.map(subscription -> subscription.getPlan().name())
				.orElse("FREE");
		if (user.userType() != UserType.DEVELOPER) {
			// Scout and the recruiter checkout are [Included]; nothing is for sale to recruiters yet.
			return new PlansResponse(entry, List.of(), current);
		}
		return new PlansResponse(entry, List.of(
				new PlanResponse("FREE", "무료", 0, 0, FREE_BENEFITS, false, null),
				new PlanResponse("PRO", "Pro", PlanLimits.PRO_MONTHLY_KRW, PlanLimits.PRO_YEARLY_KRW,
						PRO_BENEFITS, false, null),
				new PlanResponse("FLEX", "Flex", PlanLimits.FLEX_BASE_MONTHLY_KRW, null,
						FLEX_BENEFITS, false, PlanLimits.FLEX_EXTRA_SEAT_KRW)), current);
	}

	@Transactional(readOnly = true)
	public TeamCandidatesResponse teamCandidates(AuthenticatedUser user) {
		List<FlexTeam> teams = subscriptions.flexTeams(user.userId(), null);
		if (teams.isEmpty()) {
			return new TeamCandidatesResponse(List.of());
		}
		Instant now = clock.instant();
		Map<Long, Subscription> live = subscriptions
				.findByTeamIdInAndStatusIn(teams.stream().map(FlexTeam::teamId).toList(), SubscriptionStatus.LIVE)
				.stream()
				.collect(Collectors.toMap(Subscription::getTeamId, Function.identity()));
		return new TeamCandidatesResponse(teams.stream().map(team -> {
			int seats = seats(team);
			Subscription flex = live.get(team.teamId());
			String plan = flex != null && current(flex, now) ? "FLEX" : "FREE";
			return new TeamCandidateResponse(team.teamId(), team.name(), seats, PlanLimits.flexMonthlyAmount(seats), plan);
		}).toList());
	}

	// ---------------------------------------------------------------- checkout

	@Transactional
	public CheckoutResponse checkout(AuthenticatedUser user, CheckoutRequest request) {
		if (gateway instanceof UnconfiguredPaymentGateway) {
			throw new ApiException(503, "PAYMENT_UNAVAILABLE", "결제 연동이 설정되지 않았어요");
		}
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요금제를 선택해 주세요.");
		}
		SubscriptionPlan plan = plan(request.planKey());
		requireAllowed(user, plan);
		BillingCycle cycle = cycle(request.billing());
		if (cycle == BillingCycle.YEARLY && plan != SubscriptionPlan.PRO) {
			throw new ApiException(400, "INVALID_BILLING", "이 요금제는 월간 결제만 가능해요.");
		}
		String orderId = "lnk_" + UUID.randomUUID().toString().replace("-", "");
		Payment order;
		if (plan == SubscriptionPlan.FLEX) {
			FlexTeam team = flexTeam(user.userId(), request.teamId())
					.orElseThrow(SubscriptionService::teamPermission);
			int seats = seats(team);
			order = Payment.order(user.userId(), plan, cycle, team.teamId(), seats, orderId,
					orderName("Flex · " + team.name() + " 구독"), PlanLimits.flexMonthlyAmount(seats));
		}
		else {
			int amount = cycle == BillingCycle.YEARLY ? PlanLimits.PRO_YEARLY_KRW : PlanLimits.PRO_MONTHLY_KRW;
			order = Payment.order(user.userId(), plan, cycle, null, null, orderId,
					cycle == BillingCycle.YEARLY ? "Pro 연간 구독" : "Pro 월간 구독", amount);
		}
		payments.save(order);
		return new CheckoutResponse(order.getOrderId(), order.getAmount(), order.getOrderName(),
				customerKey(user.userId()), plan.name(), cycle.name(), order.getTeamId());
	}

	// ---------------------------------------------------------------- confirm

	public PaymentResultResponse confirm(AuthenticatedUser user, ConfirmPaymentRequest request) {
		if (request == null || request.amount() == null || request.amount() <= 0
				|| request.orderId() == null || !ORDER_ID.matcher(request.orderId()).matches()
				|| request.paymentKey() == null || request.paymentKey().isBlank()
				|| request.paymentKey().length() > PAYMENT_KEY_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "결제 정보를 확인할 수 없어요.");
		}
		String orderId = request.orderId();
		String paymentKey = request.paymentKey();

		Claim claim = claim(user, orderId, paymentKey, request.amount());
		if (claim.done() != null) {
			return claim.done();
		}

		PaymentConfirmResult result;
		try {
			result = gateway.confirm(new PaymentConfirmCommand(paymentKey, orderId, claim.amount(), "confirm:" + orderId));
		}
		catch (PaymentGatewayException failure) {
			throw rejected(user, orderId, failure);
		}
		catch (RestClientException unreachable) {
			log.warn("Toss confirm did not answer for order {}; order stays READY for retry", orderId, unreachable);
			throw gatewayUnknown();
		}

		boolean matches = "DONE".equals(result.status()) && orderId.equals(result.orderId())
				&& paymentKey.equals(result.paymentKey()) && result.totalAmount() == claim.amount();
		if (!matches) {
			log.error("Toss confirm for order {} answered status={} orderId={} amount={}; benefits not applied",
					orderId, result.status(), result.orderId(), result.totalAmount());
			markFailed(user.userId(), orderId, "UNEXPECTED_" + safeCode(result.status()), json(result.rawResponse()));
			throw new ApiException(400, "PAYMENT_REJECTED", "결제를 승인하지 못했어요. 다시 결제해 주세요.");
		}
		return write.execute(status -> activate(user.userId(), orderId, result));
	}

	private Claim claim(AuthenticatedUser user, String orderId, String paymentKey, long amount) {
		try {
			return write.execute(status -> {
				Payment order = ownOrder(user.userId(), orderId);
				switch (order.getStatus()) {
					case DONE -> {
						if (!paymentKey.equals(order.getPaymentKey())) {
							throw new ApiException(409, "PAYMENT_CONFIRMED", "이미 승인된 결제예요.");
						}
						return new Claim(order.getAmount(), result(order));
					}
					case READY -> {
					}
					default -> throw orderFailed();
				}
				if (amount != order.getAmount()) {
					throw new ApiException(400, "AMOUNT_MISMATCH", "결제 금액이 달라요.");
				}
				if (order.getPaymentKey() != null && !order.getPaymentKey().equals(paymentKey)) {
					throw invalidPayment();
				}
				if (order.getPlan() == SubscriptionPlan.FLEX
						&& flexTeam(user.userId(), order.getTeamId()).isEmpty()) {
					// Nothing is captured before confirm, so a lost team permission just ends the order.
					order.fail("TEAM_PERMISSION", null);
					return new Claim(order.getAmount(), null, teamPermission());
				}
				if (order.getPaymentKey() == null) {
					order.claim(paymentKey);
					payments.flush();
				}
				return new Claim(order.getAmount(), null);
			}).orThrow();
		}
		catch (DataIntegrityViolationException duplicateKey) {
			// The same Toss paymentKey is already bound to another order.
			throw invalidPayment();
		}
	}

	private PaymentResultResponse activate(long userId, String orderId, PaymentConfirmResult result) {
		Payment order = ownOrder(userId, orderId);
		if (order.getStatus() == PaymentStatus.DONE) {
			return result(order); // a concurrent confirm of the same order finished first
		}
		if (order.getStatus() != PaymentStatus.READY) {
			// Unreachable while fail() refuses claimed orders; keep the Toss answer for support.
			log.error("Order {} was {} after Toss approved it", orderId, order.getStatus());
			throw orderFailed();
		}
		Instant now = clock.instant();
		boolean team = order.getPlan() == SubscriptionPlan.FLEX;
		long target = team ? order.getTeamId() : order.getPayerUserId();
		subscriptions.lockTarget((team ? "team:" : "user:") + target);
		Optional<Subscription> live = team
				? subscriptions.lockLiveForTeam(target, SubscriptionStatus.LIVE)
				: subscriptions.lockLiveForUser(target, SubscriptionStatus.LIVE);
		Instant start = live.map(Subscription::getCurrentPeriodEnd).filter(end -> end.isAfter(now)).orElse(now);
		Instant end = periodEnd(start, order.getBillingCycle());
		Subscription subscription;
		if (live.isPresent()) {
			subscription = live.get();
			subscription.extend(order.getBillingCycle(), order.getSeats(), start, end);
		}
		else {
			subscription = subscriptions.save(Subscription.paid(order.getPlan(),
					team ? null : order.getPayerUserId(), team ? order.getTeamId() : null,
					order.getPayerUserId(), order.getBillingCycle(), order.getSeats(), start, end));
		}
		order.approve(subscription.getId(), result.method(), approvedAt(result.approvedAt(), now),
				json(result.rawResponse()));
		return response(order.getPlan(), subscription.getCurrentPeriodEnd(), order.getAmount());
	}

	// ---------------------------------------------------------------- fail return

	@Transactional
	public void fail(AuthenticatedUser user, String orderId, PaymentFailureRequest request) {
		if (orderId == null || !ORDER_ID.matcher(orderId).matches()) {
			throw orderNotFound();
		}
		Payment order = ownOrder(user.userId(), orderId);
		switch (order.getStatus()) {
			case FAILED -> {
				return; // the fail page was reloaded; keep the first code
			}
			case READY -> {
			}
			default -> throw new ApiException(409, "PAYMENT_CONFIRMED", "이미 승인된 결제예요.");
		}
		if (order.getPaymentKey() != null) {
			// A confirm already bound a paymentKey and may have captured money; do not end the order here.
			throw new ApiException(409, "PAYMENT_PROCESSING", "결제를 확인하고 있어요. 잠시 후 다시 확인해 주세요.");
		}
		order.fail(request == null ? "UNKNOWN" : safeCode(request.code()), null);
	}

	// ---------------------------------------------------------------- helpers

	private ApiException rejected(AuthenticatedUser user, String orderId, PaymentGatewayException failure) {
		if ("IDEMPOTENT_REQUEST_PROCESSING".equals(failure.code())) {
			return new ApiException(409, "PAYMENT_PROCESSING", "결제를 확인하고 있어요. 잠시 후 다시 확인해 주세요.");
		}
		if (failure.httpStatus() >= 500 || RETRYABLE_CODES.contains(failure.code())) {
			log.warn("Toss confirm for order {} failed with {} {}; order stays READY",
					orderId, failure.httpStatus(), failure.code());
			return gatewayUnknown();
		}
		markFailed(user.userId(), orderId, safeCode(failure.code()), failure.rawBody().isBlank() ? null : failure.rawBody());
		return new ApiException(400, "PAYMENT_REJECTED", "결제를 승인하지 못했어요. 다시 결제해 주세요.",
				Map.of("providerCode", safeCode(failure.code())));
	}

	private void markFailed(long userId, String orderId, String code, String raw) {
		write.executeWithoutResult(status -> {
			Payment order = ownOrder(userId, orderId);
			if (order.getStatus() == PaymentStatus.READY) {
				order.fail(code, raw);
			}
		});
	}

	private Payment ownOrder(long userId, String orderId) {
		return payments.lockByOrderId(orderId)
				.filter(order -> order.getPayerUserId() == userId)
				.orElseThrow(SubscriptionService::orderNotFound);
	}

	private Optional<FlexTeam> flexTeam(long userId, Long teamId) {
		if (teamId == null) {
			return Optional.empty();
		}
		return subscriptions.flexTeams(userId, teamId).stream().findFirst();
	}

	private PaymentResultResponse result(Payment order) {
		Subscription subscription = subscriptions.findById(order.getSubscriptionId()).orElseThrow();
		return response(order.getPlan(), subscription.getCurrentPeriodEnd(), order.getAmount());
	}

	private static PaymentResultResponse response(SubscriptionPlan plan, Instant periodEnd, int amount) {
		LocalDate expiresOn = periodEnd.atZone(PlanLimits.APP_ZONE).toLocalDate();
		return new PaymentResultResponse(plan.name(), SubscriptionStatus.ACTIVE.name(), expiresOn, amount, benefits(plan));
	}

	private static List<String> benefits(SubscriptionPlan plan) {
		return switch (plan) {
			case PRO -> PRO_BENEFITS;
			case FLEX -> FLEX_BENEFITS;
			case SCOUT -> SCOUT_BENEFITS;
		};
	}

	/** "Is it on now" per ERD 4-9: a live status and the paid period still running. */
	private static boolean current(Subscription subscription, Instant now) {
		return SubscriptionStatus.LIVE.contains(subscription.getStatus()) && subscription.getCurrentPeriodEnd().isAfter(now);
	}

	private static Instant periodEnd(Instant start, BillingCycle cycle) {
		ZonedDateTime seoul = start.atZone(PlanLimits.APP_ZONE);
		return (cycle == BillingCycle.YEARLY ? seoul.plusYears(1) : seoul.plusMonths(1)).toInstant();
	}

	private static int seats(FlexTeam team) {
		return (int) Math.max(1, team.memberCount());
	}

	private static SubscriptionPlan plan(String value) {
		return Arrays.stream(SubscriptionPlan.values())
				.filter(plan -> plan.name().equals(value))
				.findFirst()
				.orElseThrow(() -> new ApiException(400, "VALIDATION_ERROR", "요금제를 선택해 주세요."));
	}

	private static void requireAllowed(AuthenticatedUser user, SubscriptionPlan plan) {
		boolean allowed = user.userType() == UserType.DEVELOPER
				&& (plan == SubscriptionPlan.PRO || plan == SubscriptionPlan.FLEX);
		if (!allowed) {
			throw new ApiException(403, "PLAN_MISMATCH", "선택할 수 없는 요금제예요.");
		}
	}

	private static BillingCycle cycle(String value) {
		return Arrays.stream(BillingCycle.values())
				.filter(cycle -> cycle.name().equals(value))
				.findFirst()
				.orElseThrow(() -> new ApiException(400, "INVALID_BILLING", "결제 기간을 확인해 주세요."));
	}

	private static String orderName(String name) {
		return name.length() <= ORDER_NAME_MAX ? name : name.substring(0, ORDER_NAME_MAX - 1) + "…";
	}

	/** Toss customerKey: stable per account and not guessable from the user id (HMAC with the server secret). */
	private String customerKey(long userId) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(customerKeySecret, "HmacSHA256"));
			byte[] digest = mac.doFinal(Long.toString(userId).getBytes(StandardCharsets.UTF_8));
			return "lnk_c_" + Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOf(digest, 18));
		}
		catch (GeneralSecurityException impossible) {
			throw new IllegalStateException("HmacSHA256 unavailable", impossible);
		}
	}

	private static Instant approvedAt(String value, Instant fallback) {
		if (value == null || value.isBlank()) {
			return fallback;
		}
		try {
			return OffsetDateTime.parse(value).toInstant();
		}
		catch (DateTimeParseException unparsable) {
			return fallback;
		}
	}

	private String json(Map<String, Object> raw) {
		return raw == null || raw.isEmpty() ? null : objectMapper.writeValueAsString(raw);
	}

	private static String safeCode(String code) {
		if (code == null) {
			return "UNKNOWN";
		}
		String trimmed = code.length() > 64 ? code.substring(0, 64) : code;
		return FAILURE_CODE.matcher(trimmed).matches() ? trimmed : "UNKNOWN";
	}

	private static ApiException orderNotFound() {
		return new ApiException(404, "ORDER_NOT_FOUND", "주문을 찾지 못했어요.");
	}

	private static ApiException orderFailed() {
		return new ApiException(409, "ORDER_FAILED", "완료되지 않은 주문이에요. 새로 결제해 주세요.");
	}

	private static ApiException invalidPayment() {
		return new ApiException(400, "INVALID_PAYMENT", "결제 정보를 확인할 수 없어요.");
	}

	private static ApiException teamPermission() {
		return new ApiException(403, "TEAM_PERMISSION", "결제할 팀을 다시 선택해 주세요.");
	}

	private static ApiException gatewayUnknown() {
		return new ApiException(502, "PAYMENT_GATEWAY_ERROR", "결제 승인을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
	}

	/**
	 * Step-1 outcome. {@code done} short-circuits a replay; {@code error} is thrown after the transaction
	 * commits so the FAILED mark for a lost team permission is kept.
	 */
	private record Claim(int amount, PaymentResultResponse done, ApiException error) {

		Claim(int amount, PaymentResultResponse done) {
			this(amount, done, null);
		}

		Claim orThrow() {
			if (error != null) {
				throw error;
			}
			return this;
		}
	}
}
