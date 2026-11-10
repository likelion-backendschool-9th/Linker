package com.linker.backend.integration.github;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/** HTTP-only adapter for page 22 repo selection. No post policy, DB writes or token responses. */
@Component
public class GithubRepoClient implements GithubRepoSource {
  static final int PER_PAGE = 100;
  /** 1,000 owned repos is far past any MVP account; stop paging there instead of looping on. */
  static final int MAX_PAGES = 10;

  private final RestClient http;
  private final GithubUserAccessTokenSource userTokens;

  public GithubRepoClient(GithubAppProperties properties, GithubUserAccessTokenSource userTokens) {
    this.userTokens = userTokens;
    var factory =
        new JdkClientHttpRequestFactory(
            HttpClient.newBuilder()
                .connectTimeout(properties.requestTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build());
    factory.setReadTimeout(properties.requestTimeout());
    http =
        RestClient.builder()
            .baseUrl(properties.apiBaseUrl())
            .requestFactory(factory)
            .defaultHeader("Accept", "application/vnd.github+json")
            .defaultHeader("X-GitHub-Api-Version", properties.apiVersion())
            .build();
  }

  /**
   * {@code GET /users/{login}/repos?type=owner}: lists only public repos, and only those the account
   * owns (its forks of other people's or orgs' repos included). The list endpoint carries no
   * {@code parent}, so {@code parentFullName} stays null.
   */
  @Override
  public List<GithubTeamSource.Repository> ownedPublicRepositories(long userId, String login) {
    outside();
    String token = userTokens.tokenFor(userId);
    var result = new ArrayList<GithubTeamSource.Repository>();
    for (int page = 1; page <= MAX_PAGES; page++) {
      JsonNode rows =
          get(
              "/users/{login}/repos?type=owner&sort=full_name&per_page={size}&page={page}",
              token,
              login,
              PER_PAGE,
              page);
      if (!rows.isArray()) throw unavailable();
      for (JsonNode row : rows) {
        if (!row.path("id").isIntegralNumber() || row.path("id").asLong(0) <= 0) throw unavailable();
        if (!row.path("private").isBoolean()) throw unavailable();
        String owner = required(row.path("owner"), "login");
        // Defensive: the endpoint already returns public repos of this owner only
        if (row.path("private").asBoolean(true) || !owner.equalsIgnoreCase(login)) continue;
        result.add(
            new GithubTeamSource.Repository(
                row.path("id").asLong(0),
                owner,
                required(row, "name"),
                required(row, "full_name"),
                nullable(row, "description"),
                nullable(row, "language"),
                row.path("stargazers_count").asInt(0),
                row.path("forks_count").asInt(0),
                nullable(row, "html_url"),
                false,
                row.path("fork").asBoolean(false),
                null,
                nullable(row, "default_branch")));
      }
      if (rows.size() < PER_PAGE) break;
    }
    return List.copyOf(result);
  }

  private JsonNode get(String path, String token, Object... variables) {
    try {
      var result =
          http.get()
              .uri(path, variables)
              .headers(h -> h.setBearerAuth(token))
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (request, response) -> {
                    throw response.getStatusCode().value() == 401 ? loginAgain() : unavailable();
                  })
              .body(JsonNode.class);
      if (result == null) throw unavailable();
      return result;
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  private static String required(JsonNode node, String field) {
    String value = node.path(field).asString("");
    if (value.isBlank()) throw unavailable();
    return value;
  }

  private static String nullable(JsonNode node, String field) {
    return node.path(field).isString() ? node.path(field).asString("") : null;
  }

  private static void outside() {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("GitHub HTTP must run outside DB transactions");
  }

  private static ApiException loginAgain() {
    return new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
  }

  private static ApiException unavailable() {
    return new ApiException(
        503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}
