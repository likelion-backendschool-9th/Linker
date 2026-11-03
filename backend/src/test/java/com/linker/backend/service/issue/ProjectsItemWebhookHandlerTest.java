package com.linker.backend.service.issue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;

import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.integration.github.GithubFixtures;
import com.linker.backend.integration.github.GithubIssuesClient;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ProjectsItemWebhookHandlerTest {
	private final ProjectsRefreshContextResolver contexts = mock(ProjectsRefreshContextResolver.class);
	private final ProjectsAccessTokenProvider tokens = mock(ProjectsAccessTokenProvider.class);
	private final GithubIssuesClient issues = mock(GithubIssuesClient.class);
	private final ProjectsCacheRefreshService refresh = mock(ProjectsCacheRefreshService.class);
	private final ProjectsItemWebhookHandler handler = new ProjectsItemWebhookHandler(contexts, tokens, issues, refresh, new ObjectMapper());

	@Test void ignoresUnlinkedBoardWithoutRequestingToken() {
		when(contexts.resolve(any())).thenReturn(Optional.empty());
		handler.handle(delivery(100)); verifyNoInteractions(tokens, issues, refresh);
	}

	@Test void rejectsStoredInstallationMismatchBeforeResolvingContext() {
		assertThatThrownBy(() -> handler.handle(delivery(999))).isInstanceOf(IllegalArgumentException.class);
		verifyNoInteractions(contexts, tokens, issues, refresh);
	}

	@Test void refusesMissingTokenInsteadOfPretendingToProcess() {
		when(contexts.resolve(any())).thenReturn(Optional.of(GithubFixtures.context()));
		when(tokens.readToken(100)).thenReturn(" ");
		assertThatThrownBy(() -> handler.handle(delivery(100))).isInstanceOf(IllegalStateException.class);
		verifyNoInteractions(issues, refresh);
	}

	@Test void onlySupportsProjectsItemEvents() {
		assertThat(handler.supports("projects_v2_item")).isTrue();
		assertThat(handler.supports("issues")).isFalse();
		assertThat(handler.supports("projects_v2")).isFalse();
	}

	private static GithubWebhookDelivery delivery(long installation) {
		return GithubWebhookDelivery.received("fixture-delivery", "projects_v2_item", "edited", installation, GithubFixtures.load("projects-item-edited"));
	}
}
