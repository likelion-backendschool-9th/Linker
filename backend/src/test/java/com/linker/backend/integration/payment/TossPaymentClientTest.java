package com.linker.backend.integration.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import tools.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class TossPaymentClientTest {

	private static final String SECRET = "test_sk_linker";
	private static final String AUTH = "Basic " + Base64.getEncoder()
			.encodeToString((SECRET + ":").getBytes(StandardCharsets.UTF_8));

	private MockRestServiceServer server;
	private TossPaymentClient client;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		client = new TossPaymentClient(
				"https://api.tosspayments.com",
				SECRET,
				builder,
				new ObjectMapper()
		);
	}

	@Test
	void confirmPostsAmountAndReturnsPayment() {
		server.expect(requestTo("https://api.tosspayments.com/v1/payments/confirm"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", AUTH))
				.andExpect(header("Idempotency-Key", "confirm:order_1"))
				.andExpect(jsonPath("$.amount").value(2_900))
				.andRespond(withSuccess("""
						{
						  "paymentKey": "pay_1",
						  "orderId": "order_1",
						  "totalAmount": 2900,
						  "status": "DONE",
						  "method": "카드",
						  "approvedAt": "2026-11-03T12:00:00+09:00",
						  "virtualAccount": null,
						  "cancels": null,
						  "failure": null
						}
						""", MediaType.APPLICATION_JSON));

		PaymentConfirmResult result = client.confirm(new PaymentConfirmCommand("pay_1", "order_1", 2_900, "confirm:order_1"));

		assertThat(result.paymentKey()).isEqualTo("pay_1");
		assertThat(result.orderId()).isEqualTo("order_1");
		assertThat(result.totalAmount()).isEqualTo(2_900);
		assertThat(result.status()).isEqualTo("DONE");
		assertThat(result.method()).isEqualTo("카드");
		assertThat(result.rawResponse()).containsEntry("status", "DONE").containsEntry("virtualAccount", null);
		server.verify();
	}

	@Test
	void cancelPostsReasonAndReadsCancelAmount() {
		server.expect(requestTo("https://api.tosspayments.com/v1/payments/pay_1/cancel"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", AUTH))
				.andExpect(header("Idempotency-Key", "cancel:order_1"))
				.andRespond(withSuccess("""
						{
						  "paymentKey": "pay_1",
						  "orderId": "order_1",
						  "totalAmount": 2900,
						  "status": "CANCELED",
						  "virtualAccount": null,
						  "failure": null,
						  "cancels": [
						    {
						      "cancelAmount": 2900,
						      "canceledAt": "2026-11-03T13:00:00+09:00",
						      "cancelReason": "7일 이내 미사용 환불"
						    }
						  ]
						}
						""", MediaType.APPLICATION_JSON));

		PaymentCancelResult result = client.cancel(new PaymentCancelCommand("pay_1", "7일 이내 미사용 환불", null, "cancel:order_1"));

		assertThat(result.status()).isEqualTo("CANCELED");
		assertThat(result.cancelAmount()).isEqualTo(2_900);
		assertThat(result.canceledAt()).isEqualTo("2026-11-03T13:00:00+09:00");
		server.verify();
	}

	@Test
	void confirmMapsTossErrorBody() {
		server.expect(requestTo("https://api.tosspayments.com/v1/payments/confirm"))
				.andRespond(withStatus(HttpStatus.BAD_REQUEST)
						.contentType(MediaType.APPLICATION_JSON)
						.body("""
								{"code":"NOT_FOUND_PAYMENT_SESSION","message":"결제 시간이 만료되어 결제 진행 데이터가 존재하지 않습니다."}
								"""));

		assertThatThrownBy(() -> client.confirm(new PaymentConfirmCommand("pay_x", "order_x", 100)))
				.isInstanceOf(PaymentGatewayException.class)
				.satisfies(error -> {
					PaymentGatewayException ex = (PaymentGatewayException) error;
					assertThat(ex.httpStatus()).isEqualTo(400);
					assertThat(ex.code()).isEqualTo("NOT_FOUND_PAYMENT_SESSION");
					assertThat(ex.getMessage()).contains("결제 시간");
				});
		server.verify();
	}
}
