package com.linker.backend.integration.github;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Context;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Repo;
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
  private final java.net.URI apiOrigin;
  private final GithubUserAccessTokenSource userTokens;

  public GithubIssueClient(GithubAppProperties properties, GithubUserAccessTokenSource userTokens) {
    this.userTokens = userTokens;
    this.apiOrigin = java.net.URI.create(properties.apiBaseUrl());
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
                    throw upstream(response.getStatusCode().value(), response.getHeaders());
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
      Issue issue,
      String body,
      String location,
      String unavailableState,
      Instant created,
      long authorGithubId) {}

  public Detail detail(Repo repo, int number, String token) {
    verifyRepository(repo, token);
    outside();
    try {
      return http.get()
          .uri("/repos/{owner}/{repo}/issues/{number}", repo.owner(), repo.name(), number)
          .headers(h -> h.setBearerAuth(token))
          .exchange(
              (req, res) -> {
                int status = res.getStatusCode().value();
                if (status == 301 || status == 302 || status == 307 || status == 308)
                  return new Detail(
                      null, "", res.getHeaders().getFirst("Location"), "MOVED", null, 0);
                if (status == 404 || status == 410)
                  return new Detail(null, "", null, "DELETED", null, 0);
                if (res.getStatusCode().isError()) throw upstream(status, res.getHeaders());
                var raw = res.bodyTo(JsonNode.class);
                if (raw == null || raw.has("pull_request")) throw unavailable();
                return new Detail(
                    parse(raw),
                    raw.path("body")
                        .asString("")
                        .replaceAll("(?s)\\s*<!-- linker-create:[0-9a-fA-F-]{36} -->", ""),
                    null,
                    null,
                    instant(raw, "created_at"),
                    raw.path("user").path("id").asLong(0));
              });
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  public void validateTemplateProjects(Context context, List<String> references, long user) {
    if (references.isEmpty()) return;
    var node =
        graphql(
                "query($id:ID!){node(id:$id){... on ProjectV2{id number owner{... on"
                    + " Organization{login}}}}}",
                Map.of("id", context.board().nodeId()),
                userTokens.tokenFor(user))
            .path("node");
    if (!context.board().nodeId().equals(text(node, "id"))
        || !context.orgLogin().equalsIgnoreCase(text(node.path("owner"), "login")))
      throw unavailable();
    String allowed = context.orgLogin() + "/" + node.path("number").asInt();
    for (String ref : references)
      if (!ref.equalsIgnoreCase(allowed))
        throw new ApiException(409, "STATE_CONFLICT", "템플릿의 프로젝트가 팀에 연결된 보드와 달라요");
  }

  public void verifyCreatedContent(
      Repo repo, int number, String title, String body, String type, String token) {
    var raw =
        get("/repos/{owner}/{repo}/issues/{number}", token, repo.owner(), repo.name(), number);
    if (!title.equals(raw.path("title").asString())
        || !body.equals(raw.path("body").asString())
        || !type.isBlank() && !type.equals(raw.path("type").path("name").asString()))
      throw new ApiException(409, "STATE_CONFLICT", "생성된 GitHub 본문·유형을 확인하지 못했어요");
  }

  public record TemplateFile(String name, String content) {}

  public List<TemplateFile> templates(Repo repo, String token) {
    verifyRepository(repo, token);
    return templateDirectory(repo.owner(), repo.name(), token);
  }

  public List<TemplateFile> organizationTemplates(String owner, String token) {
    // GitHub's inherited .github templates must be public.
    var repository = optionalGet("/repos/{owner}/.github", token, owner);
    if (repository == null
        || !repository.path("private").isBoolean()
        || repository.path("private").asBoolean()) return List.of();
    if (!repository.path("full_name").asString("").equalsIgnoreCase(owner + "/.github"))
      throw unavailable();
    return templateDirectory(owner, ".github", token);
  }

  private List<TemplateFile> templateDirectory(String owner, String repo, String token) {
    var listing =
        optionalGet("/repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE", token, owner, repo);
    if (listing == null) return List.of();
    if (!listing.isArray() || listing.size() > 1000) throw unavailable();
    List<TemplateFile> files = new ArrayList<>();
    for (var entry : listing) {
      String name = entry.path("name").asString("");
      if (!name.matches("[a-zA-Z0-9_. -]+\\.(md|yml|yaml)")
          || name.equalsIgnoreCase("config.yml")
          || name.equalsIgnoreCase("config.yaml")
          || !entry.path("type").asString("").equals("file")) continue;
      var file =
          optionalGet(
              "/repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE/{file}",
              token,
              owner,
              repo,
              name);
      if (file == null
          || !file.path("encoding").asString("").equals("base64")
          || file.path("size").asInt() > 256_000
          || file.path("content").asString("").length() > 350_000) continue;
      try {
        String content =
            new String(
                java.util.Base64.getDecoder()
                    .decode(file.path("content").asString("").replace("\n", "").replace("\r", "")),
                java.nio.charset.StandardCharsets.UTF_8);
        files.add(new TemplateFile(name, content));
      } catch (IllegalArgumentException ignored) {
        /* Invalid file falls back to built-in templates. */
      }
    }
    return List.copyOf(files);
  }

  private JsonNode optionalGet(String uri, String token, Object... args) {
    outside();
    try {
      return http.get()
          .uri(uri, args)
          .headers(h -> h.setBearerAuth(token))
          .exchange(
              (req, res) -> {
                if (res.getStatusCode().value() == 404) return null;
                if (res.getStatusCode().isError())
                  throw upstream(res.getStatusCode().value(), res.getHeaders());
                return res.bodyTo(JsonNode.class);
              });
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  public Issue createIssue(Repo repo, Map<String, Object> fields, long user) {
    String token = userTokens.tokenFor(user);
    verifyRepository(repo, token);
    outside();
    try {
      var result =
          http.post()
              .uri("/repos/{owner}/{repo}/issues", repo.owner(), repo.name())
              .headers(h -> h.setBearerAuth(token))
              .contentType(MediaType.APPLICATION_JSON)
              .body(fields)
              .retrieve()
              .onStatus(
                  s -> s.isError(),
                  (req, res) -> {
                    throw upstream(res.getStatusCode().value(), res.getHeaders());
                  })
              .body(JsonNode.class);
      if (result == null || result.has("pull_request")) throw unavailable();
      if (fields.containsKey("type")
          && !fields.get("type").equals(result.path("type").path("name").asString("")))
        throw unavailable();
      return parse(result);
    } catch (RestClientException e) {
      throw unavailable();
    }
  }

  /** Recover an ambiguous POST by its opaque draft marker. Never blindly re-POST. */
  public Issue createdWithMarker(Repo repo, String marker, Instant since, long user) {
    String token = userTokens.tokenFor(user);
    verifyRepository(repo, token);
    Issue found = null;
    for (int page = 1; page <= MAX_PAGES; page++) {
      var list =
          get(
              "/repos/{owner}/{repo}/issues?state=all&since={since}&per_page=100&page={page}",
              token,
              repo.owner(),
              repo.name(),
              since.toString(),
              page);
      if (!list.isArray()) throw unavailable();
      for (var item : list)
        if (!item.has("pull_request") && item.path("body").asString("").contains(marker)) {
          if (found != null) throw unavailable();
          found = parse(item);
        }
      if (list.size() < 100) return found;
    }
    throw unavailable();
  }

  public record MovedTarget(Repo repo, int number) {}

  /**
   * Interpret, never follow, Location. Only the configured API origin and connected repos count.
   */
  public MovedTarget movedTarget(Context context, String location) {
    if (location == null || location.isBlank()) return null;
    try {
      var uri = apiOrigin.resolve(location);
      if (uri.getUserInfo() != null
          || uri.getFragment() != null
          || uri.getQuery() != null
          || !apiOrigin.getScheme().equalsIgnoreCase(uri.getScheme())
          || !apiOrigin.getHost().equalsIgnoreCase(uri.getHost())
          || port(apiOrigin) != port(uri)) return null;
      String path = uri.getPath();
      String base = apiOrigin.getPath();
      if (base != null && !base.isBlank() && !base.equals("/")) {
        base = base.replaceAll("/+$", "");
        if (!path.startsWith(base + "/")) return null;
        path = path.substring(base.length());
      }
      var byId =
          java.util.regex.Pattern.compile("^/repositories/([1-9][0-9]*)/issues/([1-9][0-9]*)$")
              .matcher(path);
      if (byId.matches()) {
        long external = Long.parseLong(byId.group(1));
        int number = Integer.parseInt(byId.group(2));
        return context.repos().stream()
            .filter(repo -> repo.githubId() == external)
            .findFirst()
            .map(repo -> new MovedTarget(repo, number))
            .orElse(null);
      }
      var byName =
          java.util.regex.Pattern.compile(
                  "^/repos/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/issues/([1-9][0-9]*)$")
              .matcher(path);
      if (byName.matches()) {
        int number = Integer.parseInt(byName.group(3));
        return context.repos().stream()
            .filter(
                repo ->
                    repo.owner().equalsIgnoreCase(byName.group(1))
                        && repo.name().equalsIgnoreCase(byName.group(2)))
            .findFirst()
            .map(repo -> new MovedTarget(repo, number))
            .orElse(null);
      }
    } catch (IllegalArgumentException e) {
      return null;
    }
    return null;
  }

  private static int port(java.net.URI uri) {
    return uri.getPort() >= 0
        ? uri.getPort()
        : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
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
          .exchange(
              (req, res) -> {
                if (res.getStatusCode().value() == 404) return false;
                if (res.getStatusCode().isError())
                  throw upstream(res.getStatusCode().value(), res.getHeaders());
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
    return editIssue(repo, number, fields, userTokens.tokenFor(userId));
  }

  public Issue editIssue(Repo repo, int number, Map<String, ?> fields, String token) {
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
                    throw upstream(res.getStatusCode().value(), res.getHeaders());
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
    projectField(context, item, field, option, date, userTokens.tokenFor(userId));
  }

  public void projectField(
      Context context, String item, String field, String option, LocalDate date, String token) {
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
    var data = graphql(mutation, vars, token);
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
                    throw upstream(res.getStatusCode().value(), res.getHeaders());
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
                    throw upstream(res.getStatusCode().value(), res.getHeaders());
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

  private static ApiException upstream(int status, org.springframework.http.HttpHeaders headers) {
    if (status == 429
        || status == 403
            && (headers.containsHeader("Retry-After")
                || "0".equals(headers.getFirst("X-RateLimit-Remaining")))) {
      long seconds = 60;
      try {
        String after = headers.getFirst("Retry-After");
        String reset = headers.getFirst("X-RateLimit-Reset");
        if (after != null) {
          try {
            seconds = Long.parseLong(after);
          } catch (NumberFormatException e) {
            seconds =
                java.time.Duration.between(
                        Instant.now(),
                        java.time.ZonedDateTime.parse(
                                after, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
                            .toInstant())
                    .getSeconds();
          }
        } else if (reset != null) seconds = Long.parseLong(reset) - Instant.now().getEpochSecond();
      } catch (java.time.DateTimeException | NumberFormatException e) {
        seconds = 60;
      }
      // A malformed absurd header must not overflow the retry timestamp.
      if (seconds > 315360000L) seconds = 315360000L;
      return new ApiException(
          429,
          "RATE_LIMITED",
          "GitHub 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요",
          Map.of("retryAfterSeconds", Math.max(1, seconds)));
    }
    if (status == 401 || status == 403)
      return new ApiException(403, "FORBIDDEN", "GitHub 권한을 확인해 주세요");
    return unavailable();
  }

  private static ApiException unavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}
