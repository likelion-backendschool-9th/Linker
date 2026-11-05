package com.linker.backend.integration.github;

import java.net.http.HttpClient;
import java.time.Clock;

import com.linker.backend.global.config.GithubAppProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class GithubAppConfiguration {
	@Bean
	GithubAppClient githubAppClient(GithubAppProperties properties, GithubAppJwt jwt, Clock clock) {
		HttpClient http = HttpClient.newBuilder().connectTimeout(properties.requestTimeout())
				.followRedirects(HttpClient.Redirect.NEVER).build();
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
		factory.setReadTimeout(properties.requestTimeout());
		return new GithubAppClient(properties, jwt, clock, RestClient.builder().requestFactory(factory));
	}

	@Bean
	GithubUserAuthClient githubUserAuthClient(GithubAppProperties properties, Clock clock) {
		HttpClient http = HttpClient.newBuilder().connectTimeout(properties.requestTimeout())
				.followRedirects(HttpClient.Redirect.NEVER).build();
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
		factory.setReadTimeout(properties.requestTimeout());
		return new GithubUserAuthClient(properties, clock, RestClient.builder().requestFactory(factory).build());
	}
}
