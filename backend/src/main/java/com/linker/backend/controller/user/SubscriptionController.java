package com.linker.backend.controller.user;

import com.linker.backend.dto.subscription.request.CheckoutRequest;
import com.linker.backend.dto.subscription.request.ConfirmPaymentRequest;
import com.linker.backend.dto.subscription.request.PaymentFailureRequest;
import com.linker.backend.dto.subscription.response.CheckoutResponse;
import com.linker.backend.dto.subscription.response.PaymentResultResponse;
import com.linker.backend.dto.subscription.response.PlansResponse;
import com.linker.backend.dto.subscription.response.TeamCandidatesResponse;
import com.linker.backend.global.error.ApiErrorBody;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.service.user.SubscriptionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * SubscriptionController (WBS S15, page 28). Every response is personal: {@code Cache-Control: private,
 * no-store}. Every route also answers 401 {@code LOGIN_REQUIRED}, and writes answer 403 {@code SUSPENDED}
 * for a suspended account. Benefits apply only after the server Toss confirm call answers DONE.
 */
@RestController("userSubscriptionController")
@RequestMapping("/user")
public class SubscriptionController {

	private static final CacheControl PRIVATE_NO_STORE = CacheControl.noStore().cachePrivate();

	private final SubscriptionService subscriptions;

	public SubscriptionController(SubscriptionService subscriptions) {
		this.subscriptions = subscriptions;
	}

	@GetMapping("/plans")
	@Tag(name = "p28-subscribe")
	@Operation(operationId = "listPlans", summary = "Plans for the caller (developers: Free/Pro/Flex; recruiters: none until Scout)")
	@ApiResponse(responseCode = "200", description = "Plans, entry reason and the caller's own plan")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<PlansResponse> plans(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestParam(required = false) String reason) {
		return ResponseEntity.ok().cacheControl(PRIVATE_NO_STORE).body(subscriptions.plans(user, reason));
	}

	@DeveloperOnly
	@GetMapping("/plans/team-candidates")
	@Tag(name = "p28-subscribe")
	@Operation(operationId = "listFlexTeamCandidates", summary = "Teams the caller can pay Flex for (owner or billing owner)")
	@ApiResponse(responseCode = "200", description = "Teams with current headcount and Flex amount")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "DEVELOPER_ONLY", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<TeamCandidatesResponse> teamCandidates(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(PRIVATE_NO_STORE).body(subscriptions.teamCandidates(user));
	}

	@PostMapping("/payments/checkout")
	@Tag(name = "p28-subscribe")
	@Operation(operationId = "createCheckout", summary = "Create a server order with the server amount for the Toss widget")
	@ApiResponse(responseCode = "200", description = "READY order")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR (plan) · INVALID_BILLING", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "PLAN_MISMATCH (plan not for this member type) · TEAM_PERMISSION (not owner/billing owner) · SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "503", description = "PAYMENT_UNAVAILABLE (Toss keys not configured)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<CheckoutResponse> checkout(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody(required = false) CheckoutRequest request) {
		return ResponseEntity.ok().cacheControl(PRIVATE_NO_STORE).body(subscriptions.checkout(user, request));
	}

	@PostMapping("/payments/confirm")
	@Tag(name = "p28-subscribe")
	@Operation(operationId = "confirmPayment", summary = "Verify the Toss success return with the confirm API, then activate or extend the subscription. Replays return the stored result")
	@ApiResponse(responseCode = "200", description = "Subscription active")
	@ApiResponse(responseCode = "400", description = "VALIDATION_ERROR · AMOUNT_MISMATCH · INVALID_PAYMENT · PAYMENT_REJECTED (Toss refused; detail.providerCode)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "TEAM_PERMISSION (lost Flex team permission; order ends) · SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "ORDER_NOT_FOUND (missing or another account's order)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "ORDER_FAILED · PAYMENT_CONFIRMED (done with another paymentKey) · PAYMENT_PROCESSING (retry shortly)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "502", description = "PAYMENT_GATEWAY_ERROR (Toss result unknown; order stays retryable)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "503", description = "PAYMENT_UNAVAILABLE", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<PaymentResultResponse> confirm(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody(required = false) ConfirmPaymentRequest request) {
		return ResponseEntity.ok().cacheControl(PRIVATE_NO_STORE).body(subscriptions.confirm(user, request));
	}

	@PostMapping("/payments/{orderId}/fail")
	@Tag(name = "p28-subscribe")
	@Operation(operationId = "recordPaymentFailure", summary = "Record the Toss fail return for the caller's READY order")
	@ApiResponse(responseCode = "204", description = "Order marked FAILED (repeat calls keep the first code)")
	@ApiResponse(responseCode = "401", description = "LOGIN_REQUIRED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "403", description = "SUSPENDED", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "404", description = "ORDER_NOT_FOUND", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	@ApiResponse(responseCode = "409", description = "PAYMENT_CONFIRMED · PAYMENT_PROCESSING (a confirm is in flight)", content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
	public ResponseEntity<Void> fail(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String orderId,
			@RequestBody(required = false) PaymentFailureRequest request) {
		subscriptions.fail(user, orderId, request);
		return ResponseEntity.noContent().cacheControl(PRIVATE_NO_STORE).build();
	}
}
