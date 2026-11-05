package com.linker.backend.integration.github;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.issue.IssueContextRepository.Context;
import com.linker.backend.repository.issue.IssueContextRepository.Repo;
import java.net.http.HttpClient;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

@Component
public class GithubIssueClient implements IssueSource {
  // Transport safety ceiling, not a product/plan limit. Never commit a truncated scan.
  private static final int MAX_PAGES = 10000;
  private final RestClient http;
  private final GithubUserAccessTokenSource userTokens;

  public GithubIssueClient(GithubAppProperties properties, GithubUserAccessTokenSource userTokens) {
    this.userTokens = userTokens;
    var client =
        HttpClient.newBuilder()
            .connectTimeout(properties.requestTimeout())
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    var factory = new JdkClientHttpRequestFactory(client);
    factory.setReadTimeout(properties.requestTimeout());
    this.http =
        RestClient.builder()
            .baseUrl(properties.apiBaseUrl())
            .requestFactory(factory)
            .defaultHeader("Accept", "application/vnd.github+json")
            .defaultHeader("X-GitHub-Api-Version", properties.apiVersion())
            .build();
  }

  @Override
  public List<Issue> list(Repo repo, String token) {
    verifyRepository(repo, token);
    List<Issue> result = new ArrayList<>();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var raw =
          get(
              "/repos/{owner}/{repo}/issues?state=all&per_page=100&page={page}",
              token,
              repo.owner(),
              repo.name(),
              page);
      if (!raw.isArray()) throw unavailable();
      for (var node : raw) if (!node.has("pull_request")) result.add(parse(node));
      if (raw.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  @Override
  public Issue issue(Repo repo, int number, String token) {
    verifyRepository(repo, token);
    JsonNode raw;
    outside();
    try {
      raw =
          http.get()
              .uri("/repos/{owner}/{repo}/issues/{number}", repo.owner(), repo.name(), number)
              .headers(h -> h.setBearerAuth(token))
              .retrieve()
              .onStatus(
                  status -> status.value() == 404,
                  (request, response) -> {
                    throw new MissingGithubIssueException();
                  })
              .onStatus(
                  status -> status.isError(),
                  (request, response) -> {
                    throw upstream(response.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (raw == null) throw unavailable();
    } catch (RestClientException e) {
      throw unavailable();
    }
    if (raw.has("pull_request")) throw unavailable();
    return parse(raw);
  }

  private JsonNode verifyRepository(Repo repo, String token) {
    var raw = get("/repos/{owner}/{repo}", token, repo.owner(), repo.name());
    if (raw.path("id").asLong(0) != repo.githubId()) throw unavailable();
    return raw;
  }

  @Override
  public boolean canWrite(Repo repo, long userId) {
    var raw = verifyRepository(repo, userTokens.tokenFor(userId));
    var permissions = raw.path("permissions");
    if (!permissions.path("push").isBoolean()) throw unavailable();
    return permissions.path("push").asBoolean(false)
        || permissions.path("maintain").asBoolean(false)
        || permissions.path("admin").asBoolean(false);
  }

  @Override
  public String addToProject(String board, String issue, long userId) {
    var data =
        graphql(
            "mutation($project:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$content}){item{id}}}",
            Map.of("project", board, "content", issue),
            userTokens.tokenFor(userId));
    return text(data.path("addProjectV2ItemById").path("item"), "id");
  }

  @Override
  public Map<String, ProjectItem> project(Context ctx, String token) {
    Map<String, ProjectItem> result = new LinkedHashMap<>();
    String cursor = null;
    for (int page = 0; page < MAX_PAGES; page++) {
      Map<String, Object> vars = new LinkedHashMap<>();
      vars.put("id", ctx.board().nodeId());
      vars.put("after", cursor);
      var project =
          graphql(
                  """
                  query($id:ID!,$after:String){node(id:$id){... on ProjectV2{id owner{... on Organization{login}}
                  items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{id isArchived
                  content{__typename ... on Issue{id repository{nameWithOwner}}}
                  fieldValues(first:100){pageInfo{hasNextPage endCursor} nodes{__typename
                  ... on ProjectV2ItemFieldDateValue{date field{... on ProjectV2Field{id}}}
                  ... on ProjectV2ItemFieldSingleSelectValue{optionId field{... on ProjectV2SingleSelectField{id}}}}}}}}}}
                  """,
                  vars,
                  token)
              .path("node");
      if (!ctx.board().nodeId().equals(text(project, "id"))
          || !ctx.orgLogin().equalsIgnoreCase(text(project.path("owner"), "login")))
        throw unavailable();
      var connection = project.path("items");
      if (!connection.path("nodes").isArray()) throw unavailable();
      for (var item : connection.path("nodes")) {
        var content = item.path("content");
        if ("DraftIssue".equals(content.path("__typename").asString(""))
            || "PullRequest".equals(content.path("__typename").asString(""))) continue;
        if (!"Issue".equals(content.path("__typename").asString(""))) throw unavailable();
        String repoName = text(content.path("repository"), "nameWithOwner");
        if (ctx.repos().stream().noneMatch(r -> r.fullName().equalsIgnoreCase(repoName))) continue;
        if (!item.path("isArchived").isBoolean()
            || !item.path("fieldValues").path("nodes").isArray()) throw unavailable();
        List<JsonNode> fields = new ArrayList<>();
        item.path("fieldValues").path("nodes").forEach(fields::add);
        var fieldPage = item.path("fieldValues").path("pageInfo");
        String fieldCursor = next(fieldPage);
        for (int f = 0; fieldCursor != null; f++) {
          if (f >= MAX_PAGES) throw unavailable();
          var more =
              graphql(
                      """
                      query($id:ID!,$after:String!){node(id:$id){... on ProjectV2Item{fieldValues(first:100,after:$after){
                      pageInfo{hasNextPage endCursor} nodes{__typename
                      ... on ProjectV2ItemFieldDateValue{date field{... on ProjectV2Field{id}}}
                      ... on ProjectV2ItemFieldSingleSelectValue{optionId field{... on ProjectV2SingleSelectField{id}}}}}}}}
                      """,
                      Map.of("id", text(item, "id"), "after", fieldCursor),
                      token)
                  .path("node")
                  .path("fieldValues");
          if (!more.path("nodes").isArray()) throw unavailable();
          more.path("nodes").forEach(fields::add);
          String after = next(more.path("pageInfo"));
          if (fieldCursor.equals(after)) throw unavailable();
          fieldCursor = after;
        }
        String status = "NONE";
        LocalDate start = null, due = null;
        for (var field : fields) {
          String id = field.path("field").path("id").asString("");
          if (id.equals(ctx.board().statusField()))
            status = ctx.board().statuses().getOrDefault(text(field, "optionId"), "OTHER");
          if (id.equals(ctx.board().startField())) start = date(text(field, "date"));
          if (id.equals(ctx.board().dueField())) due = date(text(field, "date"));
        }
        var parsed =
            new ProjectItem(
                text(item, "id"),
                text(content, "id"),
                repoName,
                status,
                start,
                due,
                item.path("isArchived").asBoolean(false));
        if (result.putIfAbsent(parsed.issueNodeId(), parsed) != null) throw unavailable();
      }
      String after = next(connection.path("pageInfo"));
      if (after == null) return Map.copyOf(result);
      if (after.equals(cursor)) throw unavailable();
      cursor = after;
    }
    throw unavailable();
  }

  public record Detail(
      Issue issue, String body, String location, String unavailableState, Instant created) {}

  public Detail detail(Repo repo, int number, String token) {
    verifyRepository(repo, token);
    outside();
    try {
      return http.get()
          .uri("/repos/{owner}/{repo}/issues/{number}", repo.owner(), repo.name(), number)
          .headers(h -> h.setBearerAuth(token))
          .exchange((req, res) -> {
            int status = res.getStatusCode().value();
            if (status == 301 || status == 302 || status == 307 || status == 308)
              return new Detail(null, "", res.getHeaders().getFirst("Location"), "MOVED", null);
            if (status == 404 || status == 410) return new Detail(null, "", null, "DELETED", null);
            if (res.getStatusCode().isError()) throw upstream(status);
            var raw = res.bodyTo(JsonNode.class);
            if (raw == null || raw.has("pull_request")) throw unavailable();
            return new Detail(
                parse(raw), raw.path("body").asString(""), null, null, instant(raw, "created_at"));
          });
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  public List<Label> labelOptions(Repo repo, String token) {
    verifyRepository(repo, token);
    List<Label> result = new ArrayList<>();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var raw =
          get(
              "/repos/{owner}/{repo}/labels?per_page=100&page={page}",
              token,
              repo.owner(),
              repo.name(),
              page);
      if (!raw.isArray()) throw unavailable();
      for (var node : raw)
        result.add(new Label(text(node, "name"), "#" + text(node, "color").replace("#", "")));
      if (raw.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  public boolean candidateCanRead(Repo repo, String login, String token) {
    outside();
    try {
      return http.get()
          .uri(
              "/repos/{owner}/{repo}/collaborators/{login}/permission",
              repo.owner(),
              repo.name(),
              login)
          .headers(h -> h.setBearerAuth(token))
          .exchange((req, res) -> {
            if (res.getStatusCode().value() == 404) return false;
            if (res.getStatusCode().isError()) throw upstream(res.getStatusCode().value());
            var raw = res.bodyTo(JsonNode.class);
            if (raw == null) throw unavailable();
            if (!login.equalsIgnoreCase(raw.path("user").path("login").asString("")))
              throw unavailable();
            return List.of("read", "triage", "write", "maintain", "admin")
                .contains(text(raw, "permission"));
          });
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  public List<Issue> subIssues(Repo repo, int number, String token) {
    verifyRepository(repo, token);
    List<Issue> result = new ArrayList<>();
    for (int page = 1; page <= MAX_PAGES; page++) {
      var raw =
          get(
              "/repos/{owner}/{repo}/issues/{number}/sub_issues?per_page=100&page={page}",
              token,
              repo.owner(),
              repo.name(),
              number,
              page);
      if (!raw.isArray()) throw unavailable();
      for (var item : raw) result.add(parse(item));
      if (raw.size() < 100) return List.copyOf(result);
    }
    throw unavailable();
  }

  public Issue editIssue(Repo repo, int number, Map<String, ?> fields, long userId) {
    String token = userTokens.tokenFor(userId);
    verifyRepository(repo, token);
    outside();
    try {
      var raw =
          http.patch()
              .uri("/repos/{owner}/{repo}/issues/{number}", repo.owner(), repo.name(), number)
              .headers(h -> h.setBearerAuth(token))
              .contentType(MediaType.APPLICATION_JSON)
              .body(fields)
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (req, res) -> {
                    throw upstream(res.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (raw == null || raw.has("pull_request")) throw unavailable();
      return parse(raw);
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  public void projectField(
      Context context, String item, String field, String option, LocalDate date, long userId) {
    if (field == null || field.isBlank())
      throw new ApiException(409, "STATE_CONFLICT", "프로젝트 필드 연결이 필요해요");
    Map<String, Object> vars = new LinkedHashMap<>();
    vars.put("project", context.board().nodeId());
    vars.put("item", item);
    vars.put("field", field);
    String mutation;
    if (option == null && date == null)
      mutation =
          "mutation($project:ID!,$item:ID!,$field:ID!){clearProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field}){projectV2Item{id}}}";
    else {
      vars.put(
          "value",
          option == null
              ? Map.of("date", date.toString())
              : Map.of("singleSelectOptionId", option));
      mutation =
          "mutation($project:ID!,$item:ID!,$field:ID!,$value:ProjectV2FieldValue!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:$value}){projectV2Item{id}}}";
    }
    var data = graphql(mutation, vars, userTokens.tokenFor(userId));
    String operation =
        option == null && date == null
            ? "clearProjectV2ItemFieldValue"
            : "updateProjectV2ItemFieldValue";
    if (!item.equals(text(data.path(operation).path("projectV2Item"), "id"))) throw unavailable();
  }

  private Issue parse(JsonNode raw) {
    try {
      long id = raw.path("id").asLong(0);
      int number = raw.path("number").asInt(0);
      String state = text(raw, "state").toUpperCase(java.util.Locale.ROOT);
      if (id <= 0
          || number <= 0
          || !List.of("OPEN", "CLOSED").contains(state)
          || !raw.path("assignees").isArray()
          || !raw.path("labels").isArray()) throw unavailable();
      List<Assignee> assignees = new ArrayList<>();
      List<Label> labels = new ArrayList<>();
      for (var a : raw.path("assignees")) {
        long user = a.path("id").asLong(0);
        if (user <= 0) throw unavailable();
        assignees.add(new Assignee(user, text(a, "login")));
      }
      for (var l : raw.path("labels"))
        labels.add(new Label(text(l, "name"), "#" + text(l, "color").replace("#", "")));
      return new Issue(
          id,
          text(raw, "node_id"),
          number,
          text(raw, "title"),
          state,
          text(raw.path("user"), "login"),
          text(raw, "html_url"),
          Instant.parse(text(raw, "updated_at")),
          raw.path("closed_at").isNull() ? null : Instant.parse(text(raw, "closed_at")),
          List.copyOf(assignees),
          List.copyOf(labels));
    } catch (java.time.DateTimeException e) {
      throw unavailable();
    }
  }

  private JsonNode get(String uri, String token, Object... args) {
    outside();
    try {
      var result =
          http.get()
              .uri(uri, args)
              .headers(h -> h.setBearerAuth(token))
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (req, res) -> {
                    throw upstream(res.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (result == null) throw unavailable();
      return result;
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

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
                  (req, res) -> {
                    throw upstream(res.getStatusCode().value());
                  })
              .body(JsonNode.class);
      if (result == null || result.has("errors") || !result.path("data").isObject())
        throw unavailable();
      return result.path("data");
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  private static Instant instant(JsonNode raw, String field) {
    try {
      return Instant.parse(text(raw, field));
    } catch (java.time.DateTimeException e) {
      throw unavailable();
    }
  }

  private static LocalDate date(String value) {
    try {
      return LocalDate.parse(value);
    } catch (java.time.DateTimeException e) {
      throw unavailable();
    }
  }

  private static String next(JsonNode page) {
    if (!page.path("hasNextPage").isBoolean()) throw unavailable();
    return page.path("hasNextPage").asBoolean(false) ? text(page, "endCursor") : null;
  }

  private static String text(JsonNode node, String field) {
    if (!node.path(field).isString() || node.path(field).asString("").isBlank())
      throw unavailable();
    return node.path(field).asString("");
  }

  private static void outside() {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("GitHub calls must run outside DB transactions");
  }

  private static ApiException upstream(int status) {
    if (status == 401 || status == 403)
      return new ApiException(403, "FORBIDDEN", "GitHub 권한을 확인해 주세요");
    return unavailable();
  }

  private static ApiException unavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}
