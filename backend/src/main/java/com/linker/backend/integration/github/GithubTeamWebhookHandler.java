package com.linker.backend.integration.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.service.user.UserTeamSyncService;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * B owns installation/org lifecycle; C keeps issues/projects events. Ingress already verified HMAC.
 */
@Component
@ConditionalOnProperty(name = "linker.team-setup.webhook-enabled", havingValue = "true")
public class GithubTeamWebhookHandler implements GithubWebhookHandler {
  private final UserTeamSyncService sync;
  private final JsonMapper json = JsonMapper.builder().build();

  public GithubTeamWebhookHandler(UserTeamSyncService sync) {
    this.sync = sync;
  }

  @Override
  public boolean supports(String event) {
    return "installation".equals(event) || "organization".equals(event);
  }

  @Override
  public void handle(GithubWebhookDelivery delivery) {
    var body = json.readTree(delivery.getPayload());
    if (!supports(delivery.getEvent())
        || !body.path("action").isString()
        || !body.path("action").asString("").equals(delivery.getAction())
        || delivery.getInstallationId() == null
        || !body.path("installation").path("id").isIntegralNumber()
        || body.path("installation").path("id").asLong(0) != delivery.getInstallationId())
      throw invalid();
    String action = delivery.getAction();
    if ("installation".equals(delivery.getEvent())) {
      if (!Set.of("created", "deleted", "suspend", "unsuspend", "new_permissions_accepted")
          .contains(action)) throw invalid();
      long org = body.path("installation").path("account").path("id").asLong(0);
      if (org <= 0
          || !"Organization"
              .equals(body.path("installation").path("account").path("type").asString("")))
        throw invalid();
      sync.installationChanged(delivery.getInstallationId(), org);
    } else {
      if (!Set.of("member_added", "member_removed", "member_invited", "renamed", "deleted")
          .contains(action)) throw invalid();
      var org = body.path("organization");
      long id = org.path("id").asLong(0);
      String login = org.path("login").asString("");
      if (id <= 0 || !login.matches("[A-Za-z0-9][A-Za-z0-9-]{0,38}")) throw invalid();
      if ("deleted".equals(action)) sync.installationChanged(delivery.getInstallationId(), id);
      else sync.organizationChanged(delivery.getInstallationId(), id, login);
    }
  }

  private static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "GitHub 웹훅 정보를 확인해 주세요");
  }
}
