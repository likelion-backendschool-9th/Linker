package com.linker.backend.integration.payment;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class UnconfiguredPaymentGatewayTest {

	private final PaymentGateway gateway = new UnconfiguredPaymentGateway();

	@Test
	void confirmFailsClosed() {
		assertThatThrownBy(() -> gateway.confirm(new PaymentConfirmCommand("p", "o", 1)))
				.isInstanceOf(ApiException.class)
				.extracting(ex -> ((ApiException) ex).getCode())
				.isEqualTo("PAYMENT_UNAVAILABLE");
	}

	@Test
	void cancelFailsClosed() {
		assertThatThrownBy(() -> gateway.cancel(new PaymentCancelCommand("p", "reason", null)))
				.isInstanceOf(ApiException.class)
				.extracting(ex -> ((ApiException) ex).getCode())
				.isEqualTo("PAYMENT_UNAVAILABLE");
	}
}
