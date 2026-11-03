package com.linker.backend.integration.payment;

import com.linker.backend.global.config.LinkerProperties;

import tools.jackson.databind.ObjectMapper;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class PaymentConfiguration {

	@Bean
	PaymentGateway paymentGateway(LinkerProperties properties, ObjectMapper objectMapper) {
		LinkerProperties.Payment payment = properties.payment();
		String secret = payment == null ? null : payment.secretKey();
		if (secret == null || secret.isBlank()) {
			return new UnconfiguredPaymentGateway();
		}
		// Boot 4.1 does not auto-register RestClient.Builder; build locally like the unit tests.
		return new TossPaymentClient(payment.baseUrl(), secret, RestClient.builder(), objectMapper);
	}
}
