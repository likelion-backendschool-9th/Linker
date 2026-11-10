package com.linker.backend.integration.ai;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.linker.backend.global.config.OllamaProperties;
import com.linker.backend.global.error.ApiException;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Ollama {@code /api/chat}. Empty {@code linker.ollama.base-url} fails every call. */
@Component
public class OllamaLlmClient implements LlmClient {

	private static final ParameterizedTypeReference<Map<String, Object>> MAP =
			new ParameterizedTypeReference<>() {
			};

	private final RestClient http;
	private final String model;
	private final boolean configured;

	public OllamaLlmClient(OllamaProperties properties) {
		String base = properties.baseUrl() == null ? "" : properties.baseUrl().trim();
		this.configured = !base.isBlank();
		Duration connect = properties.connectTimeout() == null ? Duration.ofSeconds(5) : properties.connectTimeout();
		Duration read = properties.readTimeout() == null ? Duration.ofSeconds(120) : properties.readTimeout();
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(connect);
		factory.setReadTimeout(read);
		this.http = RestClient.builder()
				.requestFactory(factory)
				.baseUrl(configured ? trimSlash(base) : "http://127.0.0.1")
				.build();
		this.model = properties.model() == null || properties.model().isBlank() ? "qwen3:4b" : properties.model().trim();
	}

	@Override
	public String modelName() {
		return model;
	}

	@Override
	public String summarizeChat(String prompt) {
		if (!configured) {
			throw new ApiException(503, "FORBIDDEN", "요약을 만들지 못했어요");
		}
		try {
			Map<String, Object> body = Map.of(
					"model", model,
					"stream", false,
					"messages", List.of(
							Map.of("role", "system", "content",
									"당신은 팀 채팅 요약기입니다. 한국어로 짧게 한 덩어리의 요약만 쓰세요. 목록·JSON·제목은 쓰지 마세요."),
							Map.of("role", "user", "content", prompt)
					)
			);
			Map<String, Object> response = http.post()
					.uri("/api/chat")
					.contentType(MediaType.APPLICATION_JSON)
					.body(body)
					.retrieve()
					.body(MAP);
			if (response == null) {
				throw new ApiException(502, "FORBIDDEN", "요약을 만들지 못했어요");
			}
			Object message = response.get("message");
			if (message instanceof Map<?, ?> map) {
				Object content = map.get("content");
				if (content instanceof String text && !text.isBlank()) {
					return text.trim();
				}
			}
			throw new ApiException(502, "FORBIDDEN", "요약을 만들지 못했어요");
		}
		catch (RestClientException exception) {
			throw new ApiException(502, "FORBIDDEN", "요약을 만들지 못했어요");
		}
	}

	private static String trimSlash(String value) {
		if (value.endsWith("/")) {
			return value.substring(0, value.length() - 1);
		}
		return value;
	}
}
