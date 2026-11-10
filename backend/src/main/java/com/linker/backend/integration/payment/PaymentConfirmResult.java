package com.linker.backend.integration.payment;

import java.util.Map;

public record PaymentConfirmResult(
		String paymentKey,
		String orderId,
		long totalAmount,
		String status,
		String method,
		String approvedAt,
		Map<String, Object> rawResponse
) {
}
