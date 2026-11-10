package com.linker.backend.integration.ai;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.ConnectException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.linker.backend.global.config.OllamaProperties;

import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ollama {@code /api/chat} with a streamed reply. Thinking is off, the reply follows the request's JSON
 * schema, and {@code num_predict} caps the output: without it a schema-bound reply can run until the
 * context fills. Empty {@code linker.ollama.base-url} fails every call as unreachable.
 */
@Component
public class OllamaLlmClient implements LlmClient {

	private final RestClient http;
	private final String model;
	private final boolean configured;
	private final int numThread;
	private final int numCtx;
	private final JsonMapper json = JsonMapper.builder().build();

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
		this.numThread = properties.numThread() == null || properties.numThread() < 1 ? 2 : properties.numThread();
		this.numCtx = properties.numCtx() == null || properties.numCtx() < 512 ? 4096 : properties.numCtx();
	}

	@Override
	public String modelName() {
		return model;
	}

	@Override
	public LlmResult chat(LlmRequest request, LlmProgressListener listener) {
		if (!configured) {
			throw new LlmException(true, "ollama base-url is not configured");
		}
		Map<String, Object> options = new LinkedHashMap<>();
		options.put("num_ctx", numCtx);
		options.put("num_predict", request.maxOutputTokens());
		// The container is CPU-capped; more threads than the cap only adds contention.
		options.put("num_thread", numThread);
		options.put("temperature", 0);
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("model", model);
		body.put("stream", true);
		body.put("think", false);
		body.put("format", request.schema());
		body.put("options", options);
		body.put("messages", List.of(
				Map.of("role", "system", "content", request.system()),
				Map.of("role", "user", "content", request.user())));
		try {
			return http.post()
					.uri("/api/chat")
					.contentType(MediaType.APPLICATION_JSON)
					.body(body)
					.exchange((clientRequest, response) -> {
						if (response.getStatusCode().isError()) {
							throw new LlmException(false, "ollama answered " + response.getStatusCode().value());
						}
						return read(response.getBody(), request.deadline(), listener);
					}, true);
		}
		catch (ResourceAccessException exception) {
			throw new LlmException(unreachable(exception), "ollama call failed", exception);
		}
		catch (RestClientException exception) {
			throw new LlmException(false, "ollama call failed", exception);
		}
	}

	private LlmResult read(InputStream stream, Instant deadline, LlmProgressListener listener) throws IOException {
		StringBuilder content = new StringBuilder();
		int tokens = 0;
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
			String line;
			while ((line = reader.readLine()) != null) {
				if (deadline != null && Instant.now().isAfter(deadline)) {
					// Closing the response (exchange close=true) also cancels the request in Ollama.
					throw new LlmException(false, "ollama reply passed the deadline");
				}
				if (line.isBlank()) {
					continue;
				}
				JsonNode chunk;
				try {
					chunk = json.readTree(line);
				}
				catch (JacksonException exception) {
					throw new LlmException(false, "ollama sent an unreadable chunk", exception);
				}
				if (chunk.hasNonNull("error")) {
					throw new LlmException(false, "ollama reported an error");
				}
				if (chunk.path("done").isBoolean() && chunk.path("done").asBoolean()) {
					return new LlmResult(
							content.toString().trim(),
							(int) number(chunk.path("prompt_eval_count")),
							number(chunk.path("prompt_eval_duration")),
							chunk.path("eval_count").isNumber() ? chunk.path("eval_count").asInt() : tokens,
							number(chunk.path("eval_duration")),
							chunk.path("done_reason").isString() ? chunk.path("done_reason").asString() : "");
				}
				JsonNode piece = chunk.path("message").path("content");
				if (piece.isString() && !piece.asString().isEmpty()) {
					content.append(piece.asString());
					tokens++;
					listener.outputTokens(tokens);
				}
			}
		}
		throw new LlmException(false, "ollama stream ended before done");
	}

	private static long number(JsonNode node) {
		return node != null && node.isNumber() ? node.asLong() : 0L;
	}

	private static boolean unreachable(ResourceAccessException exception) {
		for (Throwable cause = exception.getCause(); cause != null; cause = cause.getCause()) {
			if (cause instanceof ConnectException || cause instanceof UnknownHostException) {
				return true;
			}
		}
		return false;
	}

	private static String trimSlash(String value) {
		if (value.endsWith("/")) {
			return value.substring(0, value.length() - 1);
		}
		return value;
	}
}
