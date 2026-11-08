package com.linker.backend.service.user;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import com.linker.backend.dto.subscription.response.PaymentItemResponse;
import com.linker.backend.dto.subscription.response.PaymentResultResponse;
import com.linker.backend.dto.subscription.response.PaymentsResponse;
import com.linker.backend.dto.subscription.response.PlanResponse;
import com.linker.backend.dto.subscription.response.PlansResponse;
import com.linker.backend.dto.subscription.response.SubscriptionItemResponse;
import com.linker.backend.dto.subscription.response.SubscriptionsResponse;
import com.linker.backend.dto.subscription.response.TeamCandidateResponse;
import com.linker.backend.dto.subscription.response.TeamCandidatesResponse;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.subscription.Payment;
import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.BillingCycle;
import com.linker.backend.entity.subscription.type.PaymentStatus;
import com.linker.backend.entity.subscription.type.SubscriptionPlan;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;
import com.linker.backend.entity.team.Team;
import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.payment.PaymentCancelCommand;
import com.linker.backend.integration.payment.PaymentCancelResult;
import com.linker.backend.integration.payment.PaymentConfirmCommand;
import com.linker.backend.integration.payment.PaymentConfirmResult;
import com.linker.backend.integration.payment.PaymentGateway;
import com.linker.backend.integration.payment.PaymentGatewayException;
import com.linker.backend.integration.payment.UnconfiguredPaymentGateway;
import com.linker.backend.repository.subscription.PaymentRepository;
import com.linker.backend.repository.subscription.SubscriptionRepository;
import com.linker.backend.repository.subscription.SubscriptionRepositoryCustom.FlexTeam;
import com.linker.backend.repository.team.TeamRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;

import tools.jackson.databind.ObjectMapper;

/**
 * Pages 28 (plans, Toss test checkout) and 29 (subscriptions, history, cancel, refund, expiry) of WBS S15.
 * First stage is one-time payment + period end: trial, billing key, auto-renewal, payment-failure grace,
 * billing-owner handover and Scout are [Included] and not offered.
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
	private static final String REFUND_REASON = "7일 이내 혜택 시작 전 환불";
	private static final List<PaymentStatus> HISTORY_STATUSES =
			List.of(PaymentStatus.DONE, PaymentStatus.CANCELED, PaymentStatus.PARTIAL_CANCELED);
	private static final int HISTORY_PAGE_SIZE = 20;
	private static final int EXPIRY_BATCH = 200;
	private static final Set<String> RETRYABLE_CODES = Set.of(
			"IDEMPOTENT_REQUEST_PROCESSING", "ALREADY_PROCESSED_PAYMENT", "UNAUTHORIZED_KEY",
			"PROVIDER_ERROR", "FAILED_INTERNAL_SYSTEM_PROCESSING", "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING");

	private static final List<String> FREE_BENEFITS = List.of(
			"팔로우·좋아요·댓글", "작업물 올리기", "팀·이슈·캘린더·상태 보드");
	/** Figma 28 (288:471, 293:218) benefit copy; the 28 screen sets a few words in Medium. */
	private static final List<String> PRO_BENEFITS = List.of(
			"채용 담당자 프로필 조회 알림", "게시물 통계 확장 : 유입 경로, README 확장", "피드 저장소 사진 10장으로 확장",
			"대표 작업물 고정 5개로 확장", "팀 모집글 최대 10개로 확장");
	private static final List<String> FLEX_BENEFITS = List.of(
			"팀 인원 무제한", "팀 채팅 검색 및 스크롤 백 무제한", "팀 채팅 이미지 보관", "AI 채팅 요약 하루 인당 10회",
			"진행 현황 그래프");
	private static final List<String> SCOUT_BENEFITS = List.of("피드 채용 광고 1건", "채용 제안 일 10회에서 일 50회");

	private final SubscriptionRepository subscriptions;
	private final PaymentRepository payments;
	private final TeamRepository teams;
	private final PaymentGateway gateway;
	private final Clock clock;
	private final ObjectMapper objectMapper;
	private final TransactionTemplate write;
	private final byte[] customerKeySecret;

	public SubscriptionService(
			SubscriptionRepository subscriptions,
			PaymentRepository payments,
			TeamRepository teams,
			PaymentGateway gateway,
			Clock clock,
			ObjectMapper objectMapper,
			PlatformTransactionManager transactions,
			LinkerProperties properties) {
		this.subscriptions = subscriptions;
		this.payments = payments;
		this.teams = teams;
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

	// ---------------------------------------------------------------- page 29: manage

	@Transactional(readOnly = true)
	public SubscriptionsResponse mySubscriptions(AuthenticatedUser user) {
		Instant now = clock.instant();
		List<Subscription> rows = subscriptions.findCurrentFor(user.userId(), SubscriptionStatus.LIVE, now);
		if (rows.isEmpty()) {
			return new SubscriptionsResponse(List.of());
		}
		List<Long> teamIds = rows.stream().map(Subscription::getTeamId).filter(Objects::nonNull).toList();
		Map<Long, String> names = teamIds.isEmpty() ? Map.of() : teams.findAllById(teamIds).stream()
				.collect(Collectors.toMap(Team::getId, Team::getName));
		Map<Long, FlexTeam> payable = teamIds.isEmpty() ? Map.of() : subscriptions.flexTeams(user.userId(), null).stream()
				.collect(Collectors.toMap(FlexTeam::teamId, Function.identity()));
		// Own Pro/Scout rows have no team id; immutable maps reject get(null).
		return new SubscriptionsResponse(rows.stream()
				.map(row -> row.getTeamId() == null
						? item(row, null, null)
						: item(row, names.get(row.getTeamId()), payable.get(row.getTeamId())))
				.toList());
	}

	/** Cancel keeps benefits until the paid period ends (Policy ch. 11); there is no pro-rated refund. */
	@Transactional
	public SubscriptionItemResponse cancel(AuthenticatedUser user, long subscriptionId) {
		Instant now = clock.instant();
		Subscription subscription = subscriptions.lockById(subscriptionId)
				.filter(row -> manages(user.userId(), row))
				.orElseThrow(SubscriptionService::subscriptionNotFound);
		if (!current(subscription, now)) {
			throw new ApiException(409, "SUBSCRIPTION_ENDED", "이미 끝난 구독이에요.");
		}
		subscription.cancelAtPeriodEnd(now);
		FlexTeam team = subscription.getTeamId() == null ? null
				: flexTeam(user.userId(), subscription.getTeamId()).orElse(null);
		String teamName = subscription.getTeamId() == null ? null
				: teams.findById(subscription.getTeamId()).map(Team::getName).orElse(null);
		return item(subscription, teamName, team);
	}

	@Transactional(readOnly = true)
	public PaymentsResponse myPayments(AuthenticatedUser user, String cursor) {
		Long before = null;
		if (cursor != null && !cursor.isBlank()) {
			try {
				before = Long.parseLong(cursor.trim());
			}
			catch (NumberFormatException invalid) {
				throw new ApiException(400, "VALIDATION_ERROR", "커서를 확인해 주세요");
			}
		}
		List<Payment> rows = payments.findHistory(user.userId(), HISTORY_STATUSES, before,
				PageRequest.of(0, HISTORY_PAGE_SIZE + 1));
		boolean more = rows.size() > HISTORY_PAGE_SIZE;
		List<Payment> page = more ? rows.subList(0, HISTORY_PAGE_SIZE) : rows;
		Instant now = clock.instant();
		Map<Long, Optional<Subscription>> owners = new HashMap<>();
		List<PaymentItemResponse> items = page.stream().map(payment -> {
			if (payment.getStatus() != PaymentStatus.DONE) {
				return paymentItem(payment, null);
			}
			ApiException why = withinRefundWindow(payment, now)
					? refusal(payment, owners.computeIfAbsent(payment.getSubscriptionId(), subscriptions::findById)
							.orElse(null), now)
					: refundPeriodOver();
			return paymentItem(payment, why == null ? null : why.getMessage(), why == null);
		}).toList();
		return new PaymentsResponse(items, more ? Long.toString(page.getLast().getId()) : null);
	}

	/**
	 * Full refund within 7 days of payment while its period has not started yet (Policy ch. 11 "benefits
	 * unused"; decided 2026-11-07: only a paid period that has not begun counts as unused). Same three steps
	 * as confirm: check under a row lock, call the Toss cancel API outside any transaction with one
	 * idempotency key per order, then take the period back under the subscription locks.
	 */
	public PaymentItemResponse refund(AuthenticatedUser user, long paymentId) {
		if (gateway instanceof UnconfiguredPaymentGateway) {
			throw new ApiException(503, "PAYMENT_UNAVAILABLE", "결제 연동이 설정되지 않았어요");
		}
		RefundClaim claim = write.execute(status -> {
			Payment payment = ownPayment(user.userId(), paymentId);
			if (payment.getStatus() == PaymentStatus.CANCELED) {
				return new RefundClaim(null, null, 0, paymentItem(payment, null));
			}
			if (payment.getStatus() != PaymentStatus.DONE) {
				throw notRefundable();
			}
			Instant now = clock.instant();
			if (!withinRefundWindow(payment, now)) {
				throw refundPeriodOver();
			}
			ApiException refusal = refusal(payment, subscriptions.findById(payment.getSubscriptionId()).orElse(null), now);
			if (refusal != null) {
				throw refusal;
			}
			return new RefundClaim(payment.getPaymentKey(), payment.getOrderId(), payment.getAmount(), null);
		});
		if (claim.done() != null) {
			return claim.done();
		}

		PaymentCancelResult result;
		try {
			result = gateway.cancel(new PaymentCancelCommand(claim.paymentKey(), REFUND_REASON, null,
					"cancel:" + claim.orderId()));
		}
		catch (PaymentGatewayException failure) {
			if (!"ALREADY_CANCELED_PAYMENT".equals(failure.code())) {
				throw refundFailed(claim.orderId(), failure);
			}
			// Toss already returned the money (an earlier attempt whose answer was lost): record it now.
			log.warn("Toss says order {} is already canceled; recording the refund", claim.orderId());
			result = null;
		}
		catch (RestClientException unreachable) {
			log.warn("Toss cancel did not answer for order {}; payment stays DONE for retry", claim.orderId(), unreachable);
			throw refundUnknown();
		}
		if (result != null && !("CANCELED".equals(result.status()) && result.cancelAmount() == claim.amount())) {
			log.error("Toss cancel for order {} answered status={} cancelAmount={}; refund not recorded",
					claim.orderId(), result.status(), result.cancelAmount());
			throw refundUnknown();
		}
		PaymentCancelResult refunded = result;
		return write.execute(status -> revoke(user.userId(), paymentId, refunded));
	}

	private PaymentItemResponse revoke(long userId, long paymentId, PaymentCancelResult result) {
		Payment payment = ownPayment(userId, paymentId);
		if (payment.getStatus() == PaymentStatus.CANCELED) {
			return paymentItem(payment, null); // a concurrent refund of the same payment finished first
		}
		Instant now = clock.instant();
		boolean team = payment.getPlan() == SubscriptionPlan.FLEX;
		subscriptions.lockTarget((team ? "team:" : "user:") + (team ? payment.getTeamId() : payment.getPayerUserId()));
		Subscription subscription = subscriptions.lockById(payment.getSubscriptionId()).orElseThrow();
		List<Payment> paid = payments.findPaidNewestFirst(subscription.getId(), PaymentStatus.DONE, PageRequest.of(0, 2));
		if (!paid.isEmpty() && paid.getFirst().getId().equals(payment.getId())) {
			// This payment paid the current period, which starts where the previous one ends.
			Instant end = subscription.getCurrentPeriodStart();
			if (paid.size() > 1 && end.isAfter(now)) {
				Payment previous = paid.get(1);
				subscription.revokePeriod(previous.getBillingCycle(), previous.getSeats(),
						periodStart(end, previous.getBillingCycle()), end);
			}
			else {
				subscription.endNow(now);
			}
		}
		else {
			// Another payment extended the row while Toss was refunding this one: drop one period from the end.
			log.warn("Payment {} was refunded after a later payment on subscription {}", paymentId, subscription.getId());
			Instant end = periodStart(subscription.getCurrentPeriodEnd(), payment.getBillingCycle());
			if (end.isAfter(now)) {
				Instant start = subscription.getCurrentPeriodStart().isBefore(end)
						? subscription.getCurrentPeriodStart() : periodStart(end, subscription.getBillingCycle());
				subscription.revokePeriod(subscription.getBillingCycle(), null, start, end);
			}
			else {
				subscription.endNow(now);
			}
		}
		Instant canceledAt = result == null ? now : approvedAt(result.canceledAt(), now);
		payment.refund(canceledAt, REFUND_REASON, result == null ? null : json(result.rawResponse()));
		return paymentItem(payment, null);
	}

	/**
	 * Expiry job: live rows past their paid period go back to free. Existing content stays; free limits
	 * apply on the next write because every reader checks {@code current_period_end}. Flex records the
	 * 30-day grace end; its notices and the 60-day hide wait for full chat history ([Included] S-6).
	 */
	public int expireLapsed() {
		Instant now = clock.instant();
		int expired = 0;
		for (Long id : subscriptions.findLapsedIds(SubscriptionStatus.LIVE, now, PageRequest.of(0, EXPIRY_BATCH))) {
			Boolean done = write.execute(status -> {
				// Locked and re-read: a payment may have extended the row since the id was listed.
				Subscription row = subscriptions.lockById(id).orElse(null);
				if (row == null || !SubscriptionStatus.LIVE.contains(row.getStatus()) || row.getCurrentPeriodEnd().isAfter(now)
						|| (row.getGraceUntil() != null && row.getGraceUntil().isAfter(now))) {
					return false;
				}
				row.expire(row.getPlan() == SubscriptionPlan.FLEX
						? row.getCurrentPeriodEnd().plus(Duration.ofDays(PlanLimits.FLEX_POST_EXPIRY_GRACE_DAYS))
						: null);
				return true;
			});
			if (Boolean.TRUE.equals(done)) {
				expired++;
			}
		}
		return expired;
	}

	/** Why a DONE, in-window payment cannot be refunded, or null when it can. */
	private ApiException refusal(Payment payment, Subscription subscription, Instant now) {
		if (subscription == null || !current(subscription, now)) {
			return benefitsUsed();
		}
		List<Payment> paid = payments.findPaidNewestFirst(subscription.getId(), PaymentStatus.DONE, PageRequest.of(0, 1));
		if (paid.isEmpty() || !paid.getFirst().getId().equals(payment.getId())) {
			return new ApiException(409, "REFUND_NOT_LATEST", "가장 최근 결제부터 환불할 수 있어요.");
		}
		return subscription.getCurrentPeriodStart().isAfter(now) ? null : benefitsUsed();
	}

	private static boolean withinRefundWindow(Payment payment, Instant now) {
		return payment.getApprovedAt() != null
				&& payment.getApprovedAt().plus(Duration.ofDays(PlanLimits.PAYMENT_REFUND_WITHIN_DAYS)).isAfter(now);
	}

	private static boolean manages(long userId, Subscription subscription) {
		return subscription.getTeamId() == null
				? subscription.getUserId() != null && subscription.getUserId() == userId
				: subscription.getPayerUserId() == userId;
	}

	private Payment ownPayment(long userId, long paymentId) {
		return payments.lockById(paymentId)
				.filter(payment -> payment.getPayerUserId() == userId)
				.orElseThrow(() -> new ApiException(404, "PAYMENT_NOT_FOUND", "결제 내역을 찾지 못했어요."));
	}

	private ApiException refundFailed(String orderId, PaymentGatewayException failure) {
		if ("IDEMPOTENT_REQUEST_PROCESSING".equals(failure.code())) {
			return new ApiException(409, "PAYMENT_PROCESSING", "환불을 처리하고 있어요. 잠시 후 다시 확인해 주세요.");
		}
		if (failure.httpStatus() >= 500 || RETRYABLE_CODES.contains(failure.code())) {
			log.warn("Toss cancel for order {} failed with {} {}; payment stays DONE",
					orderId, failure.httpStatus(), failure.code());
			return refundUnknown();
		}
		log.warn("Toss refused to cancel order {}: {}", orderId, failure.code());
		return new ApiException(400, "REFUND_REJECTED", "환불하지 못했어요. 잠시 후 다시 시도해 주세요.",
				Map.of("providerCode", safeCode(failure.code())));
	}

	private static SubscriptionItemResponse item(Subscription subscription, String teamName, FlexTeam payable) {
		boolean flex = subscription.getPlan() == SubscriptionPlan.FLEX;
		Integer nextSeats = flex && payable != null ? seats(payable) : null;
		return new SubscriptionItemResponse(subscription.getId(), subscription.getPlan().name(),
				subscription.getStatus().name(), subscription.getBillingCycle().name(), subscription.getTeamId(),
				teamName, subscription.getCurrentPeriodEnd().atZone(PlanLimits.APP_ZONE).toLocalDate(), null,
				subscription.isCancelAtPeriodEnd(), subscription.getSeats(), nextSeats,
				nextSeats == null ? null : PlanLimits.flexMonthlyAmount(nextSeats));
	}

	/** A payment that is not refundable now and needs no reason (already refunded or just refunded). */
	private static PaymentItemResponse paymentItem(Payment payment, String refundReason) {
		return paymentItem(payment, refundReason, false);
	}

	private static PaymentItemResponse paymentItem(Payment payment, String refundReason, boolean refundable) {
		return new PaymentItemResponse(payment.getId(), payment.getOrderName(), payment.getPlan().name(),
				payment.getBillingCycle().name(), payment.getTeamId(), payment.getAmount(), payment.getStatus().name(),
				payment.getMethod(), payment.getApprovedAt(), payment.getCanceledAt(), payment.getRefundedAmount(),
				refundable, refundReason);
	}

	/** Start of the period of {@code cycle} that ends at {@code end} (Seoul calendar). */
	private static Instant periodStart(Instant end, BillingCycle cycle) {
		ZonedDateTime seoul = end.atZone(PlanLimits.APP_ZONE);
		return (cycle == BillingCycle.YEARLY ? seoul.minusYears(1) : seoul.minusMonths(1)).toInstant();
	}

	private static ApiException subscriptionNotFound() {
		return new ApiException(404, "SUBSCRIPTION_NOT_FOUND", "구독을 찾지 못했어요.");
	}

	private static ApiException refundPeriodOver() {
		return new ApiException(409, "REFUND_PERIOD_OVER", "결제 후 7일이 지나 환불할 수 없어요.");
	}

	private static ApiException notRefundable() {
		return new ApiException(409, "NOT_REFUNDABLE", "환불할 수 없는 결제예요.");
	}

	private static ApiException benefitsUsed() {
		return new ApiException(409, "REFUND_BENEFITS_USED",
				"이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요.");
	}

	private static ApiException refundUnknown() {
		return new ApiException(502, "PAYMENT_GATEWAY_ERROR", "환불 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
	}

	private record RefundClaim(String paymentKey, String orderId, int amount, PaymentItemResponse done) {
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
