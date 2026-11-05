package com.linker.backend.integration.github;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;

import org.springframework.http.MediaType;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/** User-to-server token exchange. Installation tokens stay on {@link GithubAppClient}. */
public class GithubUserAuthClient {

	private final GithubAppProperties properties;
	private final Clock clock;
	private final RestClient http;

	public GithubUserAuthClient(GithubAppProperties properties, Clock clock, RestClient http) {
		this.properties = properties;
		this.clock = clock;
		this.http = http;
	}

	public GithubUserSession exchange(String code, String redirectUri) {
		outsideTransaction();
		return session(postToken(Map.of(
				"client_id", properties.clientId(),
				"client_secret", properties.clientSecret(),
				"code", code,
				"redirect_uri", redirectUri)), false);
	}

	public GithubUserSession refresh(String refreshToken) {
		outsideTransaction();
		return session(postToken(Map.of(
				"client_id", properties.clientId(),
				"client_secret", properties.clientSecret(),
				"grant_type", "refresh_token",
				"refresh_token", refreshToken)), true);
	}

	public GithubAccount account(String accessToken) {
		outsideTransaction();
		JsonNode body = request(() -> http.get().uri(properties.apiBaseUrl() + "/user")
				.headers(headers -> headers.setBearerAuth(accessToken))
				.retrieve()
				.onStatus(status -> status.isError(), (req, res) -> {
					throw failed();
				})
				.body(JsonNode.class));
		long id = body.path("id").asLong(0);
		String login = body.path("login").asString("");
		if (id <= 0 || !login.matches("[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?")) {
			throw failed();
		}
		String avatar = body.path("avatar_url").asString("");
		if (avatar.length() > 2048) {
			avatar = "";
		}
		return new GithubAccount(id, login, body.path("name").asString(""), avatar, body.path("email").asString(""));
	}

	private JsonNode postToken(Map<String, String> form) {
		String base = properties.webBaseUrl().endsWith("/")
				? properties.webBaseUrl().substring(0, properties.webBaseUrl().length() - 1)
				: properties.webBaseUrl();
		return request(() -> http.post().uri(base + "/login/oauth/access_token")
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(form)
				.retrieve()
				.onStatus(status -> status.isError(), (req, res) -> {
					throw failed();
				})
				.body(JsonNode.class));
	}

	private GithubUserSession session(JsonNode body, boolean refresh) {
		if (body == null || body.hasNonNull("error") || body.path("access_token").asString("").isBlank()) {
			throw refresh ? loginAgain() : rejected();
		}
		Instant now = clock.instant();
		return new GithubUserSession(
				body.path("access_token").asString(),
				expiry(now, body.path("expires_in").asLong(0), Duration.ofHours(8)),
				blankToNull(body.path("refresh_token").asString("")),
				expiry(now, body.path("refresh_token_expires_in").asLong(0), Duration.ofDays(180)));
	}

	private static Instant expiry(Instant now, long seconds, Duration fallback) {
		if (seconds <= 0) {
			return now.plus(fallback);
		}
		return now.plusSeconds(seconds);
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value;
	}

	private JsonNode request(java.util.function.Supplier<JsonNode> work) {
		try {
			JsonNode result = work.get();
			if (result == null) {
				throw failed();
			}
			return result;
		}
		catch (ApiException exception) {
			throw exception;
		}
		catch (RestClientException exception) {
			if (exception.getCause() instanceof ApiException api) {
				throw api;
			}
			throw failed();
		}
	}

	private void outsideTransaction() {
		if (TransactionSynchronizationManager.isActualTransactionActive()) {
			throw new IllegalStateException("GitHub HTTP calls must run outside a DB transaction");
		}
	}

	private static ApiException failed() {
		return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
	}

	private static ApiException rejected() {
		return new ApiException(400, "VALIDATION_ERROR", "로그인을 완료하지 못했어요. 다시 시도해 주세요.");
	}

	private static ApiException loginAgain() {
		return new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
	}
}
