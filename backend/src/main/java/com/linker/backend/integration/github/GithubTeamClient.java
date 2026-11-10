package com.linker.backend.integration.github;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import java.net.http.HttpClient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/**
 * HTTP-only adapter for page 08. No team policy, DB writes, retries of mutations, or token
 * responses.
 */
@Component
public class GithubTeamClient implements GithubTeamSource {
  private static final int MAX_PAGES = 10000; // Transport ceiling; never return a truncated scan.
  private static final String FIELDS =
      """
            nodes { __typename ... on ProjectV2Field { id name dataType }
              ... on ProjectV2SingleSelectField { id name dataType options { id name color } } }
            pageInfo { hasNextPage endCursor }
            """;
  private static final String PROJECT =
      """
            id number title owner { ... on Organization { databaseId } }
            items(first:1) { totalCount } fields(first:100,after:$after) {
            """
          + FIELDS
          + " }";
  private final RestClient http;
  private final GithubUserAccessTokenSource userTokens;
  private final GithubAppClient app;
  private final GithubAppJwt jwt;
  private final String appId;

  public GithubTeamClient(
      GithubAppProperties properties,
      GithubUserAccessTokenSource userTokens,
      GithubAppClient app,
      GithubAppJwt jwt) {
    this.userTokens = userTokens;
    this.app = app;
    this.jwt = jwt;
    this.appId = properties.id();
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

  @Override
  public boolean organizationOwner(long userId, long expectedOrgId, String login) {
    var membership = get("/user/memberships/orgs/{org}", userToken(userId), login);
    if (!"active".equals(membership.path("state").asString(""))
        || membership.path("organization").path("id").asLong(0) != expectedOrgId) throw forbidden();
    return "admin".equals(membership.path("role").asString(""));
  }

  @Override
  public String organizationMemberState(
      long userId, long expectedOrgId, String login, String memberLogin, long memberId) {
    String token = userToken(userId);
    if (get("/users/{login}", token, memberLogin).path("id").asLong(0) != memberId)
      throw forbidden();
    try {
      var row =
          http.get()
              .uri("/orgs/{org}/memberships/{login}", login, memberLogin)
              .headers(h -> h.setBearerAuth(token))
              .retrieve()
              .onStatus(
                  status -> status.value() == 404,
                  (request, response) -> {
                    throw new MissingMembership();
                  })
              .onStatus(
                  status -> status.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (row == null || row.path("organization").path("id").asLong(0) != expectedOrgId)
        throw forbidden();
      String state = row.path("state").asString("");
      if (!List.of("active", "pending").contains(state)) throw unavailable();
      return state.toUpperCase(java.util.Locale.ROOT);
    } catch (MissingMembership e) {
      return "NONE";
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  private static class MissingMembership extends RuntimeException {}

  @Override
  public long inviteOrganizationMember(
      long userId, long expectedOrgId, String login, long githubUserId) {
    outside();
    if (!organizationOwner(userId, expectedOrgId, login)) throw forbidden();
    try {
      var result =
          http.post()
              .uri("/orgs/{org}/invitations", login)
              .headers(h -> h.setBearerAuth(userToken(userId)))
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of("invitee_id", githubUserId, "role", "direct_member"))
              .retrieve()
              .onStatus(
                  status -> status.isError(),
                  (request, response) -> {
                    int status = response.getStatusCode().value();
                    if (status == 429
                        || response.getHeaders().getFirst("Retry-After") != null
                        || "0".equals(response.getHeaders().getFirst("X-RateLimit-Remaining")))
                      throw new ApiException(
                          429, "GITHUB_INVITE_LIMIT", "GitHub 초대 한도에 도달했어요. 잠시 후 다시 시도해 주세요");
                    if (status == 422)
                      throw new ApiException(
                          409,
                          "STATE_CONFLICT",
                          "GitHub 초대가 처리되지 않았어요. 기존 초대·멤버 상태와 일일 초대 한도를 확인해 주세요");
                    throw upstream(status);
                  })
              .body(JsonNode.class);
      if (result == null || result.path("id").asLong(0) <= 0) throw unavailable();
      return result.path("id").asLong(0);
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  @Override
  public Organization organization(long userId, long expectedOrgId, String login) {
    String token = userToken(userId);
    var membership = get("/user/memberships/orgs/{org}", token, login);
    if (!"active".equals(membership.path("state").asString(""))
        || membership.path("organization").path("id").asLong(0) != expectedOrgId) throw forbidden();
    var org = get("/orgs/{org}", token, login);
    if (org.path("id").asLong(0) != expectedOrgId
        || !"Organization".equals(org.path("type").asString(""))) throw forbidden();
    String permission = org.path("default_repository_permission").asString("");
    return new Organization(
        expectedOrgId,
        required(org, "node_id"),
        required(org, "login"),
        org.path("avatar_url").asString(""),
        permission);
  }

  @Override
  public List<Repository> repositories(long userId, long installationId, long orgId) {
    String token = userToken(userId);
    var result = new ArrayList<Repository>();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var response =
          get(
              "/user/installations/{id}/repositories?per_page=100&page={page}",
              token,
              installationId,
              page);
      var rows = response.path("repositories");
      if (!rows.isArray()) throw unavailable();
      for (var row : rows) {
        if (row.path("owner").path("id").asLong(0) != orgId
            || !row.path("id").isIntegralNumber()
            || row.path("id").asLong(0) <= 0) throw forbidden();
        if (!row.path("private").isBoolean()) throw unavailable();
        result.add(
            new Repository(
                row.path("id").asLong(0),
                required(row.path("owner"), "login"),
                required(row, "name"),
                required(row, "full_name"),
                nullable(row, "description"),
                nullable(row, "language"),
                row.path("stargazers_count").asInt(0),
                row.path("forks_count").asInt(0),
                nullable(row, "html_url"),
                row.path("private").asBoolean(false),
                row.path("fork").asBoolean(false),
                nullable(row.path("parent"), "full_name"),
                nullable(row, "default_branch")));
      }
      if (rows.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  @Override
  public List<Project> projects(long userId, long orgId, String login) {
    String token = userToken(userId);
    String cursor = "";
    var result = new ArrayList<Project>();
    for (int page = 0; page < MAX_PAGES; page++) {
      var data =
          graphql(
              "query($login:String!,$after:String){organization(login:$login){databaseId projectsV2(first:100,after:$after){nodes{id} pageInfo{hasNextPage endCursor}}}}",
              paged("login", login, cursor),
              token);
      var org = data.path("organization");
      if (org.path("databaseId").asLong(0) != orgId) throw forbidden();
      var projects = org.path("projectsV2");
      if (!projects.path("nodes").isArray()) throw unavailable();
      for (var project : projects.path("nodes"))
        result.add(project(userId, required(project, "id")));
      if (!projects.path("pageInfo").path("hasNextPage").asBoolean(false))
        return List.copyOf(result);
      cursor = next(projects, cursor);
    }
    throw unavailable();
  }

  @Override
  public Project project(long userId, String id) {
    String token = userToken(userId);
    String cursor = "";
    var fields = new ArrayList<Field>();
    Project result = null;
    for (int page = 0; page < MAX_PAGES; page++) {
      var raw =
          graphql(
                  "query($id:ID!,$after:String){node(id:$id){... on ProjectV2{" + PROJECT + "}}}",
                  paged("id", id, cursor),
                  token)
              .path("node");
      if (!id.equals(required(raw, "id")) || raw.path("owner").path("databaseId").asLong(0) <= 0)
        throw forbidden();
      var connection = raw.path("fields");
      if (!connection.path("nodes").isArray()) throw unavailable();
      for (var field : connection.path("nodes")) {
        if (!field.has("id")) continue;
        var options = new ArrayList<Option>();
        if (field.path("options").isArray())
          for (var option : field.path("options"))
            options.add(
                new Option(
                    required(option, "id"),
                    required(option, "name"),
                    option.path("color").asString("GRAY")));
        fields.add(
            new Field(
                required(field, "id"),
                required(field, "name"),
                required(field, "dataType"),
                List.copyOf(options)));
      }
      result =
          new Project(
              id,
              raw.path("owner").path("databaseId").asLong(0),
              raw.path("number").asInt(0),
              required(raw, "title"),
              raw.path("items").path("totalCount").asInt(0),
              List.copyOf(fields));
      if (!connection.path("pageInfo").path("hasNextPage").asBoolean(false)) return result;
      cursor = next(connection, cursor);
    }
    throw unavailable();
  }

  @Override
  public Project createProject(long userId, String owner, String title, String mutationId) {
    var data =
        graphql(
            "mutation($input:CreateProjectV2Input!){createProjectV2(input:$input){projectV2{id}}}",
            Map.of(
                "input", Map.of("ownerId", owner, "title", title, "clientMutationId", mutationId)),
            userToken(userId));
    // Return the confirmed id immediately. Caller checkpoints it before further HTTP/DB work.
    return new Project(
        required(data.path("createProjectV2").path("projectV2"), "id"), 0, 0, title, 0, List.of());
  }

  @Override
  public void updateStatus(long userId, String fieldId, List<String> names) {
    var colors = List.of("GRAY", "BLUE", "RED", "GREEN");
    var options = new ArrayList<Map<String, String>>();
    for (int n = 0; n < names.size(); n++)
      options.add(
          Map.of("name", names.get(n), "color", colors.get(n % colors.size()), "description", ""));
    graphql(
        "mutation($input:UpdateProjectV2FieldInput!){updateProjectV2Field(input:$input){projectV2Field{... on ProjectV2SingleSelectField{id}}}}",
        Map.of("input", Map.of("fieldId", fieldId, "singleSelectOptions", options)),
        userToken(userId));
  }

  @Override
  public void createDateField(long userId, String projectId, String name) {
    graphql(
        "mutation($input:CreateProjectV2FieldInput!){createProjectV2Field(input:$input){projectV2Field{... on ProjectV2Field{id}}}}",
        Map.of("input", Map.of("projectId", projectId, "dataType", "DATE", "name", name)),
        userToken(userId));
  }

  @Override
  public boolean hasPendingInstallationRequest(long userId) {
    long requester = get("/user", userToken(userId)).path("id").asLong(0);
    if (requester <= 0) throw unavailable();
    String token = jwt.issue();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var rows = get("/app/installation-requests?per_page=100&page={page}", token, page);
      if (!rows.isArray()) throw unavailable();
      for (var row : rows)
        if (row.path("requester").path("id").asLong(0) == requester
            && "Organization".equals(row.path("account").path("type").asString(""))) return true;
      if (rows.size() < 100) return false;
    }
    throw unavailable();
  }

  @Override
  public List<Long> memberIds(long installationId, String login, long orgId) {
    var result = new ArrayList<Long>();
    String token = memberToken(installationId);
    if (get("/orgs/{org}", token, login).path("id").asLong(0) != orgId) throw forbidden();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var rows = get("/orgs/{org}/members?per_page=100&page={page}", token, login, page);
      if (!rows.isArray()) throw unavailable();
      for (var row : rows) {
        long id = row.path("id").asLong(0);
        if (id <= 0) throw unavailable();
        result.add(id);
      }
      if (rows.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  /** Keep the existing C issue/Projects token permissions unchanged. */
  private String memberToken(long installationId) {
    outside();
    try {
      var result =
          http.post()
              .uri("/app/installations/{id}/access_tokens", installationId)
              .headers(h -> h.setBearerAuth(jwt.issue()))
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of("permissions", Map.of("members", "read")))
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (result == null) throw unavailable();
      return required(result, "token");
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  @Override
  public List<PullRequest> pullRequests(long installationId, Repository repository) {
    var result = new ArrayList<PullRequest>();
    String token = app.installationReadToken(installationId);
    var verify = get("/repos/{owner}/{repo}", token, repository.owner(), repository.name());
    if (verify.path("id").asLong(0) != repository.id()) throw forbidden();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var rows =
          get(
              "/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}",
              token,
              repository.owner(),
              repository.name(),
              page);
      if (!rows.isArray()) throw unavailable();
      for (var row : rows) {
        var merged = instant(row, "merged_at");
        result.add(
            new PullRequest(
                row.path("id").asLong(0),
                row.path("number").asInt(0),
                required(row, "title"),
                merged != null
                    ? "MERGED"
                    : "closed".equals(required(row, "state")) ? "CLOSED" : "OPEN",
                row.path("draft").asBoolean(false),
                nullable(row.path("user"), "login"),
                nullable(row, "html_url"),
                merged,
                instant(row, "closed_at"),
                instant(row, "updated_at")));
      }
      if (rows.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  @Override
  public PullRequest pullRequest(long installationId, Repository repository, int number) {
    String token = app.installationReadToken(installationId);
    var repo = get("/repos/{owner}/{repo}", token, repository.owner(), repository.name());
    if (repo.path("id").asLong(0) != repository.id()) throw forbidden();
    var row = get("/repos/{owner}/{repo}/pulls/{number}", token, repository.owner(), repository.name(), number);
    if (row.path("base").path("repo").path("id").asLong(0) != repository.id()
        || row.path("number").asInt(0) != number) throw forbidden();
    var merged = instant(row, "merged_at");
    return new PullRequest(row.path("id").asLong(0), number, required(row, "title"),
        merged != null ? "MERGED" : "closed".equals(required(row, "state")) ? "CLOSED" : "OPEN",
        row.path("draft").asBoolean(false), nullable(row.path("user"), "login"),
        required(row, "html_url"), merged, instant(row, "closed_at"), instant(row, "updated_at"));
  }

  private JsonNode get(String path, String token, Object... variables) {
    outside();
    try {
      var result =
          http.get()
              .uri(path, variables)
              .headers(h -> h.setBearerAuth(token))
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (result == null) throw unavailable();
      return result;
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  @Override
  public Installation installation(long id) {
    outside();
    try {
      var row =
          http.get()
              .uri("/app/installations/{id}", id)
              .headers(h -> h.setBearerAuth(jwt.issue()))
              .retrieve()
              .onStatus(
                  s -> s.value() == 404,
                  (request, response) -> {
                    throw new MissingInstallation();
                  })
              .onStatus(
                  s -> s.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (row == null
          || row.path("id").asLong(0) != id
          || !appId.equals(row.path("app_id").asString(""))
          || !"Organization".equals(row.path("account").path("type").asString("")))
        throw forbidden();
      String selection = required(row, "repository_selection").toUpperCase(java.util.Locale.ROOT);
      if (!List.of("ALL", "SELECTED").contains(selection)) throw unavailable();
      return new Installation(
          id,
          row.path("account").path("id").asLong(0),
          required(row.path("account"), "login"),
          selection,
          !row.path("suspended_at").isNull());
    } catch (MissingInstallation exception) {
      return null;
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  private static class MissingInstallation extends RuntimeException {}

  private JsonNode graphql(String query, Map<String, ?> variables, String token) {
    outside();
    try {
      var result =
          http.post()
              .uri("/graphql")
              .headers(h -> h.setBearerAuth(token))
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of("query", query, "variables", variables))
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (result == null || result.has("errors") || !result.path("data").isObject())
        throw unavailable();
      return result.path("data");
    } catch (RestClientException exception) {
      throw unavailable();
    }
  }

  private String userToken(long userId) {
    outside();
    return userTokens.tokenFor(userId);
  }

  private static String next(JsonNode connection, String previous) {
    String next = required(connection.path("pageInfo"), "endCursor");
    if (next.equals(previous)) throw unavailable();
    return next;
  }

  private static Map<String, Object> paged(String key, String value, String cursor) {
    var variables = new java.util.LinkedHashMap<String, Object>();
    variables.put(key, value);
    variables.put("after", cursor.isEmpty() ? null : cursor);
    return variables;
  }

  private static String required(JsonNode node, String field) {
    String value = node.path(field).asString("");
    if (value.isBlank()) throw unavailable();
    return value;
  }

  private static String nullable(JsonNode node, String field) {
    return node.path(field).isString() ? node.path(field).asString("") : null;
  }

  private static Instant instant(JsonNode node, String field) {
    var value = nullable(node, field);
    try {
      return value == null ? null : Instant.parse(value);
    } catch (RuntimeException exception) {
      throw unavailable();
    }
  }

  private static void outside() {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("GitHub HTTP must run outside DB transactions");
  }

  private static ApiException upstream(int status) {
    return status == 401
        ? new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요")
        : status == 403 || status == 404 ? forbidden() : unavailable();
  }

  private static ApiException forbidden() {
    return new ApiException(403, "FORBIDDEN", "GitHub 조직과 저장소 권한을 확인해 주세요");
  }

  private static ApiException unavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}
