package com.linker.backend.integration.payment;

/**
 * @param cancelAmount null means full cancel (Toss default).
 * @param idempotencyKey sent as Toss {@code Idempotency-Key}; one key per payment so a retry after an
 *        unknown outcome never cancels twice. Null sends none.
 */
public record PaymentCancelCommand(
		String paymentKey,
		String cancelReason,
		Long cancelAmount,
		String idempotencyKey
) {
}
