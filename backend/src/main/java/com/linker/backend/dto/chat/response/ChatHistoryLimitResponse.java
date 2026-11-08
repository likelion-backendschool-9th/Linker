package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Team history window actually applied. Flex is not a stored entitlement in this build.
 */
public record ChatHistoryLimitResponse(
		@Schema(requiredMode = REQUIRED, allowableValues = {"FREE_60_DAYS"}) String applied,
		@Schema(requiredMode = REQUIRED) boolean flexSupported
) {
}
