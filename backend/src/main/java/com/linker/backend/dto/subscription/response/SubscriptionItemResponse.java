package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

public record SubscriptionItemResponse(
		@Schema(requiredMode = REQUIRED) long subscriptionId,
		@Schema(requiredMode = REQUIRED, example = "PRO", description = "PRO, FLEX or SCOUT") String planKey,
		@Schema(requiredMode = REQUIRED, example = "ACTIVE") String status,
		@Schema(requiredMode = REQUIRED, example = "MONTHLY") String billing,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX only") Long teamId,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX only") String teamName,
		@Schema(requiredMode = REQUIRED, description = "Seoul date of the paid period end; benefits stop then") LocalDate expiresOn,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Auto-renewal is [Included]: always null until a billing key exists") LocalDate nextBillingOn,
		@Schema(requiredMode = REQUIRED, description = "Canceled: benefits continue until expiresOn") boolean cancelAtPeriodEnd,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX: headcount the current period was paid for") Integer seats,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX: current headcount, used by the next payment") Integer nextSeats,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX: next payment amount for nextSeats (KRW)") Integer nextAmount,
		@Schema(requiredMode = REQUIRED, example = "2900", description = "Price of the current period (KRW): Pro by billing cycle, Flex for the paid seats, Scout monthly") int amount,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "FLEX: name of the member who pays (billing manager); null for Pro/Scout or a withdrawn payer") String payerName
) {
}
