package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.service.AuthService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Chat REST error contract: OpenAPI lists each route's error statuses with {@code ApiErrorBody}, and the
 * codes match the foundation contract §3 (LOGIN_REQUIRED, SUSPENDED, VALIDATION_ERROR).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatErrorContractIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static final String ERROR_BODY = "#/components/schemas/ApiErrorBody";
	private static final Set<String> CHAT_TAGS = Set.of("p16-chat-list", "p17-chat-room");

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		registry.add("linker.storage.mode", () -> "local");
		registry.add("linker.github.webhook-secret", () -> "test-webhook-secret");
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;

	@Test
	void everyChatRouteDocumentsItsErrorsWithTheSharedBodyAndKeepsItsSuccessStatus() throws Exception {
		JsonNode paths = JSON.readTree(mockMvc.perform(get("/v3/api-docs"))
				.andReturn().getResponse().getContentAsString()).path("paths");
		List<String> checked = new ArrayList<>();
		for (Map.Entry<String, JsonNode> path : paths.properties()) {
			for (Map.Entry<String, JsonNode> method : path.getValue().properties()) {
				JsonNode operation = method.getValue();
				if (!CHAT_TAGS.contains(operation.path("tags").path(0).asString(""))) {
					continue;
				}
				JsonNode responses = operation.path("responses");
				String name = method.getKey() + " " + path.getKey() + " " + responses.propertyNames();
				assertThat(responses.has("401")).as(name).isTrue();
				assertThat(responses.has("200") || responses.has("204")).as(name).isTrue();
				assertThat(responses.has("200") && responses.has("204")).as(name).isFalse();
				for (Map.Entry<String, JsonNode> response : responses.properties()) {
					if (response.getKey().startsWith("4")) {
						List<String> refs = new ArrayList<>();
						for (JsonNode media : response.getValue().path("content")) {
							refs.add(media.path("schema").path("$ref").asString(""));
						}
						assertThat(refs).as(name + " " + response.getKey()).isNotEmpty().containsOnly(ERROR_BODY);
					}
				}
				checked.add(name);
			}
		}
		assertThat(checked).hasSize(16);
		JsonNode direct = paths.path("/api/v1/user/chat-rooms/direct").path("post");
		assertThat(direct.path("operationId").asString()).isEqualTo("startDirectChat");
		assertThat(direct.path("responses").path("403").path("description").asString()).contains("DEVELOPER_ONLY", "SUSPENDED");
	}

	@Test
	void nonNumericIdsAreValidationErrorsNotServerErrors() throws Exception {
		User me = user("contract-ids");
		mockMvc.perform(get("/api/v1/user/chat-rooms/abc").cookie(cookie(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(get("/api/v1/user/chat-rooms/1/messages").param("before", "x").cookie(cookie(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void anAccountSuspendedAfterItsTokenWasIssuedGetsTheSuspendedCode() throws Exception {
		User me = user("contract-suspended");
		User other = user("contract-other");
		Cookie stale = cookie(me);
		me.suspendUntil(Instant.now().plusSeconds(3600));
		users.saveAndFlush(me);

		mockMvc.perform(post("/api/v1/user/chat-rooms/direct")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":" + other.getId() + ",\"message\":\"안녕하세요\"}")
						.cookie(stale))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SUSPENDED"));
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
