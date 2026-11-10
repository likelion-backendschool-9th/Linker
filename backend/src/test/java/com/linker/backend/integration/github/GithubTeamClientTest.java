package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.RsaMaterial;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

class GithubTeamClientTest {
  final GithubUserAccessTokenSource tokens = mock(GithubUserAccessTokenSource.class);
  final GithubAppClient app = mock(GithubAppClient.class);
  final List<String> requests = new CopyOnWriteArrayList<>();
  final JsonMapper json = JsonMapper.builder().build();
  HttpServer server;
  GithubTeamClient client;
  Function<String, String> response;
  Function<String, Integer> responseStatus = request -> 200;

  @Test
  void singlePullRequestUsesInstallationTokenAndChecksRepositoryIdentity() {
    response = request -> request.startsWith("/repos/org/repo/pulls/12") ? """
        {"id":901,"number":12,"title":"PR","state":"closed","draft":false,
         "user":{"login":"dev"},"html_url":"https://github.com/org/repo/pull/12",
         "merged_at":"2026-11-07T15:00:00Z","closed_at":"2026-11-07T15:00:00Z",
         "updated_at":"2026-11-07T15:00:00Z","base":{"repo":{"id":900}}}
        """ : "{\"id\":900}";
    var repo = new GithubTeamSource.Repository(900, "org", "repo", "org/repo", null,
        null, 0, 0, null, false, false, null, "main");
    var result = client.pullRequest(42, repo, 12);
    assertThat(result.id()).isEqualTo(901);
    assertThat(result.state()).isEqualTo("MERGED");
    verify(app).installationReadToken(42);
    verifyNoInteractions(tokens);
    response = request -> "{\"id\":999}";
    assertThatThrownBy(() -> client.pullRequest(42, repo, 12)).isInstanceOf(ApiException.class);
  }

  @Test
  void singlePullRequestDoesNotPerformHttpInsideTransaction() {
    TransactionSynchronizationManager.setActualTransactionActive(true);
    var repo = new GithubTeamSource.Repository(900, "org", "repo", "org/repo", null,
        null, 0, 0, null, false, false, null, "main");
    assertThatThrownBy(() -> client.pullRequest(42, repo, 12)).isInstanceOf(IllegalStateException.class);
    assertThat(requests).isEmpty();
  }

  @Test
  void organizationInvitesUseTheUserTokenAndAlwaysRequestDirectMember() {
    response =
        request ->
            request.startsWith("/user/memberships/orgs/org")
                ? "{\"state\":\"active\",\"role\":\"admin\",\"organization\":{\"id\":42}}"
                : "{\"id\":987}";
    assertThat(client.inviteOrganizationMember(7, 42, "org", 900)).isEqualTo(987);
    assertThat(requests)
        .anySatisfy(request -> {
          assertThat(request).startsWith("/orgs/org/invitations");
          var body = json.readTree(request.substring(request.indexOf('\n') + 1));
          assertThat(body.path("invitee_id").asLong()).isEqualTo(900);
          assertThat(body.path("role").asString()).isEqualTo("direct_member");
        });
    verifyNoInteractions(app);
  }

  @Test
  void organizationInvitesRejectNonOwnersBeforeSending() {
    response = request -> "{\"state\":\"active\",\"role\":\"member\",\"organization\":{\"id\":42}}";
    assertThatThrownBy(() -> client.inviteOrganizationMember(7, 42, "org", 900))
        .isInstanceOf(ApiException.class);
    assertThat(requests).hasSize(1);
  }

  @Test
  void organizationInviteRateLimitsRemainAnError() {
    response =
        request ->
            request.startsWith("/user/memberships/orgs/org")
                ? "{\"state\":\"active\",\"role\":\"admin\",\"organization\":{\"id\":42}}"
                : "{}";
    responseStatus = request -> request.startsWith("/orgs/org/invitations") ? 429 : 200;
    assertThatThrownBy(() -> client.inviteOrganizationMember(7, 42, "org", 900))
        .isInstanceOfSatisfying(
            ApiException.class,
            failure -> {
              assertThat(failure.getStatus()).isEqualTo(429);
              assertThat(failure.getCode()).isEqualTo("GITHUB_INVITE_LIMIT");
            });
  }

  @Test
  void memberLookupChecksGithubIdentityAndTreatsOnlyMembership404AsAbsent() {
    response = request -> "{\"id\":900}";
    responseStatus = request -> request.startsWith("/orgs/org/memberships/target") ? 404 : 200;
    assertThat(client.organizationMemberState(7, 42, "org", "target", 900)).isEqualTo("NONE");
    requests.clear();
    assertThatThrownBy(() -> client.organizationMemberState(7, 42, "org", "target", 901))
        .isInstanceOf(ApiException.class);
    assertThat(requests).hasSize(1);
  }

  @Test
  void invitationAndOwnershipReadsRejectAmbientTransactions() {
    TransactionSynchronizationManager.setActualTransactionActive(true);
    assertThatThrownBy(() -> client.inviteOrganizationMember(7, 42, "org", 900))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> client.organizationOwner(7, 42, "org"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> client.organizationMemberState(7, 42, "org", "target", 900))
        .isInstanceOf(IllegalStateException.class);
    assertThat(requests).isEmpty();
  }

  @BeforeEach
  void start() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        exchange -> {
          String request =
              exchange.getRequestURI()
                  + "\n"
                  + new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
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
    when(app.installationReadToken(anyLong())).thenReturn("synthetic-install-token");
    client =
        new GithubTeamClient(
            properties, tokens, app, new GithubAppJwt(properties, Clock.systemUTC()));
  }

  @AfterEach
  void close() {
    server.stop(0);
    TransactionSynchronizationManager.clear();
  }

  @Test
  void repositoryPaginationDoesNotTruncateOrAcceptOtherOrganizations() throws Exception {
    var row =
        Map.of(
            "id",
            900,
            "owner",
            Map.of("id", 500, "login", "org"),
            "name",
            "repo",
            "full_name",
            "org/repo",
            "private",
            true);
    response =
        request -> {
          try {
            return json.writeValueAsString(
                Map.of(
                    "repositories",
                    request.contains("&page=1") ? Collections.nCopies(100, row) : List.of(row)));
          } catch (Exception e) {
            throw new IllegalStateException(e);
          }
        };
    assertThat(client.repositories(7, 42, 500)).hasSize(101);
    assertThat(requests).hasSize(2);
    assertThatThrownBy(() -> client.repositories(7, 42, 501)).isInstanceOf(ApiException.class);
  }

  @Test
  void projectFieldPaginationUsesNullThenTheActualCursorAndChecksOrgOwnership() {
    response =
        request ->
            request.contains("cursor-next")
                ? """
        {"data":{"node":{"id":"P1","number":1,"title":"Board","owner":{"databaseId":500},"items":{"totalCount":3},"fields":{"nodes":[{"id":"F_DATE","name":"Start date","dataType":"DATE"}],"pageInfo":{"hasNextPage":false,"endCursor":null}}}}}
        """
                : """
        {"data":{"node":{"id":"P1","number":1,"title":"Board","owner":{"databaseId":500},"items":{"totalCount":3},"fields":{"nodes":[{"id":"F_STATUS","name":"Status","dataType":"SINGLE_SELECT","options":[{"id":"op","name":"Todo"}]}],"pageInfo":{"hasNextPage":true,"endCursor":"cursor-next"}}}}}
        """;
    var project = client.project(7, "P1");
    assertThat(project.orgId()).isEqualTo(500);
    assertThat(project.fields()).hasSize(2);
    assertThat(requests.getFirst()).contains("\"after\":null");
    assertThat(requests.getLast()).contains("cursor-next");
  }

  @Test
  void rejectsGraphQlErrorsAndNeverAutomaticallyRetriesProjectCreation() {
    response = request -> "{\"errors\":[{\"message\":\"synthetic provider failure\"}]}";
    assertThatThrownBy(() -> client.createProject(7, "ORG", "Linker", "request-id"))
        .isInstanceOf(ApiException.class);
    assertThat(requests).hasSize(1);
    assertThat(requests.getFirst()).contains("createProjectV2", "clientMutationId");
  }

  @ParameterizedTest
  @ValueSource(strings = {"", ",\"default_repository_permission\":null"})
  void missingOrganizationBasePermissionRemainsUnknownInsteadOfGrantingWrite(String permissionField) {
    // An App can receive an organization identity while this owner-only value is null.
    response = request -> request.startsWith("/user/memberships/orgs/org")
        ? "{\"state\":\"active\",\"organization\":{\"id\":500}}"
        : "{\"id\":500,\"node_id\":\"ORG_500\",\"login\":\"org\",\"type\":\"Organization\"" + permissionField + "}";

    var organization = client.organization(7, 500, "org");

    assertThat(organization.id()).isEqualTo(500);
    assertThat(organization.basePermission()).isEmpty();
    verify(tokens).tokenFor(7);
    verifyNoInteractions(app);
  }

  @Test
  void orgMembersUseASeparatePermissionWithoutBroadeningTheSharedIssueToken() {
    response =
        request -> {
          if (request.startsWith("/app/installations/42/access_tokens"))
            return "{\"token\":\"synthetic-members-token\"}";
          if (request.startsWith("/orgs/org/members?")) return "[{\"id\":10},{\"id\":20}]";
          return "{\"id\":500}";
        };

    assertThat(client.memberIds(42, "org", 500)).containsExactly(10L, 20L);
    assertThat(requests).hasSize(3);
    assertThat(requests.getFirst()).contains("\"members\":\"read\"").doesNotContain("\"issues\"");
    verifyNoInteractions(app, tokens);
  }

  @Test
  void rejectsAmbientTransactionsBeforeReadingOrRefreshingUserTokens() {
    TransactionSynchronizationManager.setActualTransactionActive(true);
    assertThatThrownBy(() -> client.project(7, "P1")).isInstanceOf(IllegalStateException.class);
    assertThat(requests).isEmpty();
    verifyNoInteractions(tokens);
  }

  @Test
  void installationMetadataMustBelongToTheConfiguredApp() {
    response =
        request ->
            """
        {"id":42,"app_id":999,"repository_selection":"all","account":{"id":500,"login":"org","type":"Organization"},"suspended_at":null}
        """;
    assertThatThrownBy(() -> client.installation(42)).isInstanceOf(ApiException.class);
  }
}
