package com.linker.backend.dto.subscription.request;

import io.swagger.v3.oas.annotations.media.Schema;

public record CheckoutRequest(
		@Schema(description = "PRO or FLEX for developers (SCOUT is [Included] and not open yet)", example = "PRO") String planKey,
		@Schema(description = "MONTHLY or YEARLY. Only PRO allows YEARLY", example = "MONTHLY") String billing,
		@Schema(description = "Required for FLEX: a team where the caller is owner or billing owner", nullable = true) Long teamId
) {
}
