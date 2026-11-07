package com.linker.backend.integration.payment;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import tools.jackson.databind.ObjectMapper;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/**
 * Toss Payments test/live HTTP client. Secret key stays server-side only (Basic {@code secretKey:}).
 * Fields read here (paymentKey, orderId, totalAmount, status, method, approvedAt, cancels) are the same in
 * API version 2024-06-01, which is the version set for the merchant in the developer center.
 */
public class TossPaymentClient implements PaymentGateway {

	private static final ParameterizedTypeReference<Map<String, Object>> MAP =
			new ParameterizedTypeReference<>() {
			};

	private final RestClient client;
	private final ObjectMapper objectMapper;

	public TossPaymentClient(String baseUrl, String secretKey, RestClient.Builder builder, ObjectMapper objectMapper) {
		String credentials = Base64.getEncoder()
				.encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
		this.client = builder
				.baseUrl(trimTrailingSlash(baseUrl))
				.defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
				.defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
				.build();
		this.objectMapper = objectMapper;
	}

	@Override
	public PaymentConfirmResult confirm(PaymentConfirmCommand command) {
		Map<String, Object> body = Map.of(
				"paymentKey", command.paymentKey(),
				"orderId", command.orderId(),
				"amount", command.amount()
		);
		Map<String, Object> response = post("/v1/payments/confirm", body, command.idempotencyKey());
		return new PaymentConfirmResult(
				stringValue(response.get("paymentKey")),
				stringValue(response.get("orderId")),
				longValue(response.get("totalAmount")),
				stringValue(response.get("status")),
				stringValue(response.get("method")),
				stringValue(response.get("approvedAt")),
				Map.copyOf(response)
		);
	}

	@Override
	public PaymentCancelResult cancel(PaymentCancelCommand command) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("cancelReason", command.cancelReason());
		if (command.cancelAmount() != null) {
			body.put("cancelAmount", command.cancelAmount());
		}
		Map<String, Object> response = post("/v1/payments/" + command.paymentKey() + "/cancel", body, null);
		long cancelAmount = resolveCancelAmount(response, command.cancelAmount());
		return new PaymentCancelResult(
				stringValue(response.get("paymentKey")),
				stringValue(response.get("orderId")),
				stringValue(response.get("status")),
				longValue(response.get("totalAmount")),
				cancelAmount,
				latestCanceledAt(response),
				Map.copyOf(response)
		);
	}

	private Map<String, Object> post(String path, Map<String, Object> body, String idempotencyKey) {
		return client.post()
				.uri(path)
				.headers(headers -> {
					if (idempotencyKey != null) {
						headers.set("Idempotency-Key", idempotencyKey);
					}
				})
				.body(body)
				.retrieve()
				.onStatus(status -> status.value() >= 400, (request, response) -> {
					byte[] bytes = response.getBody().readAllBytes();
					throw PaymentGatewayException.fromResponse(response.getStatusCode().value(), bytes, objectMapper);
				})
				.body(MAP);
	}

	@SuppressWarnings("unchecked")
	private static String latestCanceledAt(Map<String, Object> response) {
		Object cancels = response.get("cancels");
		if (!(cancels instanceof List<?> list) || list.isEmpty()) {
			return null;
		}
		Object last = list.get(list.size() - 1);
		if (last instanceof Map<?, ?> cancel) {
			Object canceledAt = cancel.get("canceledAt");
			return canceledAt == null ? null : canceledAt.toString();
		}
		return null;
	}

	@SuppressWarnings("unchecked")
	private static long resolveCancelAmount(Map<String, Object> response, Long requested) {
		if (requested != null) {
			return requested;
		}
		Object cancels = response.get("cancels");
		if (cancels instanceof List<?> list && !list.isEmpty()) {
			Object last = list.get(list.size() - 1);
			if (last instanceof Map<?, ?> cancel) {
				return longValue(cancel.get("cancelAmount"));
			}
		}
		return longValue(response.get("totalAmount"));
	}

	private static String stringValue(Object value) {
		return value == null ? null : value.toString();
	}

	private static long longValue(Object value) {
		if (value instanceof Number number) {
			return number.longValue();
		}
		if (value == null) {
			return 0L;
		}
		return Long.parseLong(value.toString());
	}

	private static String trimTrailingSlash(String baseUrl) {
		if (baseUrl == null || baseUrl.isBlank()) {
			return "https://api.tosspayments.com";
		}
		return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
	}
}
