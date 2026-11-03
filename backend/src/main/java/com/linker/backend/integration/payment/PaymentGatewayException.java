package com.linker.backend.integration.payment;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import tools.jackson.databind.ObjectMapper;

/**
 * Toss (or other gateway) HTTP/business failure. PaymentService maps this to API errors later.
 */
public class PaymentGatewayException extends RuntimeException {

	private final int httpStatus;
	private final String code;
	private final String rawBody;

	public PaymentGatewayException(int httpStatus, String code, String message, String rawBody) {
		super(message);
		this.httpStatus = httpStatus;
		this.code = code;
		this.rawBody = rawBody;
	}

	public int httpStatus() {
		return httpStatus;
	}

	public String code() {
		return code;
	}

	public String rawBody() {
		return rawBody;
	}

	@SuppressWarnings("unchecked")
	static PaymentGatewayException fromResponse(int httpStatus, byte[] body, ObjectMapper mapper) {
		String raw = body == null || body.length == 0 ? "" : new String(body, StandardCharsets.UTF_8);
		String code = "PAYMENT_GATEWAY_ERROR";
		String message = "결제 처리에 실패했어요";
		if (!raw.isBlank()) {
			try {
				Map<String, Object> parsed = mapper.readValue(raw, Map.class);
				Object c = parsed.get("code");
				Object m = parsed.get("message");
				if (c != null) {
					code = c.toString();
				}
				if (m != null) {
					message = m.toString();
				}
			}
			catch (Exception ignored) {
				// keep defaults; raw body is still attached
			}
		}
		return new PaymentGatewayException(httpStatus, code, message, raw);
	}
}
