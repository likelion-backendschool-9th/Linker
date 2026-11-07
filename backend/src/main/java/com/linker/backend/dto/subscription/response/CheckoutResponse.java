package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** Values for the Toss payment widget. The amount comes from the server, never from the client. */
public record CheckoutResponse(
		@Schema(requiredMode = REQUIRED) String orderId,
		@Schema(requiredMode = REQUIRED, example = "2900") int amount,
		@Schema(requiredMode = REQUIRED, example = "Pro 월간 구독") String orderName,
		@Schema(requiredMode = REQUIRED, description = "Stable, non-guessable Toss customerKey for this account") String customerKey,
		@Schema(requiredMode = REQUIRED, example = "PRO") String planKey,
		@Schema(requiredMode = REQUIRED, example = "MONTHLY") String billing,
		@Schema(requiredMode = REQUIRED, nullable = true) Long teamId
) {
}
