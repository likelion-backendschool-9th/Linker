package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record PlansResponse(
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Entry reason echoed from ?reason= (for example photo-limit)") String reason,
		@Schema(requiredMode = REQUIRED, description = "Developers: FREE, PRO, FLEX. Recruiters: empty until Scout ([Included]) opens") List<PlanResponse> plans,
		@Schema(requiredMode = REQUIRED, description = "Caller's own plan: FREE, PRO or SCOUT (team Flex is per team)", example = "FREE") String currentPlan
) {
}
