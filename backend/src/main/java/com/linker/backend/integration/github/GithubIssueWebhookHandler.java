package com.linker.backend.integration.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.issue.IssueContextRepository;
import com.linker.backend.service.user.IssueSyncService;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Enable only after B/C payload freeze and shared-schema activation. No fake-success fallback. */
@Component
@ConditionalOnProperty(name = "linker.issues.webhook-enabled", havingValue = "true")
public class GithubIssueWebhookHandler implements GithubWebhookHandler {
  private final IssueSyncService sync;
  private final IssueContextRepository contexts;
  private final NamedParameterJdbcTemplate jdbc;
  private final JsonMapper json = JsonMapper.builder().build();

  public GithubIssueWebhookHandler(
      IssueSyncService sync, IssueContextRepository contexts, NamedParameterJdbcTemplate jdbc) {
    this.sync = sync;
    this.contexts = contexts;
    this.jdbc = jdbc;
  }

  @Override
  public boolean supports(String event) {
    return "issues".equals(event) || "projects_v2_item".equals(event);
  }

  @Override
  public void handle(GithubWebhookDelivery delivery) {
    if (!supports(delivery.getEvent()) || delivery.getInstallationId() == null || !contexts.ready())
      throw IssueContextRepository.unavailable();
    var payload = json.readTree(delivery.getPayload());
    if (!payload.isObject()
        || !payload.path("action").isString()
        || !payload.path("installation").path("id").isIntegralNumber()) throw invalid();
    String action = payload.path("action").asString("");
    if (!action.equals(delivery.getAction())
        || payload.path("installation").path("id").asLong(0) != delivery.getInstallationId())
      throw invalid();
    var candidates =
        jdbc.queryForList(
            "SELECT t.id FROM teams t JOIN github_installations gi ON gi.id=t.installation_id WHERE"
                + " gi.github_installation_id=:installation AND gi.removed_at IS NULL AND"
                + " gi.suspended_at IS NULL AND t.status<>'DELETED'",
            Map.of("installation", delivery.getInstallationId()),
            Long.class);
    boolean matched = false;
    for (long teamId : candidates) {
      var ctx = contexts.get(teamId);
      if (payload.has("organization")
          && (!payload.path("organization").path("id").isIntegralNumber()
              || payload.path("organization").path("id").asLong(0) != ctx.orgId())) throw invalid();
      if ("issues".equals(delivery.getEvent())) {
        if (!payload.path("repository").path("id").isIntegralNumber()
            || !payload.path("issue").path("id").isIntegralNumber()) throw invalid();
        long repo = payload.path("repository").path("id").asLong(0);
        if (repo <= 0 || payload.path("issue").path("id").asLong(0) <= 0) throw invalid();
        if (ctx.repos().stream().noneMatch(r -> r.githubId() == repo)) continue;
        if (Set.of(
                "milestoned",
                "demilestoned",
                "locked",
                "unlocked",
                "pinned",
                "unpinned",
                "typed",
                "untyped")
            .contains(action)) return;
        if (!Set.of(
                "opened",
                "edited",
                "closed",
                "reopened",
                "assigned",
                "unassigned",
                "labeled",
                "unlabeled",
                "deleted",
                "transferred")
            .contains(action)) throw invalid();
      } else {
        var item = payload.path("projects_v2_item");
        if (!item.path("node_id").isString() || item.path("node_id").asString("").isBlank())
          throw invalid();
        if (!ctx.board().nodeId().equals(item.path("project_node_id").asString(""))) continue;
        if ("reordered".equals(action)) return;
        if (!Set.of("created", "edited", "deleted", "converted", "archived", "restored")
            .contains(action)) throw invalid();
        if ("archived".equals(action))
          throw new ApiException(409, "STATE_CONFLICT", "보관 정책 확인이 필요해요");
      }
      matched = true;
      sync.fullSync(teamId);
    }
    if (!matched) throw IssueContextRepository.unavailable();
  }

  private static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "웹훅 식별 정보를 확인해 주세요");
  }
}
