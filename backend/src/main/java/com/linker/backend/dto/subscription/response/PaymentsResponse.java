package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record PaymentsResponse(
		@Schema(requiredMode = REQUIRED) List<PaymentItemResponse> items,
		@Schema(requiredMode = REQUIRED, nullable = true) String nextCursor
) {
}
