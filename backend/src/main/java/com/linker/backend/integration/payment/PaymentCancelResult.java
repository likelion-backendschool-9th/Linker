package com.linker.backend.integration.payment;

import java.util.Map;

public record PaymentCancelResult(
		String paymentKey,
		String orderId,
		String status,
		long totalAmount,
		long cancelAmount,
		String canceledAt,
		Map<String, Object> rawResponse
) {
}
