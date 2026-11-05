package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collections;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;

class GithubAppClientTest {
	private static final Instant NOW = Instant.parse("2026-11-05T00:00:00Z");
	private MockRestServiceServer server;
	private GithubAppClient client;
	private Clock clock;
	private static final String INSTALLATION = """
			{"id":42,"app_id":123,"suspended_at":null,"account":{"type":"Organization","id":7,"login":"linker-org","avatar_url":"https://avatars.githubusercontent.com/u/7"}}
			""";

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		clock = mock(Clock.class);
		when(clock.instant()).thenReturn(NOW);
		GithubAppJwt jwt = mock(GithubAppJwt.class);
		when(jwt.issue()).thenReturn("synthetic-app-jwt");
		client = new GithubAppClient(properties(), jwt, clock, builder);
	}

	static GithubAppProperties properties() {
		return GithubAppProperties.installation("123", "linker-test", "", "https://api.github.com", "2026-03-10", Duration.ofSeconds(10), Duration.ofMinutes(10));
	}

	@Test
	void verifiesTheUserTokenInstallationAndOrganization() {
		expectPage(1, "{\"total_count\":1,\"installations\":[" + INSTALLATION + "]}");
		var result = client.verifyUserInstallation("synthetic-user-token", 42);
		assertThat(result.orgId()).isEqualTo(7);
		assertThat(result.installationId()).isEqualTo(42);
		server.verify();
	}

	@Test
	void looksBeyondTheFirstPage() {
		String other = INSTALLATION.replace("\"id\":42", "\"id\":41");
		expectPage(1, "{\"total_count\":101,\"installations\":[" + String.join(",", Collections.nCopies(100, other)) + "]}");
		expectPage(2, "{\"total_count\":101,\"installations\":[" + INSTALLATION + "]}");
		assertThat(client.verifyUserInstallation("synthetic-user-token", 42).orgId()).isEqualTo(7);
		server.verify();
	}

	@Test
	void rejectsSpoofedIdWrongAppPersonalAccountAndSuspendedInstallation() {
		for (String json : new String[]{INSTALLATION.replace("\"id\":42", "\"id\":41"),
				INSTALLATION.replace("\"app_id\":123", "\"app_id\":999"),
				INSTALLATION.replace("Organization", "User"),
				INSTALLATION.replace("\"suspended_at\":null", "\"suspended_at\":\"2026-11-01T00:00:00Z\"")}) {
			server.reset();
			expectPage(1, "{\"total_count\":1,\"installations\":[" + json + "]}");
			assertThatThrownBy(() -> client.verifyUserInstallation("synthetic-user-token", 42))
					.isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.getStatus()).isEqualTo(403));
			server.verify();
		}
	}

	@Test
	void sanitizesGithubErrorsAndRequestsReloginForExpiredUserTokens() {
		server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=1"))
				.andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("synthetic-private-body"));
		assertThatThrownBy(() -> client.verifyUserInstallation("synthetic-user-token", 42))
				.isInstanceOfSatisfying(ApiException.class, exception -> {
					assertThat(exception.getCode()).isEqualTo("LOGIN_REQUIRED");
					assertThat(exception.getMessage()).doesNotContain("synthetic");
				});
	}

	@Test
	void githubRateLimitIsNotReportedAsMissingPermission() {
		server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=1"))
				.andRespond(withStatus(HttpStatus.FORBIDDEN).header("X-RateLimit-Remaining", "0").body("synthetic-private-body"));
		assertThatThrownBy(() -> client.verifyUserInstallation("synthetic-user-token", 42))
				.isInstanceOfSatisfying(ApiException.class, exception -> {
					assertThat(exception.getStatus()).isEqualTo(503);
					assertThat(exception.getCode()).isEqualTo("SERVICE_UNAVAILABLE");
				});
	}

	@Test
	void installationTokensHaveReadPermissionsAndRefreshBeforeExpiry() {
		expectToken("synthetic-token-one", 3600);
		expectToken("synthetic-token-two", 7200);
		assertThat(client.installationReadToken(42)).isEqualTo("synthetic-token-one");
		assertThat(client.installationReadToken(42)).isEqualTo("synthetic-token-one");
		when(clock.instant()).thenReturn(NOW.plusSeconds(3550));
		assertThat(client.installationReadToken(42)).isEqualTo("synthetic-token-two");
		server.verify();
	}

	@Test
	void rejectsCallsFromAnOpenDatabaseTransaction() {
		TransactionSynchronizationManager.setActualTransactionActive(true);
		try {
			assertThatThrownBy(() -> client.verifyUserInstallation("synthetic-user-token", 42)).isInstanceOf(IllegalStateException.class);
			assertThatThrownBy(() -> client.installationReadToken(42)).isInstanceOf(IllegalStateException.class);
		}
		finally { TransactionSynchronizationManager.setActualTransactionActive(false); }
	}

	private void expectPage(int page, String body) {
		server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=" + page))
				.andExpect(header("Authorization", "Bearer synthetic-user-token"))
				.andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
	}

	private void expectToken(String token, long expiresIn) {
		server.expect(requestTo("https://api.github.com/app/installations/42/access_tokens"))
				.andExpect(method(HttpMethod.POST)).andExpect(header("Authorization", "Bearer synthetic-app-jwt"))
				.andExpect(content().json("""
						{"permissions":{"metadata":"read","contents":"read","issues":"read","pull_requests":"read","organization_projects":"read"}}
						"""))
				.andRespond(withSuccess("{\"token\":\"" + token + "\",\"expires_at\":\"" + NOW.plusSeconds(expiresIn) + "\"}", MediaType.APPLICATION_JSON));
	}
}
