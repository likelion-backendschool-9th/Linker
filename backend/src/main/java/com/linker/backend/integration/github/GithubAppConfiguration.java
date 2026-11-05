package com.linker.backend.integration.github;

import java.net.http.HttpClient;
import java.time.Clock;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
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
	@ConditionalOnMissingBean(GithubUserAccessTokenSource.class)
	GithubUserAccessTokenSource unconfiguredGithubUserAccessTokenSource() {
		return userId -> {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 로그인 연결이 아직 준비되지 않았어요");
		};
	}
}
