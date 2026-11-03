package com.linker.backend.service.issue;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.integration.github.GithubIssuesClient;
import com.linker.backend.integration.github.ProjectsItemChange;
import com.linker.backend.service.github.GithubWebhookHandler;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Activated only after B supplies both providers and the reviewed schema is applied. */
@Component
@ConditionalOnProperty(prefix = "linker.github.projects", name = "consumer-enabled", havingValue = "true")
public class ProjectsItemWebhookHandler implements GithubWebhookHandler {

	private final ProjectsRefreshContextResolver contexts;
	private final ProjectsAccessTokenProvider tokens;
	private final GithubIssuesClient issues;
	private final ProjectsCacheRefreshService refresh;
	private final ObjectMapper mapper;

	public ProjectsItemWebhookHandler(ProjectsRefreshContextResolver contexts, ProjectsAccessTokenProvider tokens,
			GithubIssuesClient issues, ProjectsCacheRefreshService refresh, ObjectMapper mapper) {
		this.contexts = contexts; this.tokens = tokens; this.issues = issues; this.refresh = refresh; this.mapper = mapper;
	}

	@Override public boolean supports(String event) { return "projects_v2_item".equals(event); }

	@Override public void handle(GithubWebhookDelivery delivery) {
		if (!supports(delivery.getEvent())) throw new IllegalArgumentException("Unsupported webhook event");
		var parsed = ProjectsItemChange.parse(delivery.getPayload(), mapper);
		if (parsed.isEmpty()) return; // PR/draft item is outside this issue handler.
		var change = parsed.orElseThrow();
		if (delivery.getInstallationId() == null || delivery.getInstallationId() != change.installationId()) {
			throw new IllegalArgumentException("Stored installation does not match payload");
		}
		var resolved = contexts.resolve(change);
		if (resolved.isEmpty()) return; // Verified App event for a board not linked in Linker.
		var context = resolved.orElseThrow();
		if (context.installationId() != change.installationId() || context.organizationId() != change.organizationId()
				|| !context.projectId().equals(change.projectId())) throw new IllegalArgumentException("Unverified Projects context");
		String token = tokens.readToken(context.installationId());
		if (token == null || token.isBlank()) throw new IllegalStateException("Projects read token is unavailable");
		var source = issues.snapshot(token, context, change.issueNodeId());
		refresh.refresh(context, source, token);
		// B marks PROCESSED only after this returns; exceptions propagate for FAILED.
	}
}
