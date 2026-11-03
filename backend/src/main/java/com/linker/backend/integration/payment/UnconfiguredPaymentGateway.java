package com.linker.backend.integration.payment;

import com.linker.backend.global.error.ApiException;

/**
 * Active when {@code linker.payment.secret-key} is empty. Page 28/29 must not treat this as success.
 */
public final class UnconfiguredPaymentGateway implements PaymentGateway {

	@Override
	public PaymentConfirmResult confirm(PaymentConfirmCommand command) {
		throw unavailable();
	}

	@Override
	public PaymentCancelResult cancel(PaymentCancelCommand command) {
		throw unavailable();
	}

	private static ApiException unavailable() {
		return new ApiException(503, "PAYMENT_UNAVAILABLE", "결제 연동이 설정되지 않았어요");
	}
}
