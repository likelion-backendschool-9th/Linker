package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record TeamCandidateResponse(
		@Schema(requiredMode = REQUIRED) long teamId,
		@Schema(requiredMode = REQUIRED) String name,
		@Schema(requiredMode = REQUIRED, description = "Current members; the amount uses this headcount") int memberCount,
		@Schema(requiredMode = REQUIRED, description = "KRW 7,900 up to 6 members, +1,900 per member from the 7th", example = "9800") int amount,
		@Schema(requiredMode = REQUIRED, description = "FREE or FLEX", example = "FREE") String currentPlan
) {
}
