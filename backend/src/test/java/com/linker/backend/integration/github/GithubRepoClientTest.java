package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.RsaMaterial;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class GithubRepoClientTest {
  final GithubUserAccessTokenSource tokens = mock(GithubUserAccessTokenSource.class);
  final List<String> requests = new CopyOnWriteArrayList<>();
  HttpServer server;
  GithubRepoClient client;
  Function<String, String> response = request -> "[]";
  Function<String, Integer> responseStatus = request -> 200;

  @Test
  void listsOwnedPublicReposIncludingForksWithTheUserToken() {
    response =
        request ->
            """
            [
              {"id":1100,"name":"linker-web","full_name":"dev/linker-web","owner":{"login":"dev"},
               "private":false,"fork":false,"description":"web","language":"TypeScript",
               "stargazers_count":3,"forks_count":1,"html_url":"https://github.com/dev/linker-web",
               "default_branch":"main"},
              {"id":1200,"name":"react","full_name":"dev/react","owner":{"login":"dev"},
               "private":false,"fork":true,"description":null,"language":"JavaScript",
               "stargazers_count":0,"forks_count":0,"html_url":"https://github.com/dev/react",
               "default_branch":"main"},
              {"id":1300,"name":"secret","full_name":"dev/secret","owner":{"login":"dev"},
               "private":true,"fork":false}
            ]
            """;

    var repos = client.ownedPublicRepositories(7, "dev");

    assertThat(repos).extracting(GithubTeamSource.Repository::fullName)
        .containsExactly("dev/linker-web", "dev/react");
    assertThat(repos.get(1).isFork()).isTrue();
    assertThat(repos).allSatisfy(repo -> assertThat(repo.isPrivate()).isFalse());
    assertThat(requests).singleElement().satisfies(request -> {
      assertThat(request).startsWith("/users/dev/repos?");
      assertThat(request).contains("type=owner").contains("per_page=100").contains("page=1");
      assertThat(request).contains("Bearer synthetic-user-token");
    });
  }

  @Test
  void followsPagesUntilAShortPage() {
    String full =
        IntStream.range(0, GithubRepoClient.PER_PAGE)
            .mapToObj(i -> repo(5000 + i, "dev/r" + i))
            .collect(Collectors.joining(",", "[", "]"));
    response = request -> request.contains("&page=1 ") ? full : "[" + repo(9000, "dev/last") + "]";

    var repos = client.ownedPublicRepositories(7, "dev");

    assertThat(repos).hasSize(GithubRepoClient.PER_PAGE + 1);
    assertThat(requests).hasSize(2);
  }

  @Test
  void unauthorizedAsksToLogInAgainAndOtherFailuresAreUnavailable() {
    responseStatus = request -> 401;
    assertThatThrownBy(() -> client.ownedPublicRepositories(7, "dev"))
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo("LOGIN_REQUIRED");

    responseStatus = request -> 502;
    assertThatThrownBy(() -> client.ownedPublicRepositories(7, "dev"))
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo("SERVICE_UNAVAILABLE");
  }

  @Test
  void doesNotPerformHttpInsideTransaction() {
    TransactionSynchronizationManager.setActualTransactionActive(true);
    assertThatThrownBy(() -> client.ownedPublicRepositories(7, "dev"))
        .isInstanceOf(IllegalStateException.class);
    assertThat(requests).isEmpty();
  }

  private static String repo(long id, String fullName) {
    return """
        {"id":%d,"name":"%s","full_name":"%s","owner":{"login":"dev"},"private":false,"fork":false}
        """
        .formatted(id, fullName.substring(fullName.indexOf('/') + 1), fullName);
  }

  @BeforeEach
  void start() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        exchange -> {
          String request =
              exchange.getRequestURI()
                  + " "
                  + exchange.getRequestHeaders().getFirst("Authorization")
                  + "\n";
          requests.add(request);
          byte[] body = response.apply(request).getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(responseStatus.apply(request), body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    server.start();
    var properties =
        GithubAppProperties.installation(
            "123",
            "app",
            RsaMaterial.generate().privatePem(),
            "http://127.0.0.1:" + server.getAddress().getPort(),
            "2026-03-10",
            Duration.ofSeconds(5),
            Duration.ofMinutes(10));
    when(tokens.tokenFor(anyLong())).thenReturn("synthetic-user-token");
    client = new GithubRepoClient(properties, tokens);
  }

  @AfterEach
  void stop() {
    TransactionSynchronizationManager.setActualTransactionActive(false);
    server.stop(0);
  }
}
