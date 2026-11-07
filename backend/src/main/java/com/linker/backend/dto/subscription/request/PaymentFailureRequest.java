package com.linker.backend.dto.subscription.request;

import io.swagger.v3.oas.annotations.media.Schema;

/** Toss fail-return {@code code} (for example PAY_PROCESS_CANCELED). */
public record PaymentFailureRequest(
		@Schema(example = "PAY_PROCESS_CANCELED", nullable = true) String code
) {
}
