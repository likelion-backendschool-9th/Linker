package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record PaymentResultResponse(
		@Schema(requiredMode = REQUIRED, example = "PRO") String planKey,
		@Schema(requiredMode = REQUIRED, example = "ACTIVE") String status,
		@Schema(requiredMode = REQUIRED, description = "Last Seoul date the benefits apply (period end, exclusive instant)") LocalDate expiresOn,
		@Schema(requiredMode = REQUIRED, example = "2900") int amount,
		@Schema(requiredMode = REQUIRED, description = "Unlocked benefits") List<String> benefits
) {
}
