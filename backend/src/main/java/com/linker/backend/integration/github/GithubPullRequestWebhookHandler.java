package com.linker.backend.integration.github;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.service.user.GithubPullRequestService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "linker.team-setup.webhook-enabled", havingValue = "true")
public class GithubPullRequestWebhookHandler implements GithubWebhookHandler {
  private final GithubPullRequestService requests;
  public GithubPullRequestWebhookHandler(GithubPullRequestService requests) { this.requests = requests; }
  @Override public boolean supports(String event) { return "pull_request".equals(event); }
  @Override public void handle(GithubWebhookDelivery delivery) { requests.receive(delivery); }
}
