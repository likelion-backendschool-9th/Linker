package com.linker.backend.domain.sitemap;

import java.util.List;

/**
 * Posts and recruit posts are later steps. Until those tables exist, their sitemap pages are empty.
 */
public final class DeferredSitemapSource implements SitemapSource {

	private final SitemapKind kind;

	public DeferredSitemapSource(SitemapKind kind) {
		this.kind = kind;
	}

	@Override
	public SitemapKind kind() {
		return kind;
	}

	@Override
	public List<SitemapItem> page(int page, int size) {
		return List.of();
	}
}
