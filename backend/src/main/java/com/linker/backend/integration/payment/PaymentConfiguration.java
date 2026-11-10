package com.linker.backend.integration.payment;

import java.net.http.HttpClient;
import java.time.Duration;

import com.linker.backend.global.config.LinkerProperties;

import tools.jackson.databind.ObjectMapper;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
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
		// Toss suggests a long read timeout for confirm; a timeout leaves the order retryable, not failed.
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
				HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
		factory.setReadTimeout(Duration.ofSeconds(60));
		return new TossPaymentClient(payment.baseUrl(), secret, RestClient.builder().requestFactory(factory), objectMapper);
	}
}
