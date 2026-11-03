package com.linker.backend.integration.payment;

public record PaymentConfirmCommand(
		String paymentKey,
		String orderId,
		long amount
) {
}
