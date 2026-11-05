package com.linker.backend.integration.github;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.linker.backend.dto.github.response.GithubInstallationView;
import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/** Technical HTTP adapter; no persistence or team/board business decisions. */
public class GithubAppClient {
	private final GithubAppProperties properties;
	private final GithubAppJwt jwt;
	private final Clock clock;
	private final RestClient client;
	private final Map<Long, CachedToken> tokens = new ConcurrentHashMap<>();

	public GithubAppClient(GithubAppProperties properties, GithubAppJwt jwt, Clock clock, RestClient.Builder builder) {
		this.properties = properties;
		this.jwt = jwt;
		this.clock = clock;
		this.client = builder.baseUrl(properties.apiBaseUrl())
				.defaultHeader("Accept", "application/vnd.github+json")
				.defaultHeader("X-GitHub-Api-Version", properties.apiVersion()).build();
	}

	public GithubInstallationView verifyUserInstallation(String userToken, long installationId) {
		outsideTransaction();
		if (userToken == null || userToken.isBlank()) {
			throw new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
		}
		if (installationId <= 0 || properties.id().isBlank()) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub App 설정이 필요해요");
		}
		for (int page = 1; ; page++) {
			int currentPage = page;
			JsonNode response = request(() -> client.get()
					.uri(uri -> uri.path("/user/installations").queryParam("per_page", 100).queryParam("page", currentPage).build())
					.headers(headers -> headers.setBearerAuth(userToken)).retrieve()
					.onStatus(status -> status.isError(), (req, res) -> { throw upstream(res.getStatusCode().value(), res.getHeaders(), true); })
					.body(JsonNode.class));
			JsonNode installations = response.path("installations");
			if (!installations.isArray()) {
				throw unavailable();
			}
			for (JsonNode installation : installations) {
				if (installation.path("id").asLong(0) != installationId) {
					continue;
				}
				JsonNode account = installation.path("account");
				if (!properties.id().equals(installation.path("app_id").asString(""))
						|| !"Organization".equals(account.path("type").asString(""))
						|| !installation.path("suspended_at").isNull()
						|| account.path("id").asLong(0) <= 0 || account.path("login").asString("").isBlank()) {
					throw forbidden();
				}
				return new GithubInstallationView(installationId, account.path("id").asLong(0),
						account.path("login").asString(""), account.path("avatar_url").asString(""));
			}
			if (installations.size() < 100 || (long) page * 100 >= response.path("total_count").asLong(0)) {
				throw forbidden();
			}
		}
	}

	/** Read-only installation token, returned only inside the server. */
	public synchronized String installationReadToken(long installationId) {
		outsideTransaction();
		if (installationId <= 0) {
			throw forbidden();
		}
		Instant now = clock.instant();
		tokens.entrySet().removeIf(entry -> !entry.getValue().expiresAt.isAfter(now.plusSeconds(60)));
		CachedToken cached = tokens.get(installationId);
		if (cached != null) {
			return cached.token;
		}
		JsonNode response = request(() -> client.post().uri("/app/installations/{id}/access_tokens", installationId)
				.headers(headers -> headers.setBearerAuth(jwt.issue())).contentType(MediaType.APPLICATION_JSON)
				.body(Map.of("permissions", Map.of("metadata", "read", "contents", "read", "issues", "read",
						"pull_requests", "read", "organization_projects", "read")))
				.retrieve().onStatus(status -> status.isError(), (req, res) -> { throw upstream(res.getStatusCode().value(), res.getHeaders(), false); })
				.body(JsonNode.class));
		String token = response.path("token").asString("");
		Instant expiresAt;
		try {
			expiresAt = Instant.parse(response.path("expires_at").asString(""));
		}
		catch (RuntimeException exception) {
			throw unavailable();
		}
		if (token.isBlank() || !expiresAt.isAfter(now.plusSeconds(60))) {
			throw unavailable();
		}
		tokens.put(installationId, new CachedToken(token, expiresAt));
		return token;
	}

	public void invalidateInstallationToken(long installationId) {
		tokens.remove(installationId);
	}

	private JsonNode request(java.util.function.Supplier<JsonNode> work) {
		try {
			JsonNode result = work.get();
			if (result == null) { throw unavailable(); }
			return result;
		}
		catch (RestClientException exception) {
			throw unavailable();
		}
	}

	private void outsideTransaction() {
		if (TransactionSynchronizationManager.isActualTransactionActive()) {
			throw new IllegalStateException("GitHub HTTP calls must run outside a DB transaction");
		}
	}

	private ApiException upstream(int status, HttpHeaders headers, boolean userRequest) {
		if (status == 429 || headers.getFirst("Retry-After") != null || "0".equals(headers.getFirst("X-RateLimit-Remaining"))) {
			return unavailable();
		}
		if (userRequest && status == 401) {
			return new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
		}
		if (userRequest && (status == 403 || status == 404)) { return forbidden(); }
		return unavailable();
	}

	private ApiException forbidden() {
		return new ApiException(403, "FORBIDDEN", "GitHub 앱 설치 권한을 확인해 주세요");
	}

	private ApiException unavailable() {
		return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
	}

	private static final class CachedToken {
		private final String token;
		private final Instant expiresAt;
		private CachedToken(String token, Instant expiresAt) { this.token = token; this.expiresAt = expiresAt; }
	}
}
