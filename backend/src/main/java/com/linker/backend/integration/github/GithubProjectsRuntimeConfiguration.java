package com.linker.backend.integration.github;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "linker.github.projects", name = "consumer-enabled", havingValue = "true")
public class GithubProjectsRuntimeConfiguration {

	@Bean GithubGraphqlClient githubGraphqlClient(@Value("${linker.github.projects.api-base-url:https://api.github.com}") String baseUrl) {
		var requests = new SimpleClientHttpRequestFactory();
		requests.setConnectTimeout(Duration.ofSeconds(5));
		requests.setReadTimeout(Duration.ofSeconds(10));
		return new GithubGraphqlClient(baseUrl, RestClient.builder().requestFactory(requests));
	}

	@Bean GithubProjectsClient githubProjectsClient(GithubGraphqlClient graphql) { return new GithubProjectsClient(graphql); }
	@Bean GithubIssuesClient githubIssuesClient(GithubGraphqlClient graphql) { return new GithubIssuesClient(graphql); }
}
