package com.linker.backend.integration.github;

import java.net.URI;

import org.springframework.web.util.UriComponentsBuilder;

/** GitHub App user-authorization URL. Login state is not the installation state. */
public final class GithubAuthorizeUrls {

	private GithubAuthorizeUrls() {
	}

	public static String build(String webBaseUrl, String clientId, String redirectUri, String state) {
		String base = webBaseUrl.endsWith("/") ? webBaseUrl.substring(0, webBaseUrl.length() - 1) : webBaseUrl;
		return UriComponentsBuilder.fromUriString(base + "/login/oauth/authorize")
				.queryParam("client_id", clientId)
				.queryParam("redirect_uri", redirectUri)
				.queryParam("state", state)
				.queryParam("allow_signup", "false")
				.build()
				.encode()
				.toUriString();
	}

	public static String redirectUri(String callbackUrl, String client) {
		if ("app".equals(client)) {
			return callbackUrl + "?client=app";
		}
		return callbackUrl;
	}

	public static boolean callbackUrl(String value) {
		if (value == null || value.isBlank()) {
			return false;
		}
		try {
			URI uri = URI.create(value.trim());
			String scheme = uri.getScheme();
			return ("https".equals(scheme) || "http".equals(scheme))
					&& uri.getUserInfo() == null
					&& uri.getRawQuery() == null
					&& uri.getFragment() == null
					&& uri.getPath() != null
					&& uri.getPath().endsWith("/auth/callback");
		}
		catch (IllegalArgumentException exception) {
			return false;
		}
	}
}
