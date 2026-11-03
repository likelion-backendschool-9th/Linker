package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class GithubProjectsRuntimeConfigurationTest {
	@Test void noRuntimeClientsAreEnabledByDefault() {
		new ApplicationContextRunner().withUserConfiguration(GithubProjectsRuntimeConfiguration.class).run(context -> {
			assertThat(context).doesNotHaveBean(GithubGraphqlClient.class);
			assertThat(context).doesNotHaveBean(GithubProjectsClient.class);
			assertThat(context).doesNotHaveBean(GithubIssuesClient.class);
		});
	}
}
