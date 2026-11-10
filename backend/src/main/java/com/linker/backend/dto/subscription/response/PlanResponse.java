package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.NOT_REQUIRED;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.swagger.v3.oas.annotations.media.Schema;

public record PlanResponse(
		@Schema(requiredMode = REQUIRED, example = "PRO") String key,
		@Schema(requiredMode = REQUIRED, example = "Pro") String name,
		@Schema(requiredMode = REQUIRED, description = "KRW per month", example = "2900") int monthly,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "KRW per year; null when monthly only") Integer yearly,
		@Schema(requiredMode = REQUIRED) List<String> benefits,
		@Schema(requiredMode = REQUIRED, description = "Free trial is [Included] and not offered yet, so always false") boolean trialAvailable,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		@Schema(requiredMode = NOT_REQUIRED, description = "FLEX only: KRW per member from the 7th") Integer perExtraMember,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		@Schema(requiredMode = NOT_REQUIRED, description = "FLEX only: KRW per member from the 7th, per year") Integer perExtraMemberYearly
) {
}
