package com.linker.backend.integration.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import com.linker.backend.global.config.OllamaProperties;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The adapter's wire contract with Ollama {@code /api/chat}, against a stub server. */
class OllamaLlmClientTest {

	private static final JsonMapper JSON = JsonMapper.builder().build();
	private HttpServer server;

	@AfterEach
	void stop() {
		if (server != null) {
			server.stop(0);
		}
	}

	@Test
	void streamsTheReplyWithThinkingOffAnOutputCapAndTheSchema() throws IOException {
		AtomicReference<String> sent = new AtomicReference<>();
		String base = serve(sent, 200, """
				{"message":{"role":"assistant","content":"{\\"one"},"done":false}
				{"message":{"role":"assistant","content":"Line\\":\\"요약\\"}"},"done":false}
				{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":1258,"prompt_eval_duration":64000000000,"eval_count":2,"eval_duration":450000000}
				""");
		List<Integer> heard = new ArrayList<>();

		LlmResult result = client(base).chat(request(Instant.now().plusSeconds(30)), heard::add);

		assertThat(result.content()).isEqualTo("{\"oneLine\":\"요약\"}");
		assertThat(result.promptTokens()).isEqualTo(1258);
		assertThat(result.promptNanos()).isEqualTo(64_000_000_000L);
		assertThat(result.outputTokens()).isEqualTo(2);
		assertThat(result.doneReason()).isEqualTo("stop");
		assertThat(heard).containsExactly(1, 2);
		JsonNode body = JSON.readTree(sent.get());
		assertThat(body.path("model").asString()).isEqualTo("qwen3:4b");
		assertThat(body.path("stream").asBoolean()).isTrue();
		assertThat(body.path("think").asBoolean()).isFalse();
		assertThat(body.path("format").path("type").asString()).isEqualTo("object");
		assertThat(body.path("options").path("num_predict").asInt()).isEqualTo(512);
		assertThat(body.path("options").path("num_thread").asInt()).isEqualTo(2);
		assertThat(body.path("options").path("num_ctx").asInt()).isEqualTo(4096);
		assertThat(body.path("messages").get(0).path("role").asString()).isEqualTo("system");
	}

	@Test
	void anErrorStatusOrAReplyCutShortIsAFailureNotAnUnreachableModel() throws IOException {
		String broken = serve(new AtomicReference<>(), 500, "{\"error\":\"model not found\"}");
		assertThatThrownBy(() -> client(broken).chat(request(Instant.now().plusSeconds(30)), LlmProgressListener.NONE))
				.isInstanceOfSatisfying(LlmException.class, error -> assertThat(error.unreachable()).isFalse());
		stop();

		String cut = serve(new AtomicReference<>(), 200, """
				{"message":{"role":"assistant","content":"{"},"done":false}
				""");
		assertThatThrownBy(() -> client(cut).chat(request(Instant.now().plusSeconds(30)), LlmProgressListener.NONE))
				.isInstanceOfSatisfying(LlmException.class, error -> assertThat(error.unreachable()).isFalse());
	}

	@Test
	void aPassedDeadlineStopsReading() throws IOException {
		String base = serve(new AtomicReference<>(), 200, """
				{"message":{"role":"assistant","content":"{"},"done":false}
				{"message":{"role":"assistant","content":"}"},"done":false}
				""");
		assertThatThrownBy(() -> client(base).chat(request(Instant.now().minusSeconds(1)), LlmProgressListener.NONE))
				.isInstanceOfSatisfying(LlmException.class, error -> assertThat(error.getMessage()).contains("deadline"));
	}

	@Test
	void noServerOrNoConfigurationIsUnreachable() throws IOException {
		int closedPort;
		try (ServerSocket socket = new ServerSocket(0)) {
			closedPort = socket.getLocalPort();
		}
		assertThatThrownBy(() -> client("http://127.0.0.1:" + closedPort)
				.chat(request(Instant.now().plusSeconds(30)), LlmProgressListener.NONE))
				.isInstanceOfSatisfying(LlmException.class, error -> assertThat(error.unreachable()).isTrue());
		assertThatThrownBy(() -> client("").chat(request(Instant.now().plusSeconds(30)), LlmProgressListener.NONE))
				.isInstanceOfSatisfying(LlmException.class, error -> assertThat(error.unreachable()).isTrue());
	}

	private String serve(AtomicReference<String> sent, int status, String body) throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/api/chat", exchange -> {
			sent.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/x-ndjson");
			exchange.sendResponseHeaders(status, bytes.length);
			try (OutputStream out = exchange.getResponseBody()) {
				out.write(bytes);
			}
		});
		server.start();
		return "http://127.0.0.1:" + server.getAddress().getPort();
	}

	private static OllamaLlmClient client(String base) {
		return new OllamaLlmClient(new OllamaProperties(base, "qwen3:4b", Duration.ofSeconds(2), Duration.ofSeconds(5), 2, 4096));
	}

	private static LlmRequest request(Instant deadline) {
		return new LlmRequest("system", "user", Map.of("type", "object"), 512, deadline);
	}
}
