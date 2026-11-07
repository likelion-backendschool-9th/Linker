package com.linker.backend.integration.payment;

/**
 * @param idempotencyKey sent as Toss {@code Idempotency-Key} (valid 15 days, max 300 chars); a retry with
 *                       the same key returns the first result instead of approving twice. Null sends none.
 */
public record PaymentConfirmCommand(
		String paymentKey,
		String orderId,
		long amount,
		String idempotencyKey
) {

	public PaymentConfirmCommand(String paymentKey, String orderId, long amount) {
		this(paymentKey, orderId, amount, null);
	}
}
