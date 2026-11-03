package com.linker.backend.integration.payment;

/**
 * @param cancelAmount null means full cancel (Toss default).
 */
public record PaymentCancelCommand(
		String paymentKey,
		String cancelReason,
		Long cancelAmount
) {
}
