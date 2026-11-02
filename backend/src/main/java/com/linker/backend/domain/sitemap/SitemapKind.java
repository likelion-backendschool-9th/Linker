package com.linker.backend.domain.sitemap;

import java.util.Locale;

import com.linker.backend.global.error.ApiException;

public enum SitemapKind {
	POSTS,
	RECRUITS,
	USERS;

	public static SitemapKind fromPath(String raw) {
		if (raw == null) {
			throw invalid();
		}
		try {
			return SitemapKind.valueOf(raw.toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException exception) {
			throw invalid();
		}
	}

	public String pathValue() {
		return name().toLowerCase(Locale.ROOT);
	}

	private static ApiException invalid() {
		return new ApiException(400, "VALIDATION_ERROR", "지원하지 않는 sitemap 종류예요");
	}
}
