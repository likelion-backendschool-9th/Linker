package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

public record PaymentItemResponse(
		@Schema(requiredMode = REQUIRED) long paymentId,
		@Schema(requiredMode = REQUIRED, example = "Pro 월간 구독") String orderName,
		@Schema(requiredMode = REQUIRED, example = "PRO") String planKey,
		@Schema(requiredMode = REQUIRED, example = "MONTHLY") String billing,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX only") Long teamId,
		@Schema(requiredMode = REQUIRED, example = "2900") int amount,
		@Schema(requiredMode = REQUIRED, example = "DONE", description = "DONE, CANCELED or PARTIAL_CANCELED") String status,
		@Schema(requiredMode = REQUIRED, nullable = true, example = "카드") String method,
		@Schema(requiredMode = REQUIRED) Instant approvedAt,
		@Schema(requiredMode = REQUIRED, nullable = true) Instant canceledAt,
		@Schema(requiredMode = REQUIRED, example = "0") int refundedAmount,
		@Schema(requiredMode = REQUIRED, description = "Within 7 days of payment and its period has not started yet") boolean refundable,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Why a DONE payment cannot be refunded (UI copy); null otherwise") String refundReason
) {
}
