package com.linker.backend.dto.subscription.request;

import io.swagger.v3.oas.annotations.media.Schema;

/** Toss success-return query values. The server re-checks every one before calling the confirm API. */
public record ConfirmPaymentRequest(
		@Schema(example = "lnk_3f2b0c7e9d5a4c1b8e6f2a9d7c4b1e0f") String orderId,
		@Schema(description = "Toss paymentKey from the success return") String paymentKey,
		@Schema(description = "Amount in the return URL; must equal the server order amount", example = "2900") Long amount
) {
}
